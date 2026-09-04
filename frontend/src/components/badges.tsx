import { CheckCircle2, Clock, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { CaseStatus, CheckStatus, Program, Role } from "@/lib/api";

const statusVariant: Record<CaseStatus, "outline" | "secondary" | "default" | "warning" | "success"> = {
  received: "outline",
  verifying: "secondary",
  determination: "default",
  appeal: "warning",
  closed: "success",
};

const statusLabel: Record<CaseStatus, string> = {
  received: "Received",
  verifying: "Verifying",
  determination: "Determination",
  appeal: "Appeal",
  closed: "Closed",
};

export function StatusBadge({ status }: { status: CaseStatus | string }) {
  const key = (status as CaseStatus) in statusVariant ? (status as CaseStatus) : null;
  if (!key) return <Badge variant="outline">{String(status)}</Badge>;
  return <Badge variant={statusVariant[key]}>{statusLabel[key]}</Badge>;
}

export function RoleBadge({ role }: { role: Role | string }) {
  if (role === "supervisor") return <Badge variant="secondary">Supervisor</Badge>;
  if (role === "viewer") return <Badge variant="outline">Viewer</Badge>;
  return <Badge variant="default">Caseworker</Badge>;
}

export function OutcomeBadge({ outcome }: { outcome: string }) {
  return outcome === "approved" ? (
    <Badge variant="success">
      <CheckCircle2 /> Approved
    </Badge>
  ) : (
    <Badge variant="destructive">
      <XCircle /> Denied
    </Badge>
  );
}

export function CheckBadge({ status }: { status: CheckStatus | string }) {
  if (status === "verified")
    return (
      <Badge variant="success">
        <CheckCircle2 /> Verified
      </Badge>
    );
  if (status === "failed")
    return (
      <Badge variant="destructive">
        <XCircle /> Failed
      </Badge>
    );
  return (
    <Badge variant="secondary">
      <Clock /> Pending
    </Badge>
  );
}

export function ProgramBadge({ program }: { program: Program | string }) {
  const label = program === "snap" ? "SNAP" : program === "tanf" ? "TANF" : program === "medicaid" ? "Medicaid" : String(program);
  return <Badge variant="outline">{label}</Badge>;
}
