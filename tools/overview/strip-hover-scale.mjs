// One-off sweep (owner, 3 Oct 2026): buttons press, they never grow on hover.
// Removes `hover:scale-*` (not `group-hover:`) from the className of <Button>, <button>
// and <Link> opening tags in player-side .tsx files. Dry run unless `--apply`.
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const apply = process.argv.includes("--apply");
const files = execSync('rg -l --glob "*.tsx" "hover:scale-" components app', { encoding: "utf8" })
  .split(/\r?\n/)
  .filter(Boolean);
const TOKEN = /(^|[\s"'`{])(?:motion-reduce:)?(?<!group-)hover:scale-[^\s"'`}]+/g;
let total = 0;
for (const f of files) {
  const src = readFileSync(f, "utf8");
  // An opening tag: from `<Button`/`<button`/`<Link` to the first `>` not inside braces.
  const out = src.replace(/<(Button|button|Link)\b/g, (m, _n, offset) => m + "\u0000" + offset);
  let changed = src;
  let count = 0;
  const re = /<(Button|button|Link)\b/g;
  let match;
  const edits = [];
  while ((match = re.exec(src))) {
    let depth = 0;
    let end = match.index;
    for (let i = match.index; i < src.length; i++) {
      const ch = src[i];
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      else if (ch === ">" && depth === 0 && src[i - 1] !== "=") { end = i; break; }
    }
    const tag = src.slice(match.index, end);
    const cleaned = tag.replace(TOKEN, (_t, lead) => lead);
    if (cleaned !== tag) edits.push([match.index, end, cleaned]);
  }
  void out;
  for (const [s, e, c] of edits.reverse()) {
    changed = changed.slice(0, s) + c + changed.slice(e);
    count++;
  }
  if (count) {
    total += count;
    console.log(`${count}\t${f}`);
    if (apply) writeFileSync(f, changed, "utf8");
  }
}
console.log(`${apply ? "applied" : "dry run"}: ${total} tags`);
