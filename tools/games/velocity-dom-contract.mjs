// Checks that the race client's markup still satisfies every element lookup its scripts make.
//
// Reason: on 14 Oct 2026 the HUD markup was recomposed and the vendor's race-assist.js still called
// el('hullLabel').closest('.integrity').classList, so the client threw on boot and the race never
// started. No vendor test boots the HUD, so the rebuild stayed green while the game was dead.
import fs from "node:fs";
import path from "node:path";

const LOOKUP = /(?:\bel|\$)\(\s*'([A-Za-z][\w-]*)'\s*\)(\?)?(?:\.closest\(\s*'\.([\w-]+)'\s*\))?/g;
// Names that share the helper's spelling but are not page elements (scene object names).
const NOT_DOM = new Set(["mine"]);
const VOID_TAGS = new Set(["img", "input", "br", "hr", "meta", "link", "source", "path", "circle", "rect", "line", "polyline", "polygon"]);

/** True when the element with `id` carries `cls` or sits inside an element that does. */
export function hasAncestorClass(html, id, cls) {
  const tags = /<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>/g;
  const stack = [];
  for (let m; (m = tags.exec(html)); ) {
    const [, closing, rawName, attrs, selfClose] = m;
    const name = rawName.toLowerCase();
    if (closing) {
      const at = stack.map((s) => s.name).lastIndexOf(name);
      if (at >= 0) stack.length = at;
      continue;
    }
    const classes = (/\bclass="([^"]*)"/.exec(attrs)?.[1] ?? "").split(/\s+/);
    if (new RegExp(`\\bid="${id}"`).test(attrs)) return classes.includes(cls) || stack.some((s) => s.classes.includes(cls));
    if (!selfClose && !VOID_TAGS.has(name)) stack.push({ name, classes });
  }
  return false;
}

/** Returns a list of problems; empty means every non-optional lookup resolves. */
export function checkDomContract(tree) {
  const html = fs.readFileSync(path.join(tree, "index.html"), "utf8");
  const problems = new Set();
  for (const file of fs.readdirSync(path.join(tree, "src")).filter((n) => n.endsWith(".js"))) {
    const code = fs.readFileSync(path.join(tree, "src", file), "utf8");
    for (const [, id, optional, cls] of code.matchAll(LOOKUP)) {
      if (optional || NOT_DOM.has(id)) continue;
      if (!new RegExp(`\\bid="${id}"`).test(html)) problems.add(`${file}: #${id} is not in index.html`);
      else if (cls && !hasAncestorClass(html, id, cls)) problems.add(`${file}: #${id} has no ancestor .${cls}`);
    }
  }
  return [...problems];
}
