// CHARTVOLT PATCH: the process entry point, and the only file that listens.
//
// Reason: index.mjs starts the server only when `process.argv[1]` is index.mjs itself. Under PM2's
// fork mode `argv[1]` is PM2's own ProcessContainerFork.js, so that check is false, the module loads,
// nothing listens, and PM2 still reports the process "online" with empty logs - every round then
// fails with "race server unreachable". This file listens unconditionally, so it behaves the same
// under `node`, `npm start` and PM2. index.mjs keeps its guard so tests can import it without binding.
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRaceServer} from './index.mjs';
import {raceEnvironment} from './env.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const app = await createRaceServer();
const {port, host} = raceEnvironment(process.env, root);
app.server.listen(port, host, () => console.log(`Volt Velocity authoritative race service listening on ${host}:${port}`));
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, async () => { await app.close(); process.exit(0); });
