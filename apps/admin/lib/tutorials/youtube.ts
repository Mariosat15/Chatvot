/**
 * YouTube URL/ID helpers for the tutorial system.
 *
 * Reason: Tutorials can be hosted on YouTube instead of stored as a
 * binary file on disk (which does not work across multiple servers).
 * Admins paste any common YouTube URL form; we extract and validate the
 * canonical 11-character video id and persist only that.
 */

// A YouTube video id is exactly 11 chars of [A-Za-z0-9_-].
const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;

/**
 * Extracts the 11-character YouTube video id from any common URL form,
 * or accepts a bare id. Returns null if no valid id can be found.
 *
 * Supported inputs:
 *   - https://www.youtube.com/watch?v=VIDEOID
 *   - https://youtu.be/VIDEOID
 *   - https://www.youtube.com/embed/VIDEOID
 *   - https://www.youtube.com/shorts/VIDEOID
 *   - https://www.youtube.com/live/VIDEOID
 *   - VIDEOID (bare 11-char id)
 */
export function parseYouTubeId(input: string): string | null {
  const raw = (input || "").trim();
  if (!raw) return null;

  // Bare id
  if (YOUTUBE_ID_RE.test(raw)) return raw;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();

  // youtu.be/VIDEOID
  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return id && YOUTUBE_ID_RE.test(id) ? id : null;
  }

  // youtube.com/* and youtube-nocookie.com/*
  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
    // watch?v=VIDEOID
    const v = url.searchParams.get("v");
    if (v && YOUTUBE_ID_RE.test(v)) return v;

    // /embed/VIDEOID, /shorts/VIDEOID, /live/VIDEOID, /v/VIDEOID
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length >= 2) {
      const prefix = parts[0].toLowerCase();
      if (["embed", "shorts", "live", "v"].includes(prefix)) {
        const id = parts[1];
        return YOUTUBE_ID_RE.test(id) ? id : null;
      }
    }
  }

  return null;
}

/** Builds the privacy-friendly embed URL for a validated video id. */
export function youTubeEmbedUrl(youtubeId: string): string {
  return `https://www.youtube-nocookie.com/embed/${youtubeId}`;
}

/** Builds a thumbnail URL for a validated video id. */
export function youTubeThumbnailUrl(youtubeId: string): string {
  return `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;
}
