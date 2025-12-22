"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasSeeded = void 0;
exports.seedNotificationTemplates = seedNotificationTemplates;
exports.checkAndSeedTemplates = checkAndSeedTemplates;
const mongoose_1 = require("@/database/mongoose");
const notification_template_model_1 = __importDefault(require("@/database/models/notification-template.model"));
let hasSeeded = false;
exports.hasSeeded = hasSeeded;
/**
 * Seed default notification templates if they don't exist
 * This is safe to call multiple times - it uses upsert
 */
async function seedNotificationTemplates() {
    // Only seed once per server instance
    if (hasSeeded) {
        return;
    }
    try {
        await (0, mongoose_1.connectToDatabase)();
        await notification_template_model_1.default.seedDefaults();
        exports.hasSeeded = hasSeeded = true;
        console.log('✅ Notification templates seeded');
    }
    catch (error) {
        console.error('❌ Error seeding notification templates:', error);
    }
}
/**
 * Check if templates need seeding
 */
async function checkAndSeedTemplates() {
    try {
        await (0, mongoose_1.connectToDatabase)();
        // Check if any templates exist
        const count = await notification_template_model_1.default.countDocuments();
        if (count === 0) {
            console.log('📋 No notification templates found, seeding defaults...');
            await notification_template_model_1.default.seedDefaults();
            exports.hasSeeded = hasSeeded = true;
        }
        else {
            exports.hasSeeded = hasSeeded = true;
        }
    }
    catch (error) {
        console.error('❌ Error checking notification templates:', error);
    }
}
