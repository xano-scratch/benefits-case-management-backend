import { query, input, s, ref, inp, c, col, expr, or, auth } from "@xanots/sdk";
import { appealsApi } from "./groups.js";
import { users } from "../tables/users.js";
import { cases } from "../tables/cases.js";
import { determinations } from "../tables/determinations.js";
import { case_events } from "../tables/case-events.js";

/**
 * File an appeal on a denied, closed case. It moves back to `appeal`, where a
 * supervisor may re-run the determination (`decide`) or advance it. The guard is
 * two preconditions: the case is closed, and its latest determination was denied.
 * An approved case, or one with no determination, is refused. Caseworker or
 * supervisor role.
 */
export const fileQuery = query({
  name: "file",
  verb: "POST",
  apiGroup: appealsApi,
  auth: users,
  input: {
    case_id: input.int({ required: true }),
    reason: input.text({ required: true }),
  },
  stack: [
    // Role guard: a viewer may not file an appeal.
    s.db.get_by_id({ table: users, id: auth("id"), as: "actor" }),
    s.precondition({
      expr: or(
        expr(ref("actor.role"), "=", c.text("caseworker")),
        expr(ref("actor.role"), "=", c.text("supervisor")),
      ),
      error: c.text("Only a caseworker or supervisor can file an appeal."),
      error_type: "accessdenied",
    }),

    // The case must exist and be closed.
    s.db.get_by_id({ table: cases, id: inp("case_id"), as: "case" }),
    s.precondition({
      expr: expr(ref("case"), "!=", c.null()),
      error: c.text("Case not found."),
      error_type: "notfound",
    }),
    s.precondition({
      expr: expr(ref("case.status"), "=", c.text("closed")),
      error: c.text("An appeal can only be filed on a closed case."),
      error_type: "badrequest",
    }),

    // The latest determination must have been a denial.
    s.db.query({
      table: determinations,
      where: expr(col("case_id"), "=", ref("case.id")),
      sort: [{ sortBy: "id", dir: "desc" }],
      returnType: "single",
      as: "latest",
    }),
    s.precondition({
      expr: expr(ref("latest"), "!=", c.null()),
      error: c.text("This case has no determination to appeal."),
      error_type: "badrequest",
    }),
    s.precondition({
      expr: expr(ref("latest.outcome"), "=", c.text("denied")),
      error: c.text("Only a denied determination can be appealed."),
      error_type: "badrequest",
    }),

    s.db.edit({ table: cases, fieldValue: ref("case.id"), row: { status: "appeal" } }),
    s.db.add({
      table: case_events,
      row: {
        case_id: ref("case.id"),
        actor_id: ref("actor.id"),
        actor_role: ref("actor.role"),
        event_type: "appeal",
        from_status: "closed",
        to_status: "appeal",
        reason: inp("reason"),
      },
    }),
  ],
  response: {
    case_id: ref("case.id"),
    status: c.text("appeal"),
  },
});
