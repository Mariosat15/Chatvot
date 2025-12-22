"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyAdminAuth = verifyAdminAuth;
exports.requireAdminAuth = requireAdminAuth;
exports.getAdminSession = getAdminSession;
const jose_1 = require("jose");
const headers_1 = require("next/headers");
const mongoose_1 = require("@/database/mongoose");
const admin_model_1 = require("@/database/models/admin.model");
const SECRET_KEY = new TextEncoder().encode(process.env.ADMIN_JWT_SECRET || 'your-super-secret-admin-key-change-in-production');
async function verifyAdminAuth() {
    try {
        // Try cookie-based auth first
        const cookieStore = await (0, headers_1.cookies)();
        let token = cookieStore.get('admin_token')?.value;
        // If no cookie, try Bearer token from Authorization header
        if (!token) {
            const headersList = await (0, headers_1.headers)();
            const authHeader = headersList.get('authorization');
            if (authHeader?.startsWith('Bearer ')) {
                token = authHeader.substring(7);
            }
        }
        if (!token) {
            return { isAuthenticated: false };
        }
        const { payload } = await (0, jose_1.jwtVerify)(token, SECRET_KEY);
        // Fetch admin name from database
        let adminName = 'Admin';
        try {
            await (0, mongoose_1.connectToDatabase)();
            const admin = await admin_model_1.Admin.findById(payload.adminId).select('name').lean();
            if (admin?.name) {
                adminName = admin.name;
            }
        }
        catch (dbError) {
            console.error('Error fetching admin name:', dbError);
        }
        return {
            isAuthenticated: true,
            adminId: payload.adminId,
            email: payload.email,
            name: adminName,
        };
    }
    catch {
        return { isAuthenticated: false };
    }
}
async function requireAdminAuth() {
    const auth = await verifyAdminAuth();
    if (!auth.isAuthenticated) {
        throw new Error('Unauthorized');
    }
    return auth;
}
/**
 * Get current admin session info (returns null if not authenticated)
 */
async function getAdminSession() {
    try {
        const auth = await verifyAdminAuth();
        if (!auth.isAuthenticated || !auth.adminId || !auth.email) {
            return null;
        }
        return {
            id: auth.adminId,
            email: auth.email,
            name: auth.name,
        };
    }
    catch {
        return null;
    }
}
