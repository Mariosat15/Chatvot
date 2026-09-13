import { NextRequest, NextResponse } from "next/server";
import { createReadStream } from "fs";
import { stat, access } from "fs/promises";
import { constants } from "fs";
import path from "path";
import { Readable } from "stream";
import {
  getTutorialVideoDirCandidates,
  getTutorialThumbnailDirCandidates,
} from "@/lib/tutorials/paths";

function videoContentType(ext: string): string {
  switch (ext) {
    case "mp4":
      return "video/mp4";
    case "webm":
      return "video/webm";
    case "ogg":
    case "ogv":
      return "video/ogg";
    case "mov":
      return "video/quicktime";
    default:
      return "application/octet-stream";
  }
}

function imageContentType(ext: string): string {
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    default:
      return "application/octet-stream";
  }
}

function contentTypeFor(filename: string, isThumbnail: boolean): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return isThumbnail ? imageContentType(ext) : videoContentType(ext);
}

async function findFile(filename: string, isThumbnail: boolean) {
  const safe = path.basename(filename);
  const dirs = isThumbnail
    ? getTutorialThumbnailDirCandidates()
    : getTutorialVideoDirCandidates();
  for (const dir of dirs) {
    const p = path.join(dir, safe);
    try {
      await access(p, constants.R_OK);
      return p;
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Stream a tutorial asset from disk with HTTP Range support (admin app).
 * Mirror of `lib/tutorials/stream.ts` in the main app.
 */
export async function streamTutorialAsset(
  req: NextRequest,
  rawFilename: string,
  isThumbnail: boolean,
): Promise<Response> {
  const safe = path.basename(rawFilename.split("?")[0]);
  const filePath = await findFile(safe, isThumbnail);
  if (!filePath) {
    return NextResponse.json(
      { error: "Tutorial asset not found" },
      { status: 404 },
    );
  }

  let fileStat;
  try {
    fileStat = await stat(filePath);
  } catch {
    return NextResponse.json(
      { error: "Tutorial asset not found" },
      { status: 404 },
    );
  }

  const contentType = contentTypeFor(safe, isThumbnail);
  const totalSize = fileStat.size;
  const rangeHeader = req.headers.get("range");
  const cacheHeaders = {
    "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    "Accept-Ranges": "bytes",
  } as const;

  if (!rangeHeader) {
    const stream = createReadStream(filePath);
    const webStream = Readable.toWeb(stream) as unknown as ReadableStream;
    return new Response(webStream, {
      status: 200,
      headers: {
        ...cacheHeaders,
        "Content-Type": contentType,
        "Content-Length": String(totalSize),
      },
    });
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match) {
    return new NextResponse("Invalid Range", {
      status: 416,
      headers: { "Content-Range": `bytes */${totalSize}` },
    });
  }

  const startStr = match[1];
  const endStr = match[2];
  let start = startStr ? parseInt(startStr, 10) : 0;
  let end = endStr ? parseInt(endStr, 10) : totalSize - 1;
  if (!startStr && endStr) {
    start = Math.max(0, totalSize - parseInt(endStr, 10));
    end = totalSize - 1;
  }

  if (
    Number.isNaN(start) ||
    Number.isNaN(end) ||
    start < 0 ||
    end >= totalSize ||
    start > end
  ) {
    return new NextResponse("Range Not Satisfiable", {
      status: 416,
      headers: { "Content-Range": `bytes */${totalSize}` },
    });
  }

  const chunkSize = end - start + 1;
  const stream = createReadStream(filePath, { start, end });
  const webStream = Readable.toWeb(stream) as unknown as ReadableStream;
  return new Response(webStream, {
    status: 206,
    headers: {
      ...cacheHeaders,
      "Content-Type": contentType,
      "Content-Length": String(chunkSize),
      "Content-Range": `bytes ${start}-${end}/${totalSize}`,
    },
  });
}
