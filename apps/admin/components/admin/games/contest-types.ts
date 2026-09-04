import type { ConfigField } from "@/lib/services/games/config-schema";

/**
 * What the wizard needs to know about a title it can run a contest on.
 *
 * Mirrors `ProviderContestOption` from the service, declared separately because this one
 * crosses to the browser: the service type is free to grow server-only fields, and a
 * client component importing it would drag them along.
 */
export interface ContestableTitle {
  providerKey: string;
  providerName: string;
  gameCode: string;
  gameKey: string;
  displayName: string;
  family: string;
  scoreDirection: string;
  scoreType: string;
  maxDurationSeconds?: number;
  supportsCompetition: boolean;
  supportsOneVsOne: boolean;
  schema: { ok: true; fields: ConfigField[] } | { ok: false; error: string };
}
