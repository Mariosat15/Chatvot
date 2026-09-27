// CHARTVOLT PATCH: the race server reads games-service/.env, not a file of its own.
//
// games-service already holds the two race secrets (it signs tickets and verifies receipts), so a
// second .env would mean every secret stored twice, where a copy that drifts makes every ticket
// fail its signature with nothing pointing at why. One file cannot disagree with itself.
//
// Reason it reads VELOCITY_RACE_URL and never PORT/HOST: the shared file's PORT is the games
// service's own port. Reading it would make this process try to bind the games service's socket.
import {resolve} from 'node:path';

const DEFAULT_RACE_URL = 'http://127.0.0.1:3080';

function originOf(value) {
  try { return new URL(value).origin; } catch { return null; }
}

export function raceEnvironment(env = process.env, root = process.cwd()) {
  const raceUrl = new URL((env.VELOCITY_RACE_URL || DEFAULT_RACE_URL).trim());
  const explicit = (env.VELOCITY_ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  // The race client runs inside the play surface, so the browser origin is the games service's
  // public origin. An explicit list replaces it rather than adding to it.
  const derived = originOf(env.GAMES_PUBLIC_URL || '');
  // VELOCITY_RACE_LISTEN ("host:port") overrides only where this process binds. Reason: the race
  // server is one process for both machines, so on the machine that hosts it the local games
  // service still calls 127.0.0.1 while the second machine's platform forwards to this one over
  // the network - one address cannot be both loopback-only and reachable from the other server.
  const listen = listenAddress(env.VELOCITY_RACE_LISTEN);
  return {
    secret: env.VELOCITY_TICKET_SECRET,
    adminKey: env.VELOCITY_ADMIN_KEY,
    origins: explicit.length ? explicit : derived ? [derived] : [],
    dataDir: env.VELOCITY_DATA_DIR || resolve(root, 'race-data'),
    host: listen ? listen.host : raceUrl.hostname.replace(/^\[|\]$/g, ''),
    port: listen ? listen.port : Number(raceUrl.port || (raceUrl.protocol === 'https:' ? 443 : 80)),
  };
}

// Refuses a malformed value (returns null, falling back to VELOCITY_RACE_URL) rather than
// binding somewhere nobody chose.
function listenAddress(value) {
  const match = /^\s*(\[[^\]]+\]|[^:\s]+):(\d{1,5})\s*$/.exec(value || '');
  if (!match) return null;
  const port = Number(match[2]);
  if (port < 1 || port > 65535) return null;
  return {host: match[1].replace(/^\[|\]$/g, ''), port};
}
