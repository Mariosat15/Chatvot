/**
 * One-off repair: strip right-aligned `<line>|` prefixes that were written into source files.
 *
 * The prefix format is six characters of right-aligned digits followed by a pipe, e.g.
 * `    10|` or `   100|`. Requiring the six-character width is what keeps this from eating a
 * legitimate line that happens to begin with a number and a pipe.
 */
import { readFileSync, writeFileSync } from "node:fs";

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("usage: node strip-line-number-prefixes.mjs <file>...");
  process.exit(1);
}

const PREFIX = /^( *\d+)\|/;

for (const file of files) {
  const original = readFileSync(file, "utf8");
  const eol = original.includes("\r\n") ? "\r\n" : "\n";
  let stripped = 0;

  const lines = original.split(/\r?\n/).map((line) => {
    const match = PREFIX.exec(line);
    if (match && match[1].length === 6) {
      stripped += 1;
      return line.slice(7);
    }
    return line;
  });

  if (stripped === 0) {
    console.log(`${file}: nothing to strip`);
    continue;
  }

  writeFileSync(file, lines.join(eol), "utf8");
  console.log(`${file}: stripped ${stripped} prefix(es)`);
}
