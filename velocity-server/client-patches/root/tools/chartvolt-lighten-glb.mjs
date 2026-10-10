// ChartVolt patch (28 Sep 2026): re-encode the WebP textures embedded in a binary glTF (.glb).
// Geometry bytes are copied untouched; only image bufferViews are replaced and the BIN chunk
// is re-laid out (4-byte aligned, as the glTF spec requires). The source file is not modified.
import fs from "node:fs";

const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;
const align4 = (n) => (n + 3) & ~3;

/**
 * @param {string} from source .glb
 * @param {string} to destination .glb
 * @param {(name: string, bytes: Buffer) => Promise<Buffer>} reencode returns the new image bytes
 */
export async function reencodeGlbImages(from, to, reencode) {
  const glb = fs.readFileSync(from);
  if (glb.readUInt32LE(0) !== 0x46546c67 || glb.readUInt32LE(4) !== 2) throw new Error(`${from}: not a glTF 2 binary`);
  const jsonLength = glb.readUInt32LE(12);
  if (glb.readUInt32LE(16) !== JSON_CHUNK) throw new Error(`${from}: first chunk is not JSON`);
  const gltf = JSON.parse(glb.subarray(20, 20 + jsonLength).toString("utf8"));
  const binStart = 20 + jsonLength;
  const binLength = glb.readUInt32LE(binStart);
  if (glb.readUInt32LE(binStart + 4) !== BIN_CHUNK) throw new Error(`${from}: second chunk is not BIN`);
  const bin = glb.subarray(binStart + 8, binStart + 8 + binLength);
  // Reason: a second buffer would be an external .bin file this rewrite does not handle.
  if (gltf.buffers.length !== 1) throw new Error(`${from}: expected exactly one buffer`);

  const imageByView = new Map((gltf.images ?? []).map((image) => [image.bufferView, image]));
  const parts = [];
  let offset = 0;
  for (const [index, view] of gltf.bufferViews.entries()) {
    const original = bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
    const image = imageByView.get(index);
    const bytes = image ? await reencode(image.name ?? `image${index}`, Buffer.from(original)) : original;
    const start = align4(offset);
    if (start > offset) parts.push(Buffer.alloc(start - offset));
    parts.push(bytes);
    view.byteOffset = start;
    view.byteLength = bytes.length;
    offset = start + bytes.length;
  }
  const newBin = Buffer.concat([...parts, Buffer.alloc(align4(offset) - offset)]);
  gltf.buffers[0].byteLength = offset;

  let json = Buffer.from(JSON.stringify(gltf), "utf8");
  json = Buffer.concat([json, Buffer.alloc(align4(json.length) - json.length, 0x20)]);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + json.length + 8 + newBin.length, 8);
  const chunk = (type, data) => {
    const head = Buffer.alloc(8);
    head.writeUInt32LE(data.length, 0);
    head.writeUInt32LE(type, 4);
    return Buffer.concat([head, data]);
  };
  fs.writeFileSync(to, Buffer.concat([header, chunk(JSON_CHUNK, json), chunk(BIN_CHUNK, newBin)]));
}
