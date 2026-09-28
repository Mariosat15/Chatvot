// ChartVolt dev helper: screenshot the hangar and a live race at desktop, platform-frame, tablet and phone sizes.
// Usage: node tools/chartvolt-shots.mjs [hangar|race|all]   -> qa/cv-<size>-<screen>.png
import { browserBinary } from "./browser-binary.mjs";
import { chromium as playwright } from "playwright";
import chromium from "@sparticuz/chromium";
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";

const which = process.argv[2] ?? "all";
const sizes = [
  { name: "desktop", width: 1366, height: 768 },
  { name: "frame", width: 900, height: 560 },
  { name: "tablet", width: 820, height: 1180, touch: true },
  { name: "phone", width: 390, height: 844, touch: true },
  { name: "phone-land", width: 844, height: 390, touch: true },
];
const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, "http://localhost");
    const p = path.join(process.cwd(), "dist", u.pathname === "/" ? "index.html" : u.pathname);
    res.setHeader("Content-Type", p.endsWith(".js") ? "application/javascript" : p.endsWith(".css") ? "text/css" : "text/html");
    res.end(await fs.readFile(p));
  } catch {
    res.statusCode = 404;
    res.end();
  }
});
await new Promise((r) => server.listen(4189, "127.0.0.1", r));
await fs.mkdir("qa", { recursive: true });
const browser =
  process.platform === "win32"
    ? await playwright.launch({ channel: "msedge", headless: true, args: ["--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"] })
    : await playwright.launch({ executablePath: await browserBinary(), args: chromium.args, headless: true });
const problems = [];
try {
  for (const size of sizes) {
    const page = await browser.newPage({ viewport: { width: size.width, height: size.height }, isMobile: !!size.touch, hasTouch: !!size.touch });
    page.setDefaultTimeout(120000);
    page.on("pageerror", (e) => problems.push(`${size.name}: ${e.message}`));
    await page.goto("http://127.0.0.1:4189/?qa=1&track=orbital&seed=123");
    await page.waitForFunction(() => window.__READY__);
    await page.evaluate(() => { document.getElementById("quality").value = ".8"; });
    if (which !== "race") {
      await page.waitForTimeout(400);
      await page.screenshot({ path: `qa/cv-${size.name}-hangar.png` });
      const fit = await page.evaluate(() => {
        const play = document.getElementById("play").getBoundingClientRect();
        const h = document.getElementById("hangar");
        return { playVisible: play.bottom <= innerHeight && play.top >= 0, overflow: h.scrollHeight - h.clientHeight, pageScroll: document.documentElement.scrollHeight - innerHeight };
      });
      console.log(size.name, "hangar", JSON.stringify(fit));
      if (!fit.playVisible || fit.overflow > 1 || fit.pageScroll > 1) problems.push(`${size.name}: hangar does not fit ${JSON.stringify(fit)}`);
    }
    if (which !== "hangar") {
      await page.evaluate(() => document.getElementById("play").click());
      await page.waitForFunction(() => ChartvoltVelocity3D.getState().state === "racing");
      await page.evaluate(() => { __QA__.grant("shield"); __QA__.advance(1.2); });
      await page.waitForTimeout(300);
      await page.screenshot({ path: `qa/cv-${size.name}-race.png` });
      const boxes = await page.evaluate(() =>
        [".race-stats", ".integrity", ".item-slot", ".speed", ".map", ".skill-panel"].map((s) => {
          const r = document.querySelector(s)?.getBoundingClientRect();
          return r ? `${s} x${Math.round(r.x)} y${Math.round(r.y)} w${Math.round(r.width)} h${Math.round(r.height)}` : `${s} none`;
        }),
      );
      console.log(size.name, "race", boxes.join(" | "));
      if (size.name === "desktop") {
        const at = await page.evaluate(() => { const d = __QA__.cornerInspect(); __QA__.advance(0.4); return d; });
        await page.waitForTimeout(400);
        await page.screenshot({ path: "qa/cv-desktop-corner.png" });
        console.log("corner at", at);
      }
    }
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log(problems.length ? problems.join("\n") : "all sizes fit");
