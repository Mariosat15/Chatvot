/**
 * Playful, data-agnostic copy for the competition lobby.
 *
 * ONE MODULE FOR BOTH LOBBIES so a wording pass cannot leave trading dry and games playful
 * (or the other way round). Kind is `"trading" | "game"` — never a game code, never a
 * provider key — because naming a title here is the failure mode of the no-developer-needed
 * claim.
 */

export type ContestLobbyKind = "trading" | "game";

export interface ContestHowItStep {
  title: string;
  detail: string;
}

export interface ContestFeature {
  title: string;
  detail: string;
}

const HOW_IT_WORKS = new Map<ContestLobbyKind, ContestHowItStep[]>([
  [
    "game",
    [
      {
        title: "Jump in",
        detail: "Grab your seat, pay the entry (if any), and you're on the board.",
      },
      {
        title: "Play your round",
        detail: "Hit Play when you're ready and give it your best shot.",
      },
      {
        title: "Climb the board",
        detail: "Every solid run moves you up. Watch the live standings.",
      },
      {
        title: "Take the pot",
        detail: "Top finishers split the prize pool when the clock hits zero.",
      },
    ],
  ],
  [
    "trading",
    [
      {
        title: "Jump in",
        detail: "Reserve your seat and get your trading capital ready.",
      },
      {
        title: "Trade live",
        detail: "Open the terminal and trade the markets for this arena.",
      },
      {
        title: "Climb the ranks",
        // Reason: ranking method is per-contest (pnl / roi / win rate…). Never claim P&L here;
        // the live Overview uses `buildTradingOverviewCopy` from the stored rule.
        detail: "Climb by this contest's ranking rule — every move counts.",
      },
      {
        title: "Take the pot",
        detail: "Top traders share the prize when the contest wraps.",
      },
    ],
  ],
]);

const FEATURES = new Map<ContestLobbyKind, ContestFeature[]>([
  [
    "game",
    [
      { title: "Live standings", detail: "See who's ahead as scores land." },
      { title: "Skill wins", detail: "No luck packs — play well, place well." },
      { title: "Fair prizes", detail: "The pot splits by the prize table." },
      { title: "Same rules for all", detail: "Everyone plays the same challenge." },
    ],
  ],
  [
    "trading",
    [
      { title: "Live markets", detail: "Trade real price action in the arena." },
      { title: "Global rivals", detail: "Compete with traders worldwide." },
      {
        title: "Climb for glory",
        detail: "Rank by this contest's scoring rule — prove your edge.",
      },
      { title: "Prize drops", detail: "Top spots take home the Volts." },
    ],
  ],
]);

const OVERVIEW_TITLE = new Map<ContestLobbyKind, string>([
  ["game", "The lowdown"],
  ["trading", "The lowdown"],
]);

const HOW_TITLE = new Map<ContestLobbyKind, string>([
  ["game", "Game plan"],
  ["trading", "Battle plan"],
]);

const ABOUT_FALLBACK = new Map<ContestLobbyKind, string>([
  [
    "game",
    "Jump in, play your best, and climb the board. Top finishers share the prize when the clock runs out.",
  ],
  [
    "trading",
    "Enter the arena, trade live markets, and climb the ranks. Top traders share the prize when the contest ends.",
  ],
]);

export function contestHowItWorks(kind: ContestLobbyKind): ContestHowItStep[] {
  return HOW_IT_WORKS.get(kind) ?? HOW_IT_WORKS.get("game")!;
}

export function contestFeatures(kind: ContestLobbyKind): ContestFeature[] {
  return FEATURES.get(kind) ?? FEATURES.get("game")!;
}

export function contestOverviewTitle(kind: ContestLobbyKind): string {
  return OVERVIEW_TITLE.get(kind) ?? "The lowdown";
}

export function contestHowTitle(kind: ContestLobbyKind): string {
  return HOW_TITLE.get(kind) ?? "Game plan";
}

export function contestAboutFallback(kind: ContestLobbyKind): string {
  return ABOUT_FALLBACK.get(kind) ?? ABOUT_FALLBACK.get("game")!;
}

export function contestPlayersLabel(kind: ContestLobbyKind): string {
  return kind === "trading" ? "Traders" : "Players joined";
}

export function contestModeLabel(kind: ContestLobbyKind): string {
  return kind === "trading" ? "Trading" : "Competition";
}

export function contestNotInTitle(kind: ContestLobbyKind): string {
  return kind === "trading"
    ? "You're not in yet"
    : "You're not registered yet";
}

export function contestNotInDetail(kind: ContestLobbyKind): string {
  return kind === "trading"
    ? "Jump in now and compete for the pot!"
    : "Join now and compete for exclusive rewards!";
}
