import { query, input, s, ref, inp, c, expr, and, or, auth } from "@xanots/sdk";
import { casesApi } from "./groups.js";
import { users } from "../tables/users.js";
import { cases } from "../tables/cases.js";
import { case_events } from "../tables/case-events.js";

/**
 * Move a case along a LEGAL transition, and refuse anything else at the API. The
 * legal table is small and explicit:
 *   received    → verifying
 *   verifying   → determination
 *   appeal      → determination   (a supervisor re-opens a determination)
 *
 * Closing a case is NOT done here: it happens through `determinations/decide`,
 * which produces a determination. Filing an appeal is `appeals/file`. So an
 * illegal move (for example received → closed) sets `legal` to false, the
 * precondition fails, and nothing is written. Caseworker or supervisor role.
 */
export const advanceQuery = query({
  name: "advance",
  verb: "POST",
  apiGroup: casesApi,
  auth: users,
  input: {
    case_id: input.int({ required: true }),
    to_status: input.enum(
      ["received", "verifying", "determination", "appeal", "closed"],
      { required: true },
    ),
    reason: input.text({ required: true }),
  },
  stack: [
    // Role guard: a viewer may not advance a case.
    s.db.get_by_id({ table: users, id: auth("id"), as: "actor" }),
    s.precondition({
      expr: or(
        expr(ref("actor.role"), "=", c.text("caseworker")),
        expr(ref("actor.role"), "=", c.text("supervisor")),
      ),
      error: c.text("Only a caseworker or supervisor can advance a case."),
      error_type: "accessdenied",
    }),

    // Load the case; an unknown id is a clean 404.
    s.db.get_by_id({ table: cases, id: inp("case_id"), as: "case" }),
    s.precondition({
      expr: expr(ref("case"), "!=", c.null()),
      error: c.text("Case not found."),
      error_type: "notfound",
    }),

    // Enforce the legal-transition table.
    s.set_var("legal", c.bool(false)),
    s.conditional({
      when: and(
        expr(ref("case.status"), "=", c.text("received")),
        expr(inp("to_status"), "=", c.text("verifying")),
      ),
      then: [s.update_var("legal", c.bool(true))],
      elif: [
        {
          when: and(
            expr(ref("case.status"), "=", c.text("verifying")),
            expr(inp("to_status"), "=", c.text("determination")),
          ),
          then: [s.update_var("legal", c.bool(true))],
        },
        {
          when: and(
            expr(ref("case.status"), "=", c.text("appeal")),
            expr(inp("to_status"), "=", c.text("determination")),
          ),
          then: [s.update_var("legal", c.bool(true))],
        },
      ],
    }),
    s.precondition({
      expr: expr(ref("legal"), "=", c.bool(true)),
      error: c.text(
        "That transition is not allowed from the case's current status. Closing happens through a determination, and an appeal is filed on a denied, closed case.",
      ),
      error_type: "badrequest",
    }),

    // Apply the move and record it in the audit trail.
    s.set_var("from_status", ref("case.status")),
    s.db.edit({ table: cases, fieldValue: ref("case.id"), row: { status: inp("to_status") } }),
    s.db.add({
      table: case_events,
      row: {
        case_id: ref("case.id"),
        actor_id: ref("actor.id"),
        actor_role: ref("actor.role"),
        event_type: "transition",
        from_status: ref("from_status"),
        to_status: inp("to_status"),
        reason: inp("reason"),
      },
    }),
  ],
  response: {
    case_id: ref("case.id"),
    from_status: ref("from_status"),
    to_status: inp("to_status"),
  },
});
