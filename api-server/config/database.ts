/**
 * Database Configuration for API Server
 * 
 * Reuses the same MongoDB connection as the main app.
 * Uses the existing mongoose configuration.
 */

import mongoose from 'mongoose';

// Track if event listeners are already registered to prevent duplicates
let listenersRegistered = false;

// Connection options optimized for performance
const connectionOptions: mongoose.ConnectOptions = {
  maxPoolSize: 50,
  minPoolSize: 10,
  maxIdleTimeMS: 60000,
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  // CRITICAL: Disable buffering to get immediate errors instead of timeouts
  bufferCommands: false,
  // Auto-reconnect
  autoIndex: true,
};

export async function connectToDatabase(): Promise<typeof mongoose> {
  // Check actual mongoose connection state
  const state = mongoose.connection.readyState;
  // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  
  if (state === 1) {
    console.log('📊 Database already connected');
    return mongoose;
  }
  
  if (state === 2) {
    console.log('📊 Database connection in progress, waiting...');
    // Wait for connection to complete
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      
      const onConnected = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        mongoose.connection.off('error', onError);
        resolve();
      };
      
      const onError = (err: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        mongoose.connection.off('connected', onConnected);
        reject(err);
      };
      
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        // Clean up listeners to prevent memory leaks
        mongoose.connection.off('connected', onConnected);
        mongoose.connection.off('error', onError);
        reject(new Error('Connection timeout'));
      }, 30000);
      
      mongoose.connection.once('connected', onConnected);
      mongoose.connection.once('error', onError);
      
      // RACE CONDITION FIX: Check state after listener registration
      // Connection may have succeeded or failed in the narrow window
      const currentState = mongoose.connection.readyState;
      if (currentState === 1) {
        // Connected - 'connected' event already fired
        onConnected();
      } else if (currentState === 0) {
        // Failed/disconnected - 'error' event already fired
        onError(new Error('Connection failed before listener was attached'));
      }
    });
    return mongoose;
  }

  // Check for MONGODB_URI at runtime (after dotenv is loaded)
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not defined. Make sure .env file exists in project root.');
  }

  try {
    console.log('📊 Connecting to database...');
    const db = await mongoose.connect(MONGODB_URI, connectionOptions);
    console.log('✅ Database connected');
    
    // Only register listeners once to prevent accumulation on reconnects
    if (!listenersRegistered) {
      mongoose.connection.on('error', (err) => {
        console.error('❌ MongoDB connection error:', err);
      });

      mongoose.connection.on('disconnected', () => {
        console.warn('⚠️ MongoDB disconnected - will auto-reconnect');
      });

      mongoose.connection.on('reconnected', () => {
        console.log('✅ MongoDB reconnected');
      });
      
      listenersRegistered = true;
    }

    return db;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    throw error;
  }
}

export async function disconnectFromDatabase(): Promise<void> {
  const state = mongoose.connection.readyState;
  
  // 0 = disconnected, already closed
  if (state === 0) {
    console.log('📊 Database already disconnected');
    return;
  }
  
  try {
    // Close all connections in the connection pool
    await mongoose.connection.close();
    console.log('📊 MongoDB connection pool closed cleanly');
  } catch (error) {
    console.error('❌ Error closing database connection:', error);
    // Force disconnect if graceful close fails
    await mongoose.disconnect();
  }
}

export function getConnectionStatus(): boolean {
  return mongoose.connection.readyState === 1;
}

/**
 * Ensure database is ready before operations
 * Call this at the start of routes that need DB
 */
export async function ensureDbReady(): Promise<void> {
  const state = mongoose.connection.readyState;
  
  if (state === 1) return; // Connected
  
  if (state === 0 || state === 3) {
    // Disconnected - try to reconnect
    console.log('📊 Database not connected, reconnecting...');
    await connectToDatabase();
  } else if (state === 2) {
    // Connecting - wait
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      
      const onConnected = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        mongoose.connection.off('error', onError);
        resolve();
      };
      
      const onError = (err: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        mongoose.connection.off('connected', onConnected);
        reject(err);
      };
      
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        // Clean up listeners to prevent memory leaks
        mongoose.connection.off('connected', onConnected);
        mongoose.connection.off('error', onError);
        reject(new Error('DB connection timeout'));
      }, 15000);
      
      mongoose.connection.once('connected', onConnected);
      mongoose.connection.once('error', onError);
      
      // RACE CONDITION FIX: Check state after listener registration
      // Connection may have succeeded or failed in the narrow window
      const currentState = mongoose.connection.readyState;
      if (currentState === 1) {
        // Connected - 'connected' event already fired
        onConnected();
      } else if (currentState === 0) {
        // Failed/disconnected - 'error' event already fired
        onError(new Error('Connection failed before listener was attached'));
      }
    });
  }
}

