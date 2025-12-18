/**
 * Worker Database Configuration
 * 
 * Connects to the same MongoDB as the main app.
 * Uses the existing mongoose connection from the shared database folder.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename_esm = typeof __filename !== 'undefined' 
  ? __filename 
  : fileURLToPath(import.meta.url);
const __dirname_esm = typeof __dirname !== 'undefined' 
  ? __dirname 
  : path.dirname(__filename_esm);

// Load environment variables from root .env file
dotenv.config({ path: path.resolve(__dirname_esm, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI not found in environment variables');
}

let isConnected = false;

export async function connectToDatabase(): Promise<void> {
  if (isConnected) {
    return;
  }

  try {
    await mongoose.connect(MONGODB_URI, {
      dbName: 'chartvolt', // Ensure same database as main app
    });
    
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

