/**
 * Rewrite seeded landing / hero copy that still says "duel" after the source defaults
 * moved to "challenge".
 *
 * WHY THIS EXISTS. The nine sites listed in `13` s9.1a were product strings, not a
 * terminology preference. Four of them are live code (landing sections, H2H scene,
 * theme data) and rewriting the source is enough. Three are **seeded defaults** —
 * `landing-page-templates-4.ts`, landing-builder `defaults.ts`, and
 * `hero-settings.defaults.ts` — and the seed paths are add-only (`seedLandingPageTemplates`
 * never overwrites an existing template; HeroSettings keeps whatever was first saved).
 * Editing the constant therefore does not change rows already written. This tool is the
 * migration half of that sweep.
 *
 * WHAT IT REFUSES. It only rewrites **string values** under three collections. Keys,
 * ObjectIds, dates and numbers are untouched. A full-document replace is deliberately
 * avoided — JSON round-tripping would stringify nested ObjectIds. Updates go through
 * `$set` on dotted paths only.
 *
 * REPORT-ONLY UNTIL `--apply`. Owner decision 24 Sep 2026 (NEXT-TASKS P1 #17): ops
 * backfills stay report-only; no production `--apply` is scheduled. Run the report to
 * see whether production still holds the old wording.
 */

import type { Connection } from "mongoose";

type MongoDb = NonNullable<Connection["db"]>;

/**
 * Exact collection names mongoose derives for the three models that hold the seeded
 * wording. Pinned by the suite against `Model.collection.name` so a rename cannot silently
 * aim this tool at an empty collection.
 */
export const DUEL_SEED_COLLECTIONS = [
  "landingpagetemplates",
  "landingpages",
  "herosettings",
] as const;

export type DuelSeedCollection = (typeof DUEL_SEED_COLLECTIONS)[number];

export interface FieldHit {
  /** MongoDB dotted path suitable for `$set`. */
  path: string;
  before: string;
  after: string;
}

export interface DocumentReport {
  collection: DuelSeedCollection;
  id: string;
  hits: FieldHit[];
  rewritten: boolean;
}

export interface RewriteOutcome {
  documents: DocumentReport[];
  totalHits: number;
  totalRewritten: number;
}

/**
 * Word-boundary replacements only, longest forms first.
 *
 * Reason: a bare `/duel/i` would rewrite inside identifiers if one ever appeared, and
 * replacing "Duel" before "Duels" would leave a trailing "s" on "Challenges". The six
 * forms cover every case the nine source sites used.
 */
export function rewriteDuelVocabulary(text: string): string {
  return text
    .replace(/\bDuels\b/g, "Challenges")
    .replace(/\bduels\b/g, "challenges")
    .replace(/\bDUELS\b/g, "CHALLENGES")
    .replace(/\bDuel\b/g, "Challenge")
    .replace(/\bduel\b/g, "challenge")
    .replace(/\bDUEL\b/g, "CHALLENGE");
}

export function stringContainsDuel(text: string): boolean {
  return /\bduels?\b/i.test(text);
}

function joinPath(parent: string, segment: string | number): string {
  if (parent === "") return String(segment);
  return `${parent}.${segment}`;
}

/**
 * Collect every string leaf that still says duel. Does not mutate the document —
 * `$set` applies the after values on write.
 */
export function collectDuelHits(node: unknown, path = ""): FieldHit[] {
  const hits: FieldHit[] = [];

  if (typeof node === "string") {
    if (!stringContainsDuel(node)) return hits;
    const after = rewriteDuelVocabulary(node);
    if (after !== node) hits.push({ path, before: node, after });
    return hits;
  }

  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i += 1) {
      // eslint-disable-next-line security/detect-object-injection -- loop index over own array
      hits.push(...collectDuelHits(node[i], joinPath(path, i)));
    }
    return hits;
  }

  if (node !== null && typeof node === "object") {
    // Reason: Date / ObjectId / Buffer look like objects; they have no useful enumerable
    // string children for copy, and walking them risks calling toString on binary data.
    if (
      node instanceof Date ||
      (typeof (node as { _bsontype?: string })._bsontype === "string")
    ) {
      return hits;
    }

    const record = node as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      if (key === "_id" || key === "__v") continue;
      // eslint-disable-next-line security/detect-object-injection -- key from Object.keys
      hits.push(...collectDuelHits(record[key], joinPath(path, key)));
    }
  }

  return hits;
}

export async function rewriteDuelSeeds(
  db: MongoDb,
  options: { apply: boolean },
): Promise<RewriteOutcome> {
  const documents: DocumentReport[] = [];
  let totalHits = 0;
  let totalRewritten = 0;

  for (const collectionName of DUEL_SEED_COLLECTIONS) {
    const collection = db.collection(collectionName);
    const cursor = collection.find({});

    for await (const raw of cursor) {
      const hits = collectDuelHits(raw);
      if (hits.length === 0) continue;

      const id = String((raw as { _id?: unknown })._id ?? "");
      let rewritten = false;

      if (options.apply) {
        const $set: Record<string, string> = {};
        for (const hit of hits) {
          $set[hit.path] = hit.after;
        }
        await collection.updateOne(
          { _id: (raw as { _id: unknown })._id },
          { $set },
        );
        rewritten = true;
        totalRewritten += 1;
      }

      documents.push({
        collection: collectionName,
        id,
        hits,
        rewritten,
      });
      totalHits += hits.length;
    }
  }

  return { documents, totalHits, totalRewritten };
}
