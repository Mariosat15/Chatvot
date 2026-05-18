# Tutorial Videos

This folder holds the source video files for the in-app **Tutorials** tab.
Files are served at runtime by the streaming route
`app/api/tutorials/videos/[filename]/route.ts` (with HTTP Range support so
the `<video>` player can scrub without re-downloading).

## How it works

| Layer | Where |
|---|---|
| Binary video files (and thumbnails) | This folder (`Videos/` and `Videos/thumbnails/`) |
| Metadata (title, description, category, order, isActive) | MongoDB collection `tutorialvideos` |
| Admin uploads UI | Admin app → **Help → Tutorial Videos** |
| User playback UI | Main app → **Dashboard → Tutorials** tab |

## White-label workflow

1. **Platform defaults**: The video files committed to this folder ship with
   every white-label deployment via git, so a fresh deploy automatically
   includes the default tutorial library.
2. **Custom tutorials per deployment**: A white-label customer can replace
   the defaults by:
   - Deleting unwanted tutorials from the admin UI (this removes the file
     from this folder and the metadata row from MongoDB).
   - Uploading their own videos via the same admin UI (the new files land
     in this folder and a new MongoDB row is created).
3. **Persisting customer-uploaded videos across deploys**: Because this
   folder is *tracked* in git (not ignored), customer-uploaded videos can
   be committed to the customer's own white-label branch so they survive
   future deploys. Otherwise, a fresh deploy resets to the upstream
   defaults.

## Constraints

- Accepted video MIME types: `video/mp4`, `video/webm`, `video/ogg`,
  `video/quicktime`.
- Max upload size: **200 MB** (set in
  `apps/admin/app/api/tutorials/route.ts`).
- Optional thumbnail: PNG / JPEG / WebP, max **2 MB** — resized to
  640×360 WebP by `sharp` on upload, stored under `thumbnails/`.
- File names use a slug + timestamp pattern, e.g.
  `getting-started-1716040123456.mp4`, to avoid collisions.

## Manually adding default tutorials (advanced)

Files can be added directly to this folder via git for use as platform
defaults. After committing the file, create the matching MongoDB
metadata row through the admin UI (use the same `filename` so the file
is picked up immediately).

For automated seeding, the schema lives in
`database/models/tutorial-video.model.ts`.
