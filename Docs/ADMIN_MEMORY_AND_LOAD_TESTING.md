# Admin App: Memory & Load Testing

## When to increase memory

You **should increase memory** for the admin app when:

1. **Heap usage stays high (e.g. >85–90%)** in the metrics dashboard, and/or  
2. **Restart count keeps growing** (e.g. hundreds of restarts) during or after load tests, and/or  
3. **Logs show** `JavaScript heap out of memory` or the process being **killed** (OOM).

During **Performance Simulator** runs (concurrent requests, badge/milestone simulators, stress tests), the admin app uses more RAM. If the Node.js heap limit is too low, the process hits the cap and crashes → the host restarts it → **Restarts** in metadata go up. So yes: for load/stress testing you typically need **more memory** than for light, single-user use.

---

## What the metrics mean during load testing

| Metric | During load test | Action |
|--------|------------------|--------|
| **Heap usage 91%** | Normal under load, but risky | Give more heap (see below) so it doesn’t sit at the limit. |
| **Restarts 695** | Process was restarted 695 times (often OOM or crash) | Increase memory and/or fix leaks; then re-run tests. |
| **Event loop latency** | Slightly higher under load is expected | If p95 stays low (<10–20 ms), the app is still responsive. |

So: **high heap + many restarts** = process is running out of memory; **increasing memory** gives headroom so the app can handle the load without crashing.

---

## How to increase memory

### 1. Admin app (this repo)

The admin app can run with a larger Node.js heap so it doesn’t hit the default limit under load.

- **Deploy default**  
  When you run `pm2 start ecosystem.config.js`, the admin app gets a **4 GB** heap by default. No extra step needed.

- **Variable: use more than 4 GB**  
  Set **`ADMIN_HEAP_MB`** in your server `.env` (e.g. `ADMIN_HEAP_MB=8192` for 8 GB), then `pm2 restart chartvolt-admin` or redeploy. Min 1024.

- **Production / start script**  
  In `apps/admin/package.json`, the `start` script is set to use a **4 GB** heap:

  ```json
  "start": "cross-env NODE_OPTIONS=--max-old-space-size=4096 IS_ADMIN=true PORT=3001 next start -p 3001"
  ```

  So when you run `npm run start` (or your host runs it), the admin app gets up to 4 GB of heap. No need to delete anything; this only raises the limit.

- **Optional: 2 GB instead of 4 GB**  
  If your host has less RAM, you can use 2 GB:

  ```text
  NODE_OPTIONS=--max-old-space-size=2048
  ```

- **Local / dev**  
  For `npm run dev` you usually don’t need to change this unless you’re stress-testing locally; then you can set the same env var before starting the admin app.

### 2. Host (Render, Railway, Fly.io, etc.)

Your host may have a **memory limit per instance** (e.g. 512 MB, 1 GB). Even with `--max-old-space-size=4096`, the process can’t use more than what the host allows; the host may kill it when it goes over (OOM → restarts).

- **Increase instance memory** in the host’s dashboard (e.g. 2 GB or 4 GB for the admin app) so the process has room to grow under load.
- **Set `NODE_OPTIONS`** on the host to match (e.g. `--max-old-space-size=2048` for a 2 GB instance, or `4096` for 4 GB), so Node uses that limit instead of the default.

After that, re-run the Performance Simulator; heap usage should stay below 100% and restarts should stop increasing if the only issue was memory.

---

## .env on the server (optional)

You don’t have to put `NODE_OPTIONS` in `.env` for the admin app to get 4 GB: **ecosystem.config.js** and **package.json** already set the heap when you run `pm2 start ecosystem.config.js`. If you want it explicit in `.env` (or to use more than 4 GB), add one of:

- **`ADMIN_HEAP_MB=4096`** — used by `ecosystem.config.js` for the admin app (default 4096 if omitted).
- **`NODE_OPTIONS=--max-old-space-size=4096`** — optional; same effect if something else reads it.

**How to see `.env` on the server**

1. SSH into the server.
2. Go to the project root (e.g. `cd /var/www/chartvolt`).
3. Run:
   - **`cat .env`** — shows the whole file (contains secrets; don’t share or paste in public).
   - **`grep -E 'NODE_OPTIONS|ADMIN_HEAP' .env`** — shows only those lines.

If the file doesn’t exist, create it in the project root and add the line(s) above, then restart: `pm2 restart chartvolt-admin`.

---

## Checking logs after restarts

When you see high **Restarts** in metadata:

1. In your host’s logs, search for:
   - `JavaScript heap out of memory`
   - `killed` / `OOMKilled` / `exit code 137` (often OOM)
   - Any uncaught exception or stack trace right before a restart
2. Correlate with **Performance Simulator** runs (e.g. many concurrent requests, or long-running simulator jobs).
3. If it’s OOM: increase memory (and optionally `--max-old-space-size`) as above, then test again.

---

## Summary

- **Do you need to increase memory for the admin app?**  
  **Yes**, if heap is often >85–90% and/or restarts keep increasing during or after load testing.
- **What to do:**  
  - Use the updated `start` script (4 GB heap) and/or set `NODE_OPTIONS=--max-old-space-size=4096` (or 2048) for the admin process.  
  - Increase the **instance memory** on your host so the process isn’t killed by the host’s limit.  
- **Test data:**  
  The Performance Simulator does **not** store test data in the DB; nothing to delete after tests.
