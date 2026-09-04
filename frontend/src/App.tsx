import { useCallback, useEffect, useState } from "react";
import { Landmark, Loader2, Plus, RotateCcw, ShieldCheck, X } from "lucide-react";

import type {
  ApplicantRow,
  CaseDetail as CaseDetailData,
  CaseStatus,
  CheckStatus,
  CheckType,
  IntakeBody,
  Queue,
  Role,
  SessionUser,
  WorkerRow,
} from "@/lib/api";
import {
  advanceCase,
  decideCase,
  fetchCase,
  fetchQueue,
  fileAppeal,
  intakeCase,
  login,
  recordVerification,
  seedDemoData,
  setToken,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { RoleBadge } from "@/components/badges";
import { CaseQueue } from "@/components/CaseQueue";
import { CaseDetail } from "@/components/CaseDetail";
import { IntakeForm } from "@/components/IntakeForm";

// The three seeded staff accounts. Switching signer is how the demo shows role
// based access control: a viewer cannot write, and the API enforces it, not the UI.
const DEMO_ACCOUNTS: Record<Role, { email: string; password: string; name: string }> = {
  caseworker: { email: "dana@agency.example", password: "caseworker-demo", name: "Dana Okafor" },
  supervisor: { email: "sam@agency.example", password: "supervisor-demo", name: "Sam Rivera" },
  viewer: { email: "val@agency.example", password: "viewer-demo", name: "Val Chen" },
};

// Deep links: `?as=<role>` picks the signer on boot, `?case=<id>` opens a case.
// Used for the marketing screenshot; harmless for a normal visitor.
const bootParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
const rawRole = bootParams?.get("as") ?? "";
const BOOT_ROLE: Role = rawRole in DEMO_ACCOUNTS ? (rawRole as Role) : "caseworker";
const rawCase = bootParams?.get("case");
const BOOT_CASE_ID = rawCase && !Number.isNaN(Number(rawCase)) ? Number(rawCase) : null;

export default function App() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [queue, setQueue] = useState<Queue | null>(null);
  const [statusFilter, setStatusFilter] = useState<CaseStatus | "all">("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<CaseDetailData | null>(null);
  const [showIntake, setShowIntake] = useState(false);
  const [loading, setLoading] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const role: Role = (user?.role as Role) ?? "caseworker";

  const loginAs = useCallback(async (r: Role) => {
    const creds = DEMO_ACCOUNTS[r];
    const res = await login({ email: creds.email, password: creds.password });
    setToken(res.authToken == null ? null : String(res.authToken));
    setUser(res.user);
  }, []);

  const loadQueue = useCallback(async (filter: CaseStatus | "all") => {
    const q = await fetchQueue(filter === "all" ? "" : filter);
    setQueue(q);
    return q;
  }, []);

  const loadDetail = useCallback(async (id: number) => {
    const d = await fetchCase(id);
    setDetail(d);
  }, []);

  useEffect(() => {
    let live = true;
    (async () => {
      setLoading(true);
      setBootError(null);
      try {
        try {
          await loginAs(BOOT_ROLE);
        } catch {
          // Fresh environment: seed it, then sign in.
          await seedDemoData();
          await loginAs(BOOT_ROLE);
        }
        const q = await loadQueue("all");
        if (!live) return;
        const pick =
          BOOT_CASE_ID != null && q.cases.some((c) => Number(c.id) === BOOT_CASE_ID)
            ? BOOT_CASE_ID
            : q.cases.length > 0
              ? Number(q.cases[0].id)
              : null;
        if (pick != null) {
          setSelectedId(pick);
          await loadDetail(pick);
        }
      } catch (err) {
        if (live) setBootError(err instanceof Error ? err.message : "Could not load the app.");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [loginAs, loadQueue, loadDetail]);

  async function changeFilter(f: CaseStatus | "all") {
    setStatusFilter(f);
    try {
      await loadQueue(f);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not load the queue.");
    }
  }

  async function selectCase(id: number) {
    setShowIntake(false);
    setSelectedId(id);
    setActionError(null);
    try {
      await loadDetail(id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not load the case.");
    }
  }

  async function switchRole(r: Role) {
    setActionError(null);
    try {
      await loginAs(r);
      await loadQueue(statusFilter);
      if (selectedId != null) await loadDetail(selectedId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not switch role.");
    }
  }

  async function reseed() {
    setActionError(null);
    setShowIntake(false);
    try {
      await seedDemoData();
      await loginAs(role);
      const q = await loadQueue(statusFilter);
      if (q.cases.length > 0) {
        const first = Number(q.cases[0].id);
        setSelectedId(first);
        await loadDetail(first);
      } else {
        setSelectedId(null);
        setDetail(null);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not reset the data.");
    }
  }

  // Refresh the queue and the open case after an action.
  const refresh = useCallback(async () => {
    await loadQueue(statusFilter);
    if (selectedId != null) await loadDetail(selectedId);
  }, [loadQueue, loadDetail, statusFilter, selectedId]);

  function guard<T extends unknown[]>(fn: (...args: T) => Promise<unknown>) {
    return async (...args: T) => {
      setActionError(null);
      try {
        await fn(...args);
        await refresh();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "The action could not be completed.");
        // Re-throw so the child can clear its busy state without marking success.
        throw err;
      }
    };
  }

  const onAdvance = guard((to: CaseStatus, reason: string) =>
    advanceCase(selectedId as number, to, reason),
  );
  const onRecord = guard((type: CheckType, status: CheckStatus, note: string) =>
    recordVerification({ case_id: selectedId as number, type, status, note }),
  );
  const onDecide = guard(() => decideCase(selectedId as number));
  const onAppeal = guard((reason: string) => fileAppeal(selectedId as number, reason));

  async function handleIntake(body: IntakeBody) {
    setActionError(null);
    try {
      const res = (await intakeCase(body)) as { case?: { id?: number } };
      setShowIntake(false);
      await loadQueue(statusFilter);
      const newId = res?.case?.id != null ? Number(res.case.id) : null;
      if (newId != null) {
        setSelectedId(newId);
        await loadDetail(newId);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not open the case.");
      throw err;
    }
  }

  const applicantsById = new Map<number, ApplicantRow>(
    (queue?.applicants ?? []).map((a) => [Number(a.id), a]),
  );
  const staffById = new Map<number, WorkerRow>(
    (queue?.staff ?? []).map((w) => [Number(w.id), w]),
  );

  return (
    <div className="bg-background text-foreground min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-lg">
              <Landmark className="size-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Benefits Case Management</h1>
              <p className="text-muted-foreground text-xs">
                A governed case lifecycle, eligibility rule, and audit trail in one API layer
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-muted-foreground text-xs">Signed in as</div>
              <div className="flex items-center justify-end gap-2">
                <span className="text-sm font-medium">{user?.name ?? "..."}</span>
                {user ? <RoleBadge role={role} /> : null}
              </div>
            </div>
            <Select
              aria-label="Switch signer"
              value={role}
              onChange={(e) => switchRole(e.target.value as Role)}
              className="w-52"
            >
              <option value="caseworker">Dana Okafor (Caseworker)</option>
              <option value="supervisor">Sam Rivera (Supervisor)</option>
              <option value="viewer">Val Chen (Viewer)</option>
            </Select>
            <Button variant="outline" size="icon" title="Reset sample data" onClick={reseed}>
              <RotateCcw />
            </Button>
          </div>
        </div>
      </header>

      <div className="bg-muted/30 border-b">
        <div className="text-muted-foreground mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-1 px-6 py-2 text-xs">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="size-3.5" /> API-layer RBAC, never row-level security
          </span>
          <span>6 tables · 9 APIs · 1 shared rule function</span>
          <span>Rule version: income-eligibility-2025.09</span>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-6 py-6">
        {actionError ? (
          <div className="border-destructive/40 bg-destructive/10 text-destructive mb-6 flex items-center justify-between gap-3 rounded-lg border px-4 py-2 text-sm">
            <span>{actionError}</span>
            <button onClick={() => setActionError(null)} aria-label="Dismiss">
              <X className="size-4" />
            </button>
          </div>
        ) : null}

        {loading ? (
          <div className="text-muted-foreground flex items-center justify-center gap-2 py-24">
            <Loader2 className="animate-spin" /> Loading the case management service...
          </div>
        ) : bootError ? (
          <div className="text-destructive py-24 text-center">
            {bootError}
            <div className="mt-4">
              <Button variant="outline" onClick={reseed}>
                Retry
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold tracking-tight">Case queue</h2>
                <Button size="sm" onClick={() => setShowIntake(true)}>
                  <Plus /> New case
                </Button>
              </div>
              <CaseQueue
                cases={queue?.cases ?? []}
                applicantsById={applicantsById}
                workersById={staffById}
                selectedId={selectedId}
                statusFilter={statusFilter}
                onStatusFilter={changeFilter}
                onSelect={selectCase}
              />
            </section>

            <section>
              {showIntake ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Open a new case</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <IntakeForm onSubmit={handleIntake} onCancel={() => setShowIntake(false)} />
                  </CardContent>
                </Card>
              ) : detail && selectedId != null ? (
                <CaseDetail
                  key={selectedId}
                  detail={detail}
                  role={role}
                  onAdvance={onAdvance}
                  onRecord={onRecord}
                  onDecide={onDecide}
                  onAppeal={onAppeal}
                />
              ) : (
                <div className="text-muted-foreground rounded-lg border border-dashed py-24 text-center text-sm">
                  Select a case from the queue to see its detail, checks, determination, and audit
                  trail.
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      <footer className="text-muted-foreground mx-auto max-w-6xl px-6 py-8 text-center text-xs">
        Ephemeral demo environment. The durable artifact is the repo, which anyone can redeploy with{" "}
        <code className="bg-muted rounded px-1 py-0.5">npm run xano:deploy</code>.
      </footer>
    </div>
  );
}
