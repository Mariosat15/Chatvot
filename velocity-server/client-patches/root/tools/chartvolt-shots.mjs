// ChartVolt dev helper: screenshot the hangar and a live race at desktop, platform-frame, tablet and phone sizes.
// Usage: node tools/chartvolt-shots.mjs [hangar|race|all] [size,size...]  -> qa/cv-<size>-<screen>.png
import { browserBinary } from "./browser-binary.mjs";
import { chromium as playwright } from "playwright";
import chromium from "@sparticuz/chromium";
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";

const which = process.argv[2] ?? "all";
const sizes = [
  { name: "full", width: 1920, height: 1080 },
  { name: "desktop", width: 1366, height: 768 },
  { name: "frame-tall", width: 870, height: 730 },
  { name: "frame", width: 900, height: 560 },
  { name: "phone-frame", width: 390, height: 640, touch: true },
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
  const only = process.argv[3]?.split(",");
  for (const size of sizes.filter((s) => !only || only.includes(s.name))) {
    const page = await browser.newPage({ viewport: { width: size.width, height: size.height }, isMobile: !!size.touch, hasTouch: !!size.touch });
    page.setDefaultTimeout(120000);
    page.on("pageerror", (e) => problems.push(`${size.name}: ${e.message}`));
    // three.js reports a shader that fails to compile as a console error, not a page error.
    page.on("console", (m) => { if (m.type() === "error") problems.push(`${size.name}: console ${m.text().slice(0, 300)}`); });
    await page.goto(`http://127.0.0.1:4189/?qa=1&track=${process.env.QA_TRACK ?? "orbital"}&seed=123`);
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
      // Show the multiplayer standings with a full grid of names, as a live race would.
      await page.evaluate(() => {
        __QA__.grant("mine");
        const ls = document.getElementById("liveStandings");
        // liveUI() re-hides the list every frame when no real multiplayer client exists; undo it in a
        // microtask, which runs before the browser paints.
        const force = () => {
          if (document.body.dataset.mode !== "multiplayer") document.body.dataset.mode = "multiplayer";
          if (ls.classList.contains("hidden")) ls.classList.remove("hidden");
        };
        new MutationObserver(force).observe(document.body, { attributes: true, attributeFilter: ["data-mode"] });
        new MutationObserver(force).observe(ls, { attributes: true, attributeFilter: ["class"] });
        force();
        document.getElementById("positionValue").textContent = "3";
        document.getElementById("positionTotal").textContent = "/ 8";
        document.getElementById("raceOrder").replaceChildren(...Array.from({ length: 8 }, (_, i) => {
          const li = document.createElement("li");
          li.innerHTML = `<b>${i + 1}</b><span>PILOT_${String.fromCharCode(65 + i)}NOVA</span><small>+${i}.${i}s</small>`;
          if (i === 2) li.className = "you";
          return li;
        }));
        __QA__.advance(1.2);
      });
      await page.waitForTimeout(1300);
      await page.screenshot({ path: `qa/cv-${size.name}-race.png` });
      const report = await page.evaluate(() => {
        const sel = ["header .brand", "header .actions", ".race-stats", ".integrity", ".item-slot", ".speed", ".map", ".skill-panel", "#liveStandings", "#steeringPad", "#touch .steer-controls", "#touch .aux-controls button", "#touch .pedal-controls"];
        const shown = (el) => el && el.getClientRects().length && getComputedStyle(el).visibility !== "hidden" && Number(getComputedStyle(el).opacity) > 0;
        const boxes = sel.flatMap((s) => [...document.querySelectorAll(s)].map((el) => [s, el])).filter(([, el]) => shown(el)).map(([s, el]) => [s, el.getBoundingClientRect()]);
        const overlaps = [];
        for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
          const [a, ra] = boxes[i], [b, rb] = boxes[j];
          if (a.startsWith("#touch") && b.startsWith("#touch")) continue;
          if (ra.left < rb.right && ra.right > rb.left && ra.top < rb.bottom && ra.bottom > rb.top) overlaps.push(`${a} x ${b}`);
        }
        const off = boxes.filter(([, r]) => r.top < -1 || r.bottom > innerHeight + 1 || r.left < -1 || r.right > innerWidth + 1).map(([s]) => s);
        const pad = document.getElementById("steeringPad");
        return { touchShown: !!shown(document.getElementById("touch")) && !!pad && pad.getBoundingClientRect().width > 0, overlaps, off,
          boxes: boxes.map(([s, r]) => `${s} ${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}`) };
      });
      console.log(size.name, "race", report.boxes.join(" | "));
      if (report.overlaps.length) problems.push(`${size.name}: overlap ${report.overlaps.join(", ")}`);
      if (report.off.length) problems.push(`${size.name}: off screen ${report.off.join(", ")}`);
      // The on-screen controls (analog pad included) are shown at every size, mouse screens too (owner, 28 Sep 2026).
      if (!report.touchShown) problems.push(`${size.name}: on-screen controls missing`);
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
