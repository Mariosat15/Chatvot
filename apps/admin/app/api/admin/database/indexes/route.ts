"use server";

import { NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import mongoose from "mongoose";
import { REQUIRED_INDEXES, type RequiredIndex } from "./required-indexes";

interface IndexInfo {
  collection: string;
  name: string;
  keys: Record<string, number>;
  required: boolean;
  exists: boolean;
  unique?: boolean;
  ttl?: number;
  /** When exists: true by same keys but different name (avoids duplicate create) */
  equivalentIndexName?: string;
  matchedByKeys?: boolean;
}

interface IndexStatus {
  collection: string;
  totalRequired: number;
  existing: number;
  missing: number;
  indexes: IndexInfo[];
}

// GET - Check index status
export async function GET() {
  try {
    await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) throw new Error("Database not connected");

    const results: IndexStatus[] = [];
    let totalMissing = 0;
    let totalExisting = 0;

    for (const [collectionName, requiredIndexes] of Object.entries(
      REQUIRED_INDEXES,
    )) {
      try {
        const collections = await db
          .listCollections({ name: collectionName })
          .toArray();
        const collectionExists = collections.length > 0;

        const indexes: IndexInfo[] = [];
        let existingIndexes: Array<{
          name?: string;
          key: Record<string, unknown>;
          unique?: boolean;
          expireAfterSeconds?: number;
        }> = [];

        if (collectionExists) {
          existingIndexes = (await db.collection(collectionName).indexes()) as typeof existingIndexes;
        }

        const keysToString = (key: Record<string, unknown>) =>
          JSON.stringify(key);

        for (const required of requiredIndexes) {
          const indexName = required.options.name;
          const requiredKeysStr = keysToString(required.keys);
          const byName = existingIndexes.find((idx) => idx.name === indexName);
          const byKeys = existingIndexes.find(
            (idx) => keysToString(idx.key) === requiredKeysStr,
          );
          const exists = !!byName || !!byKeys;
          const equivalentIndexName =
            !byName && byKeys ? byKeys.name : undefined;
          const matchedByKeys = !byName && !!byKeys;

          indexes.push({
            collection: collectionName,
            name: indexName,
            keys: required.keys,
            required: true,
            exists,
            unique: required.options.unique,
            ttl: required.options.expireAfterSeconds,
            equivalentIndexName,
            matchedByKeys,
          });

          if (exists) {
            totalExisting++;
          } else {
            totalMissing++;
          }
        }

        results.push({
          collection: collectionName,
          totalRequired: requiredIndexes.length,
          existing: indexes.filter((i) => i.exists).length,
          missing: indexes.filter((i) => !i.exists).length,
          indexes,
        });
      } catch (error) {
        console.warn(`Error checking indexes for ${collectionName}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        totalCollections: results.length,
        totalRequired: totalExisting + totalMissing,
        totalExisting,
        totalMissing,
        healthScore:
          totalMissing === 0
            ? 100
            : Math.round(
                (totalExisting / (totalExisting + totalMissing)) * 100,
              ),
      },
      message:
        "Required indexes are defined by the app. 'Existing' includes indexes matched by same key spec (different name). Create Missing only adds indexes that do not already exist in the DB.",
      collections: results,
    });
  } catch (error) {
    console.error("Error checking indexes:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

// POST - Create missing indexes
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { collections: targetCollections, createAll } = body;

    await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) throw new Error("Database not connected");

    const results: {
      collection: string;
      index: string;
      status: "created" | "exists" | "error";
      error?: string;
    }[] = [];

    const collectionsToProcess = createAll
      ? Object.keys(REQUIRED_INDEXES)
      : targetCollections || [];

    for (const collectionName of collectionsToProcess) {
      const requiredIndexes =
        REQUIRED_INDEXES[collectionName as keyof typeof REQUIRED_INDEXES];
      if (!requiredIndexes) continue;

      try {
        const existingIndexes = await db
          .collection(collectionName)
          .indexes()
          .catch(() => []);
        const existingNames = new Set(existingIndexes.map((idx) => idx.name));

        for (const required of requiredIndexes) {
          const indexName = required.options.name;

          if (existingNames.has(indexName)) {
            results.push({
              collection: collectionName,
              index: indexName,
              status: "exists",
            });
            continue;
          }

          const keysString = JSON.stringify(required.keys);
          const existingWithSameKeys = existingIndexes.find(
            (idx) => JSON.stringify(idx.key) === keysString,
          );

          if (existingWithSameKeys) {
            results.push({
              collection: collectionName,
              index: indexName,
              status: "exists",
              error: `Equivalent index "${existingWithSameKeys.name}" already exists (no duplicate created)`,
            });
            continue;
          }

          try {
            await db.collection(collectionName).createIndex(required.keys, {
              ...required.options,
              background: true,
            });

            results.push({
              collection: collectionName,
              index: indexName,
              status: "created",
            });
          } catch (indexError) {
            const errorMessage =
              indexError instanceof Error
                ? indexError.message
                : "Unknown error";
            const isConflict =
              errorMessage.includes("equivalent index") ||
              errorMessage.includes("IndexOptionsConflict") ||
              (indexError as { code?: number })?.code === 85;

            results.push({
              collection: collectionName,
              index: indexName,
              status: isConflict ? "exists" : "error",
              error: isConflict
                ? "Equivalent index exists with different name"
                : errorMessage,
            });

            if (!isConflict) {
              console.error(
                "Failed to create index",
                indexName,
                "on",
                collectionName,
                ":",
                indexError,
              );
            }
          }
        }
      } catch (collError) {
        console.error("Error processing", collectionName, ":", collError);
      }
    }

    const created = results.filter((r) => r.status === "created").length;
    const existed = results.filter((r) => r.status === "exists").length;
    const failed = results.filter((r) => r.status === "error").length;

    return NextResponse.json({
      success: true,
      summary: {
        created,
        existed,
        failed,
        total: results.length,
      },
      results,
    });
  } catch (error) {
    console.error("Error creating indexes:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
