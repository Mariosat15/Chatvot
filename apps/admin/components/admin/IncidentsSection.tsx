"use client";

import { useCallback, useEffect, useState } from "react";
import IncidentResolutionModal from "../IncidentResolutionModal";
import IncidentDetailPanel from "./IncidentDetailPanel";
import IncidentList from "./IncidentList";
import LiveOperationsBoard from "./LiveOperationsBoard";
import RaiseIncidentDialog from "./RaiseIncidentDialog";
import RemediationDialog from "./RemediationDialog";
import type { IncidentRecord, LiveSubject } from "./types";

export default function IncidentsSection() {
  const [subjects, setSubjects] = useState<LiveSubject[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(true);
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [selected, setSelected] = useState<IncidentRecord | null>(null);
  const [raiseSubject, setRaiseSubject] = useState<LiveSubject | null>(null);
  const [remediate, setRemediate] = useState(false);
  const [refund, setRefund] = useState(false);

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
    const response = await fetch("/api/incidents?limit=50");
    const body = await response.json();
    if (!response.ok) return;
    const rows = (body.incidents ?? []) as IncidentRecord[];
    setIncidents(rows);
    setSelected((current) => {
      if (!current) return rows[0] ?? null;
      return rows.find((row) => row._id === current._id) ?? rows[0] ?? null;
    });
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

  useEffect(() => {
    void loadSubjects();
    void loadIncidents();
  }, [loadSubjects, loadIncidents]);

  const providerContest =
    selected?.subjectType === "competition" &&
    Boolean(selected.gameKey && selected.gameKey.startsWith("provider:"));

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-2xl font-semibold text-white">Incident Management</h2>
        <p className="mt-1 max-w-2xl text-sm text-gray-400">
          One place to record what went wrong on a contest, a challenge or a
          round, pick a solution, and keep the reason with the outcome.
        </p>
      </header>

      <section className="space-y-3">
        <h3 className="text-lg font-medium text-white">Live operations</h3>
        <LiveOperationsBoard
          subjects={subjects}
          loading={subjectsLoading}
          onRaise={setRaiseSubject}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <IncidentList
          incidents={incidents}
          selectedId={selected?._id}
          onSelect={setSelected}
        />
        {selected ? (
          <IncidentDetailPanel
            incident={selected}
            onRemediate={() => setRemediate(true)}
            onRefund={() => setRefund(true)}
          />
        ) : (
          <p className="text-sm text-gray-400">Select an incident.</p>
        )}
      </section>

      <RaiseIncidentDialog
        subject={raiseSubject}
        open={Boolean(raiseSubject)}
        onClose={() => setRaiseSubject(null)}
        onCreated={() => {
          void loadIncidents();
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
