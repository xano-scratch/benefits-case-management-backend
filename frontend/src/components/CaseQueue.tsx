import { Users } from "lucide-react";

import type { ApplicantRow, CaseRow, CaseStatus, WorkerRow } from "@/lib/api";
import { ProgramBadge, StatusBadge } from "@/components/badges";

const FILTERS: { key: CaseStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "received", label: "Received" },
  { key: "verifying", label: "Verifying" },
  { key: "determination", label: "Determination" },
  { key: "appeal", label: "Appeal" },
  { key: "closed", label: "Closed" },
];

export function CaseQueue({
  cases,
  applicantsById,
  workersById,
  selectedId,
  statusFilter,
  onStatusFilter,
  onSelect,
}: {
  cases: CaseRow[];
  applicantsById: Map<number, ApplicantRow>;
  workersById: Map<number, WorkerRow>;
  selectedId: number | null;
  statusFilter: CaseStatus | "all";
  onStatusFilter: (s: CaseStatus | "all") => void;
  onSelect: (id: number) => void;
}) {
  return (
    <div className="flex flex-col">
      <div className="mb-3 flex flex-wrap gap-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => onStatusFilter(f.key)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              statusFilter === f.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {cases.length === 0 ? (
        <div className="text-muted-foreground rounded-lg border border-dashed py-10 text-center text-sm">
          No cases in this view.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {cases.map((c) => {
            const id = Number(c.id);
            const applicant = applicantsById.get(Number(c.applicant_id));
            const worker = c.assigned_to == null ? null : workersById.get(Number(c.assigned_to));
            return (
              <button
                key={id}
                onClick={() => onSelect(id)}
                className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                  selectedId === id
                    ? "border-primary bg-accent"
                    : "hover:border-primary/40 hover:bg-accent/40"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    {applicant?.full_name ?? "Unknown applicant"}
                  </span>
                  <StatusBadge status={c.status} />
                </div>
                <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <span>Case #{id}</span>
                  <ProgramBadge program={c.program} />
                  <span className="inline-flex items-center gap-1">
                    <Users className="size-3" />
                    {worker ? worker.name : "Unassigned"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
