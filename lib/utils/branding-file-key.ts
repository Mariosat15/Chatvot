/**
 * Keys for the `WhiteLabel.brandingFiles` map.
 *
 * The map holds a base64 copy of every uploaded hero and branding image so the asset routes
 * can serve them after a redeploy wipes the container's filesystem. It is keyed by filename,
 * and **Mongoose refuses map keys containing a dot** - so every real filename was rejected
 * and image recovery never worked at all.
 *
 * The failure was silent for a long time and then merely quiet. Before the admin schema
 * declared the field, Mongoose handed the upload route a plain JavaScript `Map`, which
 * accepted the key and then discarded the whole field on save. After the field was declared,
 * `default: new Map()` gives the route a `MongooseMap`, which validates and throws - and the
 * upload route catches that and logs a warning, because backing the image up is best-effort
 * next to writing it to disk. Either way no entry was ever stored, so there is nothing to
 * migrate.
 *
 * Encoding the dot fixes it. `__DOT__` is used rather than base64 so the stored keys stay
 * readable when someone inspects the document, which matters for a field whose whole purpose
 * is disaster recovery. A generated filename cannot collide with the token - they look like
 * `hero-1756713600-a1b2c3.png` - and the round trip is asserted by the tests either way.
 *
 * Keep this file identical to the copy in `apps/admin/lib/utils/`.
 */

const DOT_TOKEN = "__DOT__";

/** Filename to map key. Safe to call on a key that has already been encoded. */
export function encodeBrandingFileKey(filename: string): string {
  return filename.split(".").join(DOT_TOKEN);
}

/** Map key back to filename. Safe to call on a plain filename. */
export function decodeBrandingFileKey(key: string): string {
  return key.split(DOT_TOKEN).join(".");
}
