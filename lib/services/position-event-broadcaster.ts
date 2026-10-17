/**
 * Position Event Broadcaster (Shared Global Poller)
 *
 * Instead of each SSE connection independently polling MongoDB (N queries per interval),
 * this broadcaster runs a SINGLE shared poll that fetches ALL new position events,
 * then fans them out to connected subscribers in-memory.
 *
 * With 5,000 clients: 5,000 queries/3s → 1 query/3s (5,000x reduction)
 *
 * The positionevents collection has a 60-second TTL, so it stays tiny.
 * One query scanning a few dozen documents is negligible.
 */

import PositionEvent from "@/database/models/position-event.model";
import { connectToDatabase } from "@/database/mongoose";

type EventCallback = (events: any[]) => void;

interface Subscriber {
  userId: string;
  competitionId: string;
  callback: EventCallback;
}

class PositionEventBroadcaster {
  private subscribers = new Map<string, Subscriber>();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private lastCheckedAt = new Date(Date.now() - 60_000);
  private isPolling = false;

  /** Add a subscriber. Starts polling if this is the first. */
  subscribe(id: string, userId: string, competitionId: string, callback: EventCallback): void {
    this.subscribers.set(id, { userId, competitionId, callback });
    if (!this.pollTimer) {
      this.startPolling();
    }
  }

  /** Remove a subscriber. Stops polling if none left. */
  unsubscribe(id: string): void {
    this.subscribers.delete(id);
    if (this.subscribers.size === 0) {
      this.stopPolling();
    }
  }

  /** Number of active subscribers (for monitoring) */
  get subscriberCount(): number {
    return this.subscribers.size;
  }

  private startPolling(): void {
    this.lastCheckedAt = new Date(Date.now() - 60_000);
    // Poll every 3 seconds — but only ONE query for ALL subscribers
    this.pollTimer = setInterval(() => this.poll(), 3000);
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private async poll(): Promise<void> {
    // Prevent overlapping polls if a query is slow
    if (this.isPolling) return;
    this.isPolling = true;

    try {
      await connectToDatabase();

      // ONE query for ALL users — collection is tiny (60s TTL)
      const events = await PositionEvent.find({
        createdAt: { $gt: this.lastCheckedAt },
      })
        .sort({ createdAt: 1 }) // Oldest first for chronological delivery
        .limit(500) // Safety cap
        .lean();

      if (events.length === 0) return;

      // Advance global cursor to newest event
      const newest = events[events.length - 1] as any;
      if (newest.createdAt > this.lastCheckedAt) {
        this.lastCheckedAt = newest.createdAt;
      }

      // Group events by "userId:competitionId" key
      const grouped = new Map<string, any[]>();
      for (const event of events) {
        const e = event as any;
        const key = `${e.userId}:${e.competitionId}`;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(e);
      }

      // Fan out: deliver only matching events to each subscriber
      for (const [, sub] of this.subscribers) {
        const key = `${sub.userId}:${sub.competitionId}`;
        const matching = grouped.get(key);
        if (matching && matching.length > 0) {
          try {
            sub.callback(matching);
          } catch {
            // Subscriber's stream likely closed — will be cleaned up by unsubscribe
          }
        }
      }
    } catch (error) {
      console.error("[SSE Broadcaster] Poll error:", error);
    } finally {
      this.isPolling = false;
    }
  }
}

// Singleton — survives Next.js hot-reloads in development
const globalForBroadcaster = globalThis as typeof globalThis & {
  __positionEventBroadcaster?: PositionEventBroadcaster;
};

if (!globalForBroadcaster.__positionEventBroadcaster) {
  globalForBroadcaster.__positionEventBroadcaster = new PositionEventBroadcaster();
}

export const positionEventBroadcaster = globalForBroadcaster.__positionEventBroadcaster;
