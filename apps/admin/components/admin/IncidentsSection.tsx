"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Search } from "lucide-react";
import IncidentResolutionModal from "./IncidentResolutionModal";
import IncidentDetailPanel from "./incidents/IncidentDetailPanel";
import IncidentList from "./incidents/IncidentList";
import LiveOperationsBoard from "./incidents/LiveOperationsBoard";
import RaiseIncidentDialog from "./incidents/RaiseIncidentDialog";
import RemediationDialog from "./incidents/RemediationDialog";
import type { IncidentRecord, LiveSubject } from "./incidents/types";

type HubTab = "live" | "open" | "all";

const STATUS_FILTERS = [
  { id: "all", label: "Any status" },
  { id: "open", label: "Open" },
  { id: "investigating", label: "Investigating" },
  { id: "resolved", label: "Resolved" },
  { id: "rejected", label: "Rejected" },
] as const;

const SEVERITY_FILTERS = [
  { id: "all", label: "Any severity" },
  { id: "critical", label: "Critical" },
  { id: "high", label: "High" },
  { id: "medium", label: "Medium" },
  { id: "low", label: "Low" },
] as const;

const SUBJECT_FILTERS = [
  { id: "all", label: "Any subject" },
  { id: "competition", label: "Contest" },
  { id: "challenge", label: "Challenge" },
  { id: "round", label: "Round" },
] as const;

function isOpenStatus(status: string): boolean {
  return status === "open" || status === "investigating";
}

export default function IncidentsSection() {
  const [tab, setTab] = useState<HubTab>("live");
  const [subjects, setSubjects] = useState<LiveSubject[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(true);
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [incidentsLoading, setIncidentsLoading] = useState(true);
  const [selected, setSelected] = useState<IncidentRecord | null>(null);
  const [raiseSubject, setRaiseSubject] = useState<LiveSubject | null>(null);
  const [remediate, setRemediate] = useState(false);
  const [refund, setRefund] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<(typeof STATUS_FILTERS)[number]["id"]>("all");
  const [severityFilter, setSeverityFilter] =
    useState<(typeof SEVERITY_FILTERS)[number]["id"]>("all");
  const [subjectFilter, setSubjectFilter] =
    useState<(typeof SUBJECT_FILTERS)[number]["id"]>("all");

  const loadSubjects = useCallback(async () => {
    setSubjectsLoading(true);
    try {
      const response = await fetch("/api/incidents/subjects");
      const body = await response.json();
      setSubjects(response.ok ? body.subjects ?? [] : []);
    } finally {
      setSubjectsLoading(false);
    }
  }, []);

  const loadIncidents = useCallback(async () => {
    setIncidentsLoading(true);
    try {
      const response = await fetch("/api/incidents?limit=100");
      const body = await response.json();
      if (!response.ok) return;
      const rows = (body.incidents ?? []) as IncidentRecord[];
      setIncidents(rows);
      setSelected((current) => {
        if (!current) return rows.find((row) => isOpenStatus(row.status)) ?? rows[0] ?? null;
        return rows.find((row) => row._id === current._id) ?? rows[0] ?? null;
      });
    } finally {
      setIncidentsLoading(false);
    }
  }, []);

  const refreshSelected = useCallback(async (id: string) => {
    const response = await fetch(`/api/incidents/${id}`);
    const body = await response.json();
    if (response.ok && body.incident) {
      const incident = body.incident as IncidentRecord;
      setSelected(incident);
      setIncidents((rows) =>
        rows.map((row) => (row._id === incident._id ? incident : row)),
      );
    }
  }, []);

  const refreshAll = useCallback(() => {
    void loadSubjects();
    void loadIncidents();
  }, [loadSubjects, loadIncidents]);

  useEffect(() => {
    void loadSubjects();
    void loadIncidents();
  }, [loadSubjects, loadIncidents]);

  const filteredIncidents = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return incidents.filter((incident) => {
      if (tab === "open" && !isOpenStatus(incident.status)) return false;
      if (statusFilter !== "all" && incident.status !== statusFilter) return false;
      if (severityFilter !== "all" && incident.severity !== severityFilter) return false;
      if (subjectFilter !== "all" && incident.subjectType !== subjectFilter) return false;
      if (!needle) return true;
      const haystack = [
        incident.title,
        incident.description,
        incident.status,
        incident.severity,
        incident.subjectType,
        incident.gameKey,
        incident.roundId,
        incident.challengeId,
        incident.competitionId,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [incidents, tab, search, statusFilter, severityFilter, subjectFilter]);

  useEffect(() => {
    if (tab === "live") return;
    if (!selected || !filteredIncidents.some((row) => row._id === selected._id)) {
      setSelected(filteredIncidents[0] ?? null);
    }
  }, [tab, filteredIncidents, selected]);

  const openCount = incidents.filter((row) => isOpenStatus(row.status)).length;
  const providerContest =
    selected?.subjectType === "competition" &&
    Boolean(selected.gameKey && selected.gameKey.startsWith("provider:"));

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">Incident Management</h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-400">
            One place to find what needs a decision, raise an incident, apply a fix, and keep
            the reason with the outcome.
          </p>
        </div>
        <button
          type="button"
          onClick={refreshAll}
          className="inline-flex items-center gap-2 rounded-md border border-gray-600 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-800"
        >
          {subjectsLoading || incidentsLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh
        </button>
      </header>

      <div className="flex flex-wrap gap-2 border-b border-gray-800 pb-3">
        {(
          [
            { id: "live", label: `Live operations (${subjects.length})` },
            { id: "open", label: `Open incidents (${openCount})` },
            { id: "all", label: `All incidents (${incidents.length})` },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === item.id
                ? "bg-amber-500 text-gray-950"
                : "bg-gray-800 text-gray-300 hover:bg-gray-700"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "live" ? (
        <section className="space-y-3">
          <LiveOperationsBoard
            subjects={subjects}
            loading={subjectsLoading}
            onRaise={(subject) => {
              setRaiseSubject(subject);
            }}
          />
        </section>
      ) : (
        <section className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <label className="relative block w-full lg:max-w-sm">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search title, id, game…"
                className="w-full rounded-md border border-gray-700 bg-gray-950 py-2 pl-8 pr-3 text-sm text-gray-100 placeholder:text-gray-500"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as (typeof STATUS_FILTERS)[number]["id"])
                }
                className="rounded-md border border-gray-700 bg-gray-950 px-2 py-2 text-sm text-gray-100"
              >
                {STATUS_FILTERS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={severityFilter}
                onChange={(e) =>
                  setSeverityFilter(
                    e.target.value as (typeof SEVERITY_FILTERS)[number]["id"],
                  )
                }
                className="rounded-md border border-gray-700 bg-gray-950 px-2 py-2 text-sm text-gray-100"
              >
                {SEVERITY_FILTERS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={subjectFilter}
                onChange={(e) =>
                  setSubjectFilter(
                    e.target.value as (typeof SUBJECT_FILTERS)[number]["id"],
                  )
                }
                className="rounded-md border border-gray-700 bg-gray-950 px-2 py-2 text-sm text-gray-100"
              >
                {SUBJECT_FILTERS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {incidentsLoading ? (
            <p className="flex items-center gap-2 text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading incidents…
            </p>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-gray-500">
                  {filteredIncidents.length} shown
                </p>
                <IncidentList
                  incidents={filteredIncidents}
                  selectedId={selected?._id}
                  onSelect={setSelected}
                />
              </div>
              {selected ? (
                <IncidentDetailPanel
                  incident={selected}
                  onRemediate={() => setRemediate(true)}
                  onRefund={() => setRefund(true)}
                />
              ) : (
                <div className="rounded-xl border border-dashed border-gray-700 bg-gray-900/30 p-8 text-sm text-gray-400">
                  Select an incident from the list to see its history and apply a solution.
                </div>
              )}
            </div>
          )}
        </section>
      )}

      <RaiseIncidentDialog
        subject={raiseSubject}
        open={Boolean(raiseSubject)}
        onClose={() => setRaiseSubject(null)}
        onCreated={() => {
          void loadIncidents();
          setTab("open");
        }}
      />

      {selected ? (
        <RemediationDialog
          incidentId={selected._id}
          isProviderGame={providerContest || selected.subjectType === "round"}
          open={remediate}
          onClose={() => setRemediate(false)}
          onApplied={() => {
            void refreshSelected(selected._id);
          }}
        />
      ) : null}

      {selected ? (
        <IncidentResolutionModal
          incidentId={selected._id}
          isOpen={refund}
          onClose={() => setRefund(false)}
          onResolved={() => {
            void refreshSelected(selected._id);
          }}
          onRequestRemediation={() => {
            setRefund(false);
            setRemediate(true);
          }}
        />
      ) : null}
    </div>
  );
}
