import { query, input, s, ref, inp, c, expr, auth } from "@xanots/sdk";
import { determinationsApi } from "./groups.js";
import { users } from "../tables/users.js";
import { evaluateEligibility } from "../functions/evaluate-eligibility.js";

/**
 * Run the eligibility rule on a case and close it on the outcome. Supervisor
 * role. The whole rule lives in the shared `evaluate_eligibility` function, which
 * this endpoint and the seed both call, so the live decision and the sample data
 * come from one definition. The function itself guards that the case exists and
 * is in a state where a determination is allowed, writes the determination pinned
 * to its rule version, moves the case to closed, and appends the audit event.
 */
export const decideQuery = query({
  name: "decide",
  verb: "POST",
  apiGroup: determinationsApi,
  auth: users,
  input: {
    case_id: input.int({ required: true }),
  },
  stack: [
    // Role guard: only a supervisor may run a determination.
    s.db.get_by_id({ table: users, id: auth("id"), as: "actor" }),
    s.precondition({
      expr: expr(ref("actor.role"), "=", c.text("supervisor")),
      error: c.text("Only a supervisor can run a determination."),
      error_type: "accessdenied",
    }),

    s.function.run({
      fn: evaluateEligibility,
      input: {
        case_id: inp("case_id"),
        actor_id: ref("actor.id"),
        actor_role: ref("actor.role"),
      },
      as: "result",
    }),
  ],
  response: { result: ref("result") },
});
