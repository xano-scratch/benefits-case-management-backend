import { query, input, s, ref, inp, c, expr, auth } from "@xanots/sdk";
import { verificationsApi } from "./groups.js";
import { users } from "../tables/users.js";
import { cases } from "../tables/cases.js";
import { verifications } from "../tables/verifications.js";
import { case_events } from "../tables/case-events.js";

/**
 * Record the result of one check (income, identity, or residency) on a case that
 * is currently `verifying`. Caseworker role. Writes the verification row and a
 * `verification` audit event. The eligibility rule later reads these rows and
 * requires all three to be `verified` before it can approve.
 */
export const recordQuery = query({
  name: "record",
  verb: "POST",
  apiGroup: verificationsApi,
  auth: users,
  input: {
    case_id: input.int({ required: true }),
    type: input.enum(["income", "identity", "residency"], { required: true }),
    status: input.enum(["pending", "verified", "failed"], { required: true }),
    note: input.text({ required: false }),
  },
  stack: [
    // Role guard: only a caseworker records checks.
    s.db.get_by_id({ table: users, id: auth("id"), as: "actor" }),
    s.precondition({
      expr: expr(ref("actor.role"), "=", c.text("caseworker")),
      error: c.text("Only a caseworker can record a verification."),
      error_type: "accessdenied",
    }),

    // The case must exist and be in `verifying`.
    s.db.get_by_id({ table: cases, id: inp("case_id"), as: "case" }),
    s.precondition({
      expr: expr(ref("case"), "!=", c.null()),
      error: c.text("Case not found."),
      error_type: "notfound",
    }),
    s.precondition({
      expr: expr(ref("case.status"), "=", c.text("verifying")),
      error: c.text("Checks can only be recorded while the case is verifying."),
      error_type: "badrequest",
    }),

    s.db.add({
      table: verifications,
      row: {
        case_id: ref("case.id"),
        type: inp("type"),
        status: inp("status"),
        verified_by: ref("actor.id"),
        note: inp("note"),
      },
      as: "verification",
    }),
    s.db.add({
      table: case_events,
      row: {
        case_id: ref("case.id"),
        actor_id: ref("actor.id"),
        actor_role: ref("actor.role"),
        event_type: "verification",
        from_status: "verifying",
        to_status: "verifying",
        reason: inp("note"),
      },
    }),
  ],
  response: { verification: ref("verification") },
});
