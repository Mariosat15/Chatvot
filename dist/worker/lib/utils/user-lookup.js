"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserById = getUserById;
exports.getAllUsers = getAllUsers;
exports.getUsersByIds = getUsersByIds;
const mongoose_1 = require("@/database/mongoose");
const cache_1 = require("./cache");
// Projection to only fetch fields we need (reduces data transfer)
const USER_PROJECTION = {
    id: 1,
    _id: 1,
    email: 1,
    name: 1,
    profileImage: 1,
    bio: 1,
    role: 1,
    country: 1,
    address: 1,
    city: 1,
    postalCode: 1,
};
/**
 * Get user information from better-auth user collection by userId
 * Users are stored in a native MongoDB 'user' collection by better-auth
 *
 * PERFORMANCE: Uses LRU cache with 30s TTL to avoid repeated DB queries
 * Cache hit: ~0.1ms | Cache miss: ~50-100ms
 */
async function getUserById(userId) {
    if (!userId)
        return null;
    const cacheKey = `user:${userId}`;
    // Check cache first
    const cached = cache_1.userCache.get(cacheKey);
    if (cached) {
        return cached;
    }
    try {
        const mongoose = await (0, mongoose_1.connectToDatabase)();
        const db = mongoose.connection.db;
        if (!db) {
            console.error('Database connection not found');
            return null;
        }
        // Try finding by 'id' field first (better-auth uses this)
        // PERFORMANCE: Use projection to only fetch needed fields
        let user = await db.collection('user').findOne({ id: userId }, { projection: USER_PROJECTION });
        // If not found, try by _id as ObjectId
        if (!user) {
            try {
                const { ObjectId } = await Promise.resolve().then(() => __importStar(require('mongodb')));
                if (ObjectId.isValid(userId)) {
                    user = await db.collection('user').findOne({ _id: new ObjectId(userId) }, { projection: USER_PROJECTION });
                }
            }
            catch {
                // Not a valid ObjectId, skip
            }
        }
        // If still not found, try as string _id
        if (!user) {
            user = await db.collection('user').findOne({ _id: userId }, { projection: USER_PROJECTION });
        }
        if (!user) {
            return null;
        }
        const userInfo = {
            id: user.id || user._id?.toString() || userId,
            email: user.email || 'unknown',
            name: user.name || user.email || 'Unknown User',
            profileImage: user.profileImage,
            bio: user.bio,
            role: user.role || 'trader',
            country: user.country,
            address: user.address,
            city: user.city,
            postalCode: user.postalCode,
        };
        // Cache the result
        cache_1.userCache.set(cacheKey, userInfo);
        return userInfo;
    }
    catch (error) {
        console.error('Error fetching user:', error);
        return null;
    }
}
/**
 * Get ALL traders from the database (only users with role='trader' or no role set)
 * Identifies traders by EMAIL and ROLE field (not by name)
 * Returns an array of all trader users, deduplicated by email
 */
async function getAllUsers() {
    try {
        const mongoose = await (0, mongoose_1.connectToDatabase)();
        const db = mongoose.connection.db;
        if (!db) {
            console.error('Database connection not found');
            return [];
        }
        // Get admin email to exclude it
        const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase() || '';
        // Get ONLY traders - filter by ROLE field (the proper way to identify user types)
        // Include: role='trader', no role field (legacy), null role
        // Exclude: role='admin', role='backoffice'
        const users = await db.collection('user').find({
            $and: [
                // Must have email
                { email: { $exists: true, $ne: null } },
                { email: { $nin: [''] } },
                // Role filter - only traders
                {
                    $or: [
                        { role: 'trader' }, // Explicitly set as trader
                        { role: { $exists: false } }, // No role field = legacy user, treat as trader
                        { role: null }, // Null role = treat as trader
                    ]
                },
                // Exclude admin email (extra safety check)
                ...(adminEmail ? [{ email: { $ne: adminEmail } }] : [])
            ]
        }).toArray();
        // Deduplicate by EMAIL (not by name) - email is the unique identifier
        const uniqueUsersMap = new Map();
        for (const user of users) {
            const id = user.id || user._id?.toString() || '';
            const email = user.email?.toLowerCase() || '';
            if (!id || !email)
                continue;
            // Skip if we already have this user by email (dedupe by email)
            if (uniqueUsersMap.has(email))
                continue;
            // Double-check role: skip if explicitly set to non-trader
            const role = user.role || 'trader'; // Default to trader if no role
            if (role !== 'trader')
                continue;
            // Skip admin email (extra safety)
            if (adminEmail && email === adminEmail)
                continue;
            uniqueUsersMap.set(email, {
                id,
                email,
                name: user.name || email.split('@')[0] || 'Unknown User', // Name is for display only
                profileImage: user.profileImage,
                bio: user.bio,
                role: 'trader',
                country: user.country,
                address: user.address,
                city: user.city,
                postalCode: user.postalCode,
            });
        }
        return Array.from(uniqueUsersMap.values());
    }
    catch (error) {
        console.error('Error fetching all users:', error);
        return [];
    }
}
/**
 * Get multiple users by their IDs
 * Returns a Map keyed by the original userIds passed in
 */
async function getUsersByIds(userIds) {
    const userMap = new Map();
    try {
        const mongoose = await (0, mongoose_1.connectToDatabase)();
        const db = mongoose.connection.db;
        if (!db) {
            console.error('Database connection not found');
            return userMap;
        }
        const { ObjectId } = await Promise.resolve().then(() => __importStar(require('mongodb')));
        // Process each userId individually to ensure correct key mapping
        for (const originalId of userIds) {
            if (userMap.has(originalId))
                continue; // Already found
            let user = null;
            // Try finding by 'id' field first (better-auth uses this)
            user = await db.collection('user').findOne({ id: originalId });
            // If not found, try by _id as ObjectId
            if (!user && ObjectId.isValid(originalId)) {
                try {
                    user = await db.collection('user').findOne({ _id: new ObjectId(originalId) });
                }
                catch {
                    // Not a valid ObjectId, skip
                }
            }
            // If still not found, try as string _id
            if (!user) {
                user = await db.collection('user').findOne({ _id: originalId });
            }
            if (user) {
                // Key by the ORIGINAL id that was passed in, so lookups work
                userMap.set(originalId, {
                    id: user.id || user._id?.toString() || originalId,
                    email: user.email || 'unknown',
                    name: user.name || user.email || 'Unknown User',
                    role: user.role || 'trader',
                    country: user.country,
                    address: user.address,
                    city: user.city,
                    postalCode: user.postalCode,
                });
            }
        }
        return userMap;
    }
    catch (error) {
        console.error('Error fetching users:', error);
        return userMap;
    }
}
