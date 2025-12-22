'use server';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllUsersForNewsEmail = void 0;
const mongoose_1 = require("@/database/mongoose");
const getAllUsersForNewsEmail = async () => {
    try {
        const mongoose = await (0, mongoose_1.connectToDatabase)();
        const db = mongoose.connection.db;
        if (!db)
            throw new Error('Mongoose connection not connected');
        const users = await db.collection('user').find({ email: { $exists: true, $ne: null } }, { projection: { _id: 1, id: 1, email: 1, name: 1, country: 1 } }).toArray();
        return users.filter((user) => user.email && user.name).map((user) => ({
            id: user.id || user._id?.toString() || '',
            email: user.email,
            name: user.name
        }));
    }
    catch (e) {
        console.error('Error fetching users for news email:', e);
        return [];
    }
};
exports.getAllUsersForNewsEmail = getAllUsersForNewsEmail;
