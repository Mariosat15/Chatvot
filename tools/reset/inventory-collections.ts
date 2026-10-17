/**
 * READ-ONLY inventory of every collection in the live database, with document
 * counts, so the reset's coverage can be diffed against what actually exists
 * rather than against a list somebody wrote by hand.
 *
 * Reason: the reset is a hand-maintained list of collection names. The only way
 * to know it is complete is to ask the database what is there — a model file can
 * be missing, renamed, or set an explicit `collection:` the list never learned.
 *
 * Usage: npx tsx tools/reset/inventory-collections.ts
 * It writes nothing. No deleteMany, no updateMany, no insert.
 *
 * NOT YET RUN against the live cluster — the connection timed out from the
 * machine R87 was built on. `__tests__/admin/user-data-reset-coverage.test.ts`
 * answers the question this script cannot ask offline (is every DECLARED
 * collection classified), and this script answers the one the test cannot
 * (does a collection exist that no model declares).
 */
import "dotenv/config";
import { MongoClient } from "mongodb";

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");

  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db();
    const names = (await db.listCollections({}, { nameOnly: true }).toArray())
      .map((c) => c.name)
      .sort();

    const rows: Array<{ name: string; count: number }> = [];
    for (const name of names) {
      const count = await db.collection(name).estimatedDocumentCount();
      rows.push({ name, count });
    }

    console.log(`DATABASE: ${db.databaseName}`);
    console.log(`COLLECTIONS: ${rows.length}\n`);
    for (const r of rows) {
      console.log(`${String(r.count).padStart(8)}  ${r.name}`);
    }
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
