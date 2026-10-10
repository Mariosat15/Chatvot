/**
 * Runs before every test file: removes any real database address from the environment.
 *
 * Reason: a test run inherits whatever environment launched it. On 1 Oct 2026 that was
 * the production admin process, so `MONGODB_URI` named the live cluster and tests that
 * clear collections deleted live data. Tests set their own `MONGODB_URI` to the in-memory
 * server on 127.0.0.1 when they need one, so stripping every non-local address here
 * costs nothing and means no test can even learn where production is.
 */
import { isLoopbackMongoUri } from "../../database/test-database-guard";

const REMOTE_STORE = /^(mongodb(\+srv)?|rediss?):\/\//i;

for (const [key, value] of Object.entries(process.env)) {
  if (!value || !REMOTE_STORE.test(value.trim())) continue;
  if (/^mongodb:/i.test(value.trim()) && isLoopbackMongoUri(value)) continue;
  if (/^rediss?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(value.trim())) continue;
  Reflect.deleteProperty(process.env, key);
}
