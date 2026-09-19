import dotenv from "dotenv";

dotenv.config();

import { createApp } from "./src/app";
import { loadConfig } from "./src/config";
import { startSweeper, stopSweeper } from "./src/callback/sweeper";
import { connectToDatabase, disconnectFromDatabase } from "./src/store/db";

/**
 * ChartVolt Games - entry point.
 *
 * THE ORDER HERE IS THE WHOLE FILE
 * --------------------------------
 * Configuration, then database, then listener, then sweeper. Each step must complete before the
 * next, and the reason is the same in every case: a process that accepts traffic before it can
 * serve it produces failures that look like the caller's fault.
 *
 * Loading the configuration first means a missing secret is a startup crash naming the variable,
 * rather than an authentication failure on every request an hour later. Connecting before listening
 * means the first round creation does not race the connection. Starting the sweeper last means it
 * never runs against a database that is not there.
 */

async function main(): Promise<void> {
  const config = loadConfig();

  await connectToDatabase();

  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`🎮 ChartVolt Games listening on ${config.publicUrl} (port ${config.port})`);
    if (config.sandbox) {
      // Loud on purpose. In sandbox mode a caller can force a score, which decides prize money if
      // this process is ever pointed at a live platform.
      console.warn("⚠️  SANDBOX MODE: score and terminal-state overrides are enabled.");
    }
    startSweeper();
  });

  /**
   * Shutdown.
   *
   * Draining before exit matters more here than in an ordinary service: a request in flight may be
   * a round creation whose response the platform is waiting for, and killing it mid-write is how a
   * round exists on one side and not the other. The sweeper is stopped first so no new delivery
   * begins while the process is on its way out - an interrupted delivery is safe to retry, but a
   * started one is wasted work at exactly the wrong moment.
   */
  const shutdown = (signal: string) => {
    console.log(`🛑 ChartVolt Games shutting down (${signal})`);
    server.close(() => {
      // The sweeper is awaited before the database closes, or an in-flight delivery loses its
      // connection mid-request and the round is left looking undelivered when it may have arrived.
      stopSweeper()
        .then(() => disconnectFromDatabase())
        .catch((error) => console.error("❌ Disconnect failed:", error))
        .finally(() => process.exit(0));
    });

    // A hard deadline, because `server.close` waits for keep-alive connections that may never
    // close on their own and an orchestrator will send SIGKILL long before they do.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((error) => {
  console.error("❌ ChartVolt Games failed to start:", error);
  process.exit(1);
});
