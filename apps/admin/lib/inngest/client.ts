import { Inngest } from "inngest";

// Main Inngest client
// Note: Event key can be set via INNGEST_EVENT_KEY env var or database
export const inngest = new Inngest({
    id: 'chatvolt',
    eventKey: process.env.INNGEST_EVENT_KEY, // Optional: for sending events to Inngest Cloud
});

/**
 * Create an Inngest client with custom event key (for database credentials)
 */
export function createInngestClient(eventKey?: string) {
    return new Inngest({
        id: 'chatvolt',
        eventKey: eventKey || process.env.INNGEST_EVENT_KEY,
    });
}
