/**
 * Model-free browse types + page size — safe for client components (R58).
 */

export const COMPETITIONS_PAGE_SIZE = 10;

export type BrowseSort =
  | "featured"
  | "newest"
  | "start"
  | "prize"
  | "participants"
  | "entry";

export interface BrowseCompetitionsResult {
  items: Array<Record<string, unknown>>;
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  kpis: {
    liveNow: number;
    startingSoon: number;
    totalPrizePool: number;
  };
  userInCompetitionIds: string[];
}
