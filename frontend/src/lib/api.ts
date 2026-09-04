// The one contract: paths and request/response TYPES are derived from the xanots
// query defs, never hand-typed. Change a def in xano/ and everything here follows
// at compile time.
//
//   • `import type { InferInput, InferResponse }` — types erase to nothing.
//   • Import each lean query def for its `getPath()`/`verb`. These defs carry no
//     heavy graph (no agent/tool stacks), so importing them is cheap; we never
//     import ../../../xano/index.js (that would pull the whole workspace).

import type { InferInput, InferResponse } from "@xanots/sdk";
import { loginQuery } from "../../../xano/api/auth-login.js";
import { intakeQuery } from "../../../xano/api/cases-intake.js";
import { listQuery } from "../../../xano/api/cases-list.js";
import { getQuery } from "../../../xano/api/cases-get.js";
import { advanceQuery } from "../../../xano/api/cases-advance.js";
import { recordQuery } from "../../../xano/api/verifications-record.js";
import { decideQuery } from "../../../xano/api/determinations-decide.js";
import { fileQuery } from "../../../xano/api/appeals-file.js";
import { seedQuery } from "../../../xano/api/seed.js";

/**
 * The deployed backend's base URL. Injected as `window.XANO_HOST` by
 * `xanots deploy --static`, or read from `VITE_XANO_HOST` in local dev.
 */
export const XANO_HOST: string =
  (typeof window !== "undefined" && (window as { XANO_HOST?: string }).XANO_HOST) ||
  import.meta.env.VITE_XANO_HOST ||
  "";

// ── Types derived from the backend (the one contract) ───────────────────────
export type LoginResponse = InferResponse<typeof loginQuery>;
export type SessionUser = LoginResponse["user"];
export type Queue = InferResponse<typeof listQuery>;
export type CaseDetail = InferResponse<typeof getQuery>;

export type CaseRow = Queue["cases"][number];
export type ApplicantRow = Queue["applicants"][number];
export type WorkerRow = Queue["staff"][number];
export type VerificationRow = CaseDetail["verifications"][number];
export type DeterminationRow = CaseDetail["determinations"][number];
export type EventRow = CaseDetail["events"][number];

export type IntakeBody = InferInput<typeof intakeQuery>;

// Enum unions, read straight off the inferred row types.
export type CaseStatus = NonNullable<CaseRow["status"]>;
export type Program = NonNullable<CaseRow["program"]>;
export type Role = NonNullable<SessionUser["role"]>;
export type CheckType = NonNullable<VerificationRow["type"]>;
export type CheckStatus = NonNullable<VerificationRow["status"]>;

// ── Token + transport ───────────────────────────────────────────────────────
const TOKEN_KEY = "bcm_token";
let authToken: string | null = null;

export function setToken(token: string | null): void {
  authToken = token;
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // localStorage may be unavailable; the in-memory token still works.
  }
}

function getToken(): string | null {
  if (authToken) return authToken;
  try {
    authToken = localStorage.getItem(TOKEN_KEY);
  } catch {
    authToken = null;
  }
  return authToken;
}

/** An HTTP error carrying the status and the API's own message. */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

async function request<T>(path: string, verb: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  let payload: string | undefined;
  if (body !== undefined) {
    headers["content-type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(XANO_HOST + path, { method: verb, headers, body: payload });
  const text = await res.text();
  if (!res.ok) {
    let message = text;
    try {
      const parsed = JSON.parse(text) as { message?: string };
      if (parsed && typeof parsed.message === "string") message = parsed.message;
    } catch {
      // Non-JSON error body; keep the raw text.
    }
    throw new ApiError(res.status, message || `Request failed (${res.status})`);
  }
  return (text ? (JSON.parse(text) as T) : (null as T));
}

// ── Endpoint wrappers ────────────────────────────────────────────────────────
export function login(input: InferInput<typeof loginQuery>): Promise<LoginResponse> {
  return request<LoginResponse>(loginQuery.getPath(), loginQuery.verb, input);
}

export function fetchQueue(status?: CaseStatus | ""): Promise<Queue> {
  const base = listQuery.getPath();
  const url = status ? `${base}?status=${encodeURIComponent(status)}` : base;
  return request<Queue>(url, listQuery.verb);
}

export function fetchCase(caseId: number): Promise<CaseDetail> {
  return request<CaseDetail>(getQuery.getPath({ params: { case_id: caseId } }), getQuery.verb);
}

export function intakeCase(body: IntakeBody): Promise<InferResponse<typeof intakeQuery>> {
  return request(intakeQuery.getPath(), intakeQuery.verb, body);
}

export function advanceCase(
  caseId: number,
  toStatus: CaseStatus,
  reason: string,
): Promise<InferResponse<typeof advanceQuery>> {
  return request(advanceQuery.getPath(), advanceQuery.verb, {
    case_id: caseId,
    to_status: toStatus,
    reason,
  });
}

export function recordVerification(body: {
  case_id: number;
  type: CheckType;
  status: CheckStatus;
  note: string;
}): Promise<InferResponse<typeof recordQuery>> {
  return request(recordQuery.getPath(), recordQuery.verb, body);
}

export function decideCase(caseId: number): Promise<InferResponse<typeof decideQuery>> {
  return request(decideQuery.getPath(), decideQuery.verb, { case_id: caseId });
}

export function fileAppeal(
  caseId: number,
  reason: string,
): Promise<InferResponse<typeof fileQuery>> {
  return request(fileQuery.getPath(), fileQuery.verb, { case_id: caseId, reason });
}

export function seedDemoData(): Promise<InferResponse<typeof seedQuery>> {
  return request(seedQuery.getPath(), seedQuery.verb);
}
