import { query, input, s, ref, inp, c, col, expr } from "@xanots/sdk";
import { casesApi } from "./groups.js";
import { cases } from "../tables/cases.js";
import { applicants } from "../tables/applicants.js";
import { verifications } from "../tables/verifications.js";
import { determinations } from "../tables/determinations.js";
import { case_events } from "../tables/case-events.js";
import { users } from "../tables/users.js";

/**
 * One case with everything a reviewer needs: the applicant, the verification
 * checklist, the determinations (newest first, so the client reads [0]), and the
 * full ordered audit trail. Any authenticated role may read it. The case id is a
 * path segment (`get/{case_id}`) because it names WHICH row is wanted; an unknown
 * id is guarded to a clean 404, never a 500.
 */
export const getQuery = query({
  name: "get/{case_id}",
  verb: "GET",
  apiGroup: casesApi,
  auth: users,
  input: {
    case_id: input.int({ required: true }),
  },
  stack: [
    s.db.get_by_id({ table: cases, id: inp("case_id"), as: "case" }),
    s.precondition({
      expr: expr(ref("case"), "!=", c.null()),
      error: c.text("Case not found."),
      error_type: "notfound",
    }),
    s.db.get_by_id({ table: applicants, id: ref("case.applicant_id"), as: "applicant" }),
    s.db.query({
      table: verifications,
      where: expr(col("case_id"), "=", ref("case.id")),
      sort: [{ sortBy: "id", dir: "asc" }],
      as: "verifications",
    }),
    s.db.query({
      table: determinations,
      where: expr(col("case_id"), "=", ref("case.id")),
      sort: [{ sortBy: "id", dir: "desc" }],
      as: "determinations",
    }),
    s.db.query({
      table: case_events,
      where: expr(col("case_id"), "=", ref("case.id")),
      sort: [{ sortBy: "id", dir: "asc" }],
      as: "events",
    }),
    s.db.query({
      table: users,
      output: ["id", "name", "email", "role"],
      sort: [{ sortBy: "id", dir: "asc" }],
      as: "staff",
    }),
  ],
  response: {
    case: ref("case"),
    applicant: ref("applicant"),
    verifications: ref("verifications"),
    determinations: ref("determinations"),
    events: ref("events"),
    staff: ref("staff"),
  },
});
