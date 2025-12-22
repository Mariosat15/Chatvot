"use strict";
/**
 * Worker Database Configuration
 *
 * Connects to the same MongoDB as the main app.
 * Uses the existing mongoose connection from the shared database folder.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectToDatabase = connectToDatabase;
exports.disconnectFromDatabase = disconnectFromDatabase;
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load environment variables from root .env file
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    throw new Error('MONGODB_URI not found in environment variables');
}
let isConnected = false;
async function connectToDatabase() {
    if (isConnected) {
        return;
    }
    try {
        await mongoose_1.default.connect(MONGODB_URI, {
            dbName: 'chartvolt', // Ensure same database as main app
        });
        isConnected = true;
        console.log('✅ Worker connected to MongoDB');
    }
    catch (error) {
        console.error('❌ Worker MongoDB connection error:', error);
        throw error;
    }
}
async function disconnectFromDatabase() {
    if (!isConnected) {
        return;
    }
    try {
        await mongoose_1.default.disconnect();
        isConnected = false;
        console.log('👋 Worker disconnected from MongoDB');
    }
    catch (error) {
        console.error('❌ Worker MongoDB disconnect error:', error);
    }
}
