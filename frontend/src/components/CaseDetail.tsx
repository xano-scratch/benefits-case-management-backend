import { useState } from "react";
import {
  ArrowRight,
  ClipboardCheck,
  FileWarning,
  Gavel,
  History,
  Loader2,
  Scale,
  UserRound,
} from "lucide-react";

import type {
  CaseDetail as CaseDetailData,
  CaseStatus,
  CheckStatus,
  CheckType,
  Role,
  WorkerRow,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { CheckBadge, OutcomeBadge, ProgramBadge, RoleBadge, StatusBadge } from "@/components/badges";
import { formatDateTime, formatDob, formatMoney } from "@/lib/format";

const REQUIRED_CHECKS: CheckType[] = ["income", "identity", "residency"];
// The legal next status for the generic advance action, mirroring the API's
// transition table. Closing is a determination, and an appeal is its own action.
const LEGAL_NEXT: Partial<Record<CaseStatus, CaseStatus>> = {
  received: "verifying",
  verifying: "determination",
  appeal: "determination",
};
const CHECK_LABEL: Record<CheckType, string> = {
  income: "Income",
  identity: "Identity",
  residency: "Residency",
};

function actorName(staffById: Map<number, WorkerRow>, actorId: number | null | undefined): string {
  if (actorId == null || Number(actorId) === 0) return "System";
  return staffById.get(Number(actorId))?.name ?? `User #${actorId}`;
}

export function CaseDetail({
  detail,
  role,
  onAdvance,
  onRecord,
  onDecide,
  onAppeal,
}: {
  detail: CaseDetailData;
  role: Role;
  onAdvance: (to: CaseStatus, reason: string) => Promise<void>;
  onRecord: (type: CheckType, status: CheckStatus, note: string) => Promise<void>;
  onDecide: () => Promise<void>;
  onAppeal: (reason: string) => Promise<void>;
}) {
  const kase = detail.case;
  const status = (kase?.status ?? "received") as CaseStatus;

  const [advanceTo, setAdvanceTo] = useState<CaseStatus>(LEGAL_NEXT[status] ?? "verifying");
  const [advanceReason, setAdvanceReason] = useState("Advancing the case.");
  const [vType, setVType] = useState<CheckType>("income");
  const [vStatus, setVStatus] = useState<CheckStatus>("verified");
  const [vNote, setVNote] = useState("");
  const [appealReason, setAppealReason] = useState("Applicant appealed the determination.");
  const [busy, setBusy] = useState<string>("");

  if (!kase) return null;

  const staffById = new Map<number, WorkerRow>(
    (detail.staff ?? []).map((w) => [Number(w.id), w]),
  );
  const applicant = detail.applicant;
  const latest = detail.determinations?.[0] ?? null;
  const canAppeal = status === "closed" && latest?.outcome === "denied";

  async function run(kind: string, fn: () => Promise<void>) {
    setBusy(kind);
    try {
      await fn();
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            {applicant?.full_name ?? "Unknown applicant"}
          </h2>
          <div className="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
            <span>Case #{Number(kase.id)}</span>
            <ProgramBadge program={kase.program} />
          </div>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* Determination — the governed result, shown first once one exists. */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Scale className="size-4" /> Determination
          </CardTitle>
        </CardHeader>
        <CardContent>
          {latest ? (
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <OutcomeBadge outcome={String(latest.outcome)} />
                <span className="text-muted-foreground text-xs">
                  Decided by rule version{" "}
                  <code className="bg-muted rounded px-1 py-0.5">{latest.rule_version}</code>
                </span>
              </div>
              <p className="text-muted-foreground">{latest.reason}</p>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              No determination yet. A supervisor runs the eligibility rule once the case reaches
              determination.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Applicant summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserRound className="size-4" /> Applicant
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <Field label="Date of birth" value={formatDob(applicant?.dob)} />
          <Field label="Household size" value={String(applicant?.household_size ?? "—")} />
          <Field label="Monthly income" value={formatMoney(applicant?.income_monthly)} />
          <Field label="Contact email" value={applicant?.contact_email ?? "—"} />
          <Field label="Assigned to" value={actorName(staffById, kase.assigned_to)} />
          <Field label="Opened reason" value={kase.opened_reason ?? "—"} />
        </CardContent>
      </Card>

      {/* Verification checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardCheck className="size-4" /> Verification checklist
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {REQUIRED_CHECKS.map((t) => {
            const check = detail.verifications?.find((v) => v.type === t);
            return (
              <div
                key={t}
                className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
              >
                <div>
                  <div className="text-sm font-medium">{CHECK_LABEL[t]}</div>
                  {check?.note ? (
                    <div className="text-muted-foreground text-xs">{check.note}</div>
                  ) : null}
                </div>
                {check ? (
                  <CheckBadge status={check.status} />
                ) : (
                  <span className="text-muted-foreground text-xs">Not recorded</span>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Gavel className="size-4" /> Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <p className="text-muted-foreground text-xs">
            Every action is enforced at the API by the caller's role, not hidden in the UI. You are
            signed in as <RoleBadge role={role} />. A move your role may not make is refused with a
            clear error.
          </p>

          {/* Advance (state machine) */}
          {status !== "closed" ? (
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Advance the case</Label>
              <div className="flex flex-wrap items-end gap-2">
                <Select
                  aria-label="Target status"
                  className="w-44"
                  value={advanceTo}
                  onChange={(e) => setAdvanceTo(e.target.value as CaseStatus)}
                >
                  {(["received", "verifying", "determination", "appeal", "closed"] as CaseStatus[]).map(
                    (s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ),
                  )}
                </Select>
                <Input
                  aria-label="Transition reason"
                  className="min-w-52 flex-1"
                  value={advanceReason}
                  onChange={(e) => setAdvanceReason(e.target.value)}
                  placeholder="Reason for the move"
                />
                <Button
                  disabled={busy !== ""}
                  onClick={() => run("advance", () => onAdvance(advanceTo, advanceReason))}
                >
                  {busy === "advance" ? <Loader2 className="animate-spin" /> : <ArrowRight />}
                  Advance
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">
                Only allowed moves go through (received → verifying → determination; appeal →
                determination). Closing happens through a determination, not here. An illegal move
                (for example received → closed) is refused by the API.
              </p>
            </div>
          ) : null}

          {/* Record a verification */}
          {status === "verifying" ? (
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Record a verification</Label>
              <div className="flex flex-wrap items-end gap-2">
                <Select
                  aria-label="Check type"
                  className="w-36"
                  value={vType}
                  onChange={(e) => setVType(e.target.value as CheckType)}
                >
                  {REQUIRED_CHECKS.map((t) => (
                    <option key={t} value={t}>
                      {CHECK_LABEL[t]}
                    </option>
                  ))}
                </Select>
                <Select
                  aria-label="Result"
                  className="w-36"
                  value={vStatus}
                  onChange={(e) => setVStatus(e.target.value as CheckStatus)}
                >
                  <option value="verified">verified</option>
                  <option value="failed">failed</option>
                  <option value="pending">pending</option>
                </Select>
                <Input
                  aria-label="Note"
                  className="min-w-40 flex-1"
                  value={vNote}
                  onChange={(e) => setVNote(e.target.value)}
                  placeholder="Note (optional)"
                />
                <Button
                  variant="secondary"
                  disabled={busy !== ""}
                  onClick={() => run("record", () => onRecord(vType, vStatus, vNote))}
                >
                  {busy === "record" ? <Loader2 className="animate-spin" /> : null}
                  Record
                </Button>
              </div>
            </div>
          ) : null}

          {/* Run the determination */}
          {status === "determination" || status === "appeal" ? (
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Run the eligibility rule</Label>
              <div>
                <Button disabled={busy !== ""} onClick={() => run("decide", onDecide)}>
                  {busy === "decide" ? <Loader2 className="animate-spin" /> : <Scale />}
                  Make determination
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">
                Runs the shared, versioned rule (all checks verified, income within the household
                limit) and closes the case on the outcome. Supervisors only.
              </p>
            </div>
          ) : null}

          {/* File an appeal */}
          {canAppeal ? (
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">File an appeal</Label>
              <div className="flex flex-wrap items-end gap-2">
                <Input
                  aria-label="Appeal reason"
                  className="min-w-52 flex-1"
                  value={appealReason}
                  onChange={(e) => setAppealReason(e.target.value)}
                  placeholder="Reason for the appeal"
                />
                <Button
                  variant="outline"
                  disabled={busy !== ""}
                  onClick={() => run("appeal", () => onAppeal(appealReason))}
                >
                  {busy === "appeal" ? <Loader2 className="animate-spin" /> : <FileWarning />}
                  File appeal
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">
                A denied, closed case can be appealed. It moves back to appeal, where a supervisor
                can re-run the determination or uphold it.
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Audit trail */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="size-4" /> Audit trail
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="flex flex-col gap-3">
            {(detail.events ?? []).map((e) => (
              <li key={Number(e.id)} className="border-border relative border-l pl-4">
                <span className="bg-primary absolute -left-[5px] top-1.5 size-2.5 rounded-full" />
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium capitalize">{String(e.event_type)}</span>
                  {e.from_status || e.to_status ? (
                    <span className="text-muted-foreground text-xs">
                      {e.from_status ? `${e.from_status} ` : ""}→ {e.to_status || "—"}
                    </span>
                  ) : null}
                  <span className="text-muted-foreground text-xs">{formatDateTime(e.created_at)}</span>
                </div>
                <div className="text-muted-foreground mt-0.5 text-xs">
                  {actorName(staffById, e.actor_id)} ({String(e.actor_role)})
                </div>
                {e.reason ? <p className="mt-0.5 text-sm">{e.reason}</p> : null}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
