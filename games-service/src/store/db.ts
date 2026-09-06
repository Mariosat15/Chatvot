import mongoose from "mongoose";

import { loadConfig } from "../config";

/**
 * The service's own database connection.
 *
 * OWN STORAGE IS PART OF THE POINT, NOT AN IMPLEMENTATION DETAIL
 * -------------------------------------------------------------
 * ChartVolt Games is a provider. A real one would have no access to the platform's database,
 * and every guarantee the integration rests on - that a provider never touches money, that
 * scores arrive only through the signed callback - is only genuinely tested if this service
 * cannot read the platform's data even by accident.
 *
 * `dbName` is therefore set explicitly rather than taken from the URI's path. Reason: an
 * operator copying the platform's connection string into `GAMES_MONGODB_URI` is the obvious
 * mistake, and it would otherwise put this service's collections inside the platform's
 * database, where a future query could join across the boundary and nothing would complain.
 */

let connecting: Promise<typeof mongoose> | null = null;

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) return mongoose;
  if (connecting) return connecting;

  const config = loadConfig();

  connecting = mongoose
    .connect(config.mongoUri, {
      dbName: config.dbName,
      serverSelectionTimeoutMS: 10_000,
    })
    .then((connection) => {
      console.log(`🎮 ChartVolt Games connected to ${config.dbName}`);
      return connection;
    })
    .catch((error) => {
      // Reason for clearing the promise: a cached rejected promise makes every later attempt
      // fail instantly with the original error, so a database that recovers never gets used
      // again until the process restarts.
      connecting = null;
      throw error;
    });

  return connecting;
}

export async function disconnectFromDatabase(): Promise<void> {
  connecting = null;
  await mongoose.disconnect();
}
