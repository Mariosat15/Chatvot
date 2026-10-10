/**
 * Multi-tab presence bookkeeping (browser-only).
 *
 * sessionStorage holds a stable tab id for this document (survives React Strict
 * Mode remounts). localStorage holds every open app tab's last touch time so
 * closing one tab does not mark the user offline while another stays open.
 */

export const PRESENCE_TAB_ID_KEY = "chartvolt_presence_tab_id";
export const PRESENCE_TABS_KEY = "chartvolt_presence_tabs_v1";

export function getOrCreateTabId(): string {
  try {
    const existing = sessionStorage.getItem(PRESENCE_TAB_ID_KEY);
    if (existing && existing.length > 0) return existing;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `tab_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(PRESENCE_TAB_ID_KEY, id);
    return id;
  } catch {
    return `tab_${Date.now()}`;
  }
}

function readTabs(): Map<string, number> {
  const out = new Map<string, number>();
  try {
    const raw = localStorage.getItem(PRESENCE_TABS_KEY);
    if (!raw) return out;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return out;
    }
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "number" && Number.isFinite(value)) {
        out.set(key, value);
      }
    }
  } catch {
    // ignore
  }
  return out;
}

function writeTabs(map: Map<string, number>): void {
  try {
    localStorage.setItem(
      PRESENCE_TABS_KEY,
      JSON.stringify(Object.fromEntries(map)),
    );
  } catch {
    // Private mode / quota — presence still works via heartbeat alone.
  }
}

/** Drop tabs that have not touched since maxAgeMs (crashed / killed tabs). */
export function prunePresenceTabs(
  map: Map<string, number> | Record<string, number>,
  nowMs: number,
  maxAgeMs: number,
): Map<string, number> {
  const entries =
    map instanceof Map ? map.entries() : Object.entries(map);
  const next = new Map<string, number>();
  for (const [id, ts] of entries) {
    if (nowMs - ts < maxAgeMs) next.set(id, ts);
  }
  return next;
}

export function touchPresenceTab(tabId: string, nowMs = Date.now()): void {
  const map = prunePresenceTabs(readTabs(), nowMs, 10 * 60_000);
  map.set(tabId, nowMs);
  writeTabs(map);
}

/**
 * Remove this tab. Returns remaining open-tab count after prune.
 * Callers should send offline only when the count is 0.
 */
export function releasePresenceTab(
  tabId: string,
  maxAgeMs: number,
  nowMs = Date.now(),
): number {
  const map = readTabs();
  map.delete(tabId);
  const pruned = prunePresenceTabs(map, nowMs, maxAgeMs);
  writeTabs(pruned);
  return pruned.size;
}

export function countPresenceTabs(
  maxAgeMs: number,
  nowMs = Date.now(),
): number {
  return prunePresenceTabs(readTabs(), nowMs, maxAgeMs).size;
}
