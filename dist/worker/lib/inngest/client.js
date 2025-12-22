"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inngest = void 0;
exports.createInngestClient = createInngestClient;
const inngest_1 = require("inngest");
// Main Inngest client
// Note: Event key can be set via INNGEST_EVENT_KEY env var or database
exports.inngest = new inngest_1.Inngest({
    id: 'chatvolt',
    eventKey: process.env.INNGEST_EVENT_KEY, // Optional: for sending events to Inngest Cloud
});
/**
 * Create an Inngest client with custom event key (for database credentials)
 */
function createInngestClient(eventKey) {
    return new inngest_1.Inngest({
        id: 'chatvolt',
        eventKey: eventKey || process.env.INNGEST_EVENT_KEY,
    });
}
