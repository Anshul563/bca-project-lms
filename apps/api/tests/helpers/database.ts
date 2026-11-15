import mongoose from "mongoose";

import { connectDatabase, disconnectDatabase } from "../../src/config/db.js";

let connected = false;

/**
 * The integration suite runs against a real MongoDB in Docker using a
 * dedicated `lms_test` database; all collections are wiped between tests.
 */
export async function setupTestDatabase(): Promise<void> {
  if (!connected) {
    await connectDatabase();
    connected = true;
  }
}

export async function clearCollections(): Promise<void> {
  const collections = mongoose.connection.collections;
  for (const collection of Object.values(collections)) {
    await collection.deleteMany({});
  }
}

export async function teardownTestDatabase(): Promise<void> {
  if (!connected) {
    return;
  }
  await mongoose.connection.dropDatabase();
  await disconnectDatabase();
}
