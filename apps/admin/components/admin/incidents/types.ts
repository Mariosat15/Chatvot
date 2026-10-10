export interface IncidentActionTaken {
  actionId: string;
  subjectType: string;
  subjectId: string;
  reason: string;
  outcome: "applied" | "refused" | "failed" | string;
  detail?: string;
  by?: string;
  byEmail?: string;
  at?: string;
}

export interface IncidentAuditEntry {
  timestamp: string;
  action: string;
  by: string;
  byEmail?: string;
  details: string;
}

export interface IncidentRecord {
  _id: string;
  competitionId?: string;
  challengeId?: string;
  roundId?: string;
  subjectType?: string;
  gameKey?: string;
  type: string;
  severity: string;
  status: string;
  title: string;
  description: string;
  affectedUsers?: string[];
  priority?: string;
  actionsTaken?: IncidentActionTaken[];
  auditLog?: IncidentAuditEntry[];
  createdAt?: string;
}

export interface LiveSubject {
  kind: "competition" | "challenge" | "round";
  id: string;
  name: string;
  status: string;
  badge: string;
  problem: string;
  gameKey?: string;
  isPaused: boolean;
  isProviderGame: boolean;
  contestId?: string;
}

export interface CatalogueAction {
  id: string;
  label: string;
  section: string;
  movesMoney: boolean;
  irreversible: boolean;
  consequences: string[];
}
