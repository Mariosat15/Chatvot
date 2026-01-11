/**
 * Worker Database Configuration
 * 
 * Connects to the same MongoDB as the main app.
 * Uses the existing mongoose connection from the shared database folder.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from root .env file
// Works for both dev (tsx) and production (compiled to dist/worker)
// Use path.sep to check for exact 'dist' folder (not substring like 'distributed')
const isCompiledBuild = __dirname.split(path.sep).includes('dist');
const envPath = isCompiledBuild 
  ? path.resolve(__dirname, '../../../.env')  // From dist/worker/config/
  : path.resolve(__dirname, '../../.env');     // From worker/config/
dotenv.config({ path: envPath });

let isConnected = false;

export async function connectToDatabase(): Promise<void> {
  if (isConnected) {
    return;
  }

  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI not found in environment variables');
  }

  try {
    // Don't override dbName - use whatever is in the connection string
    // The URI already specifies the database (e.g., .../chatvolt?...)
    await mongoose.connect(MONGODB_URI);
    
    isConnected = true;
    console.log('✅ Worker connected to MongoDB');
  } catch (error) {
    console.error('❌ Worker MongoDB connection error:', error);
    throw error;
  }
}

export async function disconnectFromDatabase(): Promise<void> {
  if (!isConnected) {
    return;
  }

  try {
    await mongoose.disconnect();
    isConnected = false;
    console.log('👋 Worker disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Worker MongoDB disconnect error:', error);
  }
}

