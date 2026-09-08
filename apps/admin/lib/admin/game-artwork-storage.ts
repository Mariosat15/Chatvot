import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { putBrandingAsset } from "@/lib/services/branding-assets.service";

/**
 * Store an uploaded game image so that BOTH web servers can serve it.
 *
 * The two-write shape is not belt-and-braces, it is the requirement. ChartVolt runs more
 * than one application server behind one hostname, so a file written to the disk of the
 * server that happened to handle the upload is a 404 roughly half the time on every other
 * server - and it is a 404 that appears intermittently, which reads as a caching problem
 * rather than a storage one. A redeploy loses it too. So the bytes also go into the database,
 * which is what `/api/assets/images/[filename]` falls back to when the disk has no copy.
 * That serve route already exists and is proven; this module deliberately produces a URL it
 * already understands rather than adding a second one.
 *
 * WHERE those bytes live is `branding-assets.service.ts`'s business and not this module's.
 * It used to be inline here, a base64 entry in the shared `WhiteLabel` document, and that
 * document hit MongoDB's 16MB ceiling on 8 September 2026 - so a game logo could not be
 * saved at all, and neither could any other image on the platform.
 */

/** Extensions we will store, as a Map so a crafted extension cannot reach Object.prototype. */
const IMAGE_TYPES: ReadonlyMap<string, string> = new Map([
  ["png", "image/png"],
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["webp", "image/webp"],
  ["gif", "image/gif"],
]);

export const MAX_ARTWORK_BYTES = 4 * 1024 * 1024;

/**
 * SVG is deliberately absent from the list above, and it is the one exclusion worth stating:
 * an SVG is a document, it can carry a `<script>`, and it would be served from our own
 * origin - so accepting one turns an artwork upload into stored cross-site scripting against
 * the admin panel and the player app together. The branding route accepts SVG; that is not a
 * precedent to copy here, where the uploader is an operator managing third-party content.
 */
export type ArtworkResult =
  | { success: true; url: string }
  | { success: false; error: string };

function candidateDirectories(): string[] {
  return [
    path.join("/var/www/chartvolt", "public", "assets", "images"),
    path.join(process.cwd(), "..", "..", "public", "assets", "images"),
    path.join(process.cwd(), "public", "assets", "images"),
  ];
}

async function firstWritableDirectory(): Promise<string | null> {
  for (const dir of candidateDirectories()) {
    try {
      await mkdir(dir, { recursive: true });
      const probe = path.join(dir, ".write-test");
      await writeFile(probe, "test");
      try {
        await unlink(probe);
      } catch {
        // A leftover probe file is harmless; failing the upload over it is not.
      }
      return dir;
    } catch {
      continue;
    }
  }
  return null;
}

export async function storeGameArtwork(
  file: File,
  providerKey: string,
  gameCode: string,
  slot: "logo" | "banner",
): Promise<ArtworkResult> {
  const extension = (file.name.split(".").pop() ?? "").toLowerCase();
  const contentType = IMAGE_TYPES.get(extension);
  if (!contentType) {
    return {
      success: false,
      error: `Use a PNG, JPG, WebP or GIF image. "${extension || file.name}" is not one we can serve.`,
    };
  }

  // Reason: checked against the DECLARED type as well as the extension, because a renamed
  // file passes the extension test on its own. Neither check is sufficient and the pair is
  // cheap.
  if (!file.type.startsWith("image/")) {
    return { success: false, error: "That file is not an image." };
  }

  if (file.size > MAX_ARTWORK_BYTES) {
    return { success: false, error: "Images must be smaller than 4MB." };
  }

  const directory = await firstWritableDirectory();
  if (!directory) {
    return { success: false, error: "No writable upload directory is available on this server." };
  }

  // The filename is built from values WE control plus a timestamp, never from the uploaded
  // name: `file.name` is attacker-supplied and a `../` in it would escape the directory. The
  // timestamp also cache-busts, which matters because the serve route is fronted by a CDN
  // that has rewritten our cache headers before (R54).
  const safeSlug = `${providerKey}-${gameCode}`.replace(/[^a-z0-9-]/gi, "").slice(0, 60);
  const filename = `game-${slot}-${safeSlug || "title"}-${Date.now()}.${extension}`;

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    await writeFile(path.join(directory, filename), buffer);
  } catch (error) {
    console.error("❌ [Game artwork] Could not write the file:", error);
    return { success: false, error: "The image could not be saved." };
  }

  // The database copy is what makes this survive a redeploy and reach the other server, so a
  // failure here is reported rather than warned about - unlike the branding route, which
  // treats it as a nicety. An image that exists on one server only is a defect the operator
  // cannot see from the screen they uploaded it on.
  try {
    await putBrandingAsset(filename, buffer, contentType);
  } catch (error) {
    console.error("❌ [Game artwork] Stored on disk but not in the database:", error);
    return {
      success: false,
      error:
        "The image saved on this server but could not be copied to the database, so other servers would not serve it. Please try again.",
    };
  }

  return { success: true, url: `/api/assets/images/${filename}` };
}
