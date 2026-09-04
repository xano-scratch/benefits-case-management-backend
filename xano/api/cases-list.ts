import { query, input, s, ref, inp, col, cmp } from "@xanots/sdk";
import { casesApi } from "./groups.js";
import { cases } from "../tables/cases.js";
import { applicants } from "../tables/applicants.js";
import { users } from "../tables/users.js";

/**
 * The case queue. Any authenticated role may read it, including a viewer, so a
 * read is never gated on a role. Optional `status` and `assigned_to` filters are
 * applied in the database with `ignoreEmpty`, which drops the predicate when the
 * operand is empty, so omitting a filter returns every case.
 *
 * The applicants and staff are returned alongside so the client can resolve
 * names without a second round trip. Staff are returned through an `output` that
 * omits the password column.
 */
export const listQuery = query({
  name: "list",
  verb: "GET",
  apiGroup: casesApi,
  auth: users,
  input: {
    status: input.text({ required: false }),
    assigned_to: input.int({ required: false }),
  },
  stack: [
    s.db.query({
      table: cases,
      where: [
        cmp(col("status"), "=", inp("status"), { ignoreEmpty: true }),
        cmp(col("assigned_to"), "=", inp("assigned_to"), { ignoreEmpty: true }),
      ],
      sort: [{ sortBy: "created_at", dir: "desc" }],
      as: "cases",
    }),
    s.db.query({ table: applicants, sort: [{ sortBy: "id", dir: "asc" }], as: "applicants" }),
    s.db.query({
      table: users,
      output: ["id", "name", "email", "role"],
      sort: [{ sortBy: "id", dir: "asc" }],
      as: "staff",
    }),
  ],
  response: {
    cases: ref("cases"),
    applicants: ref("applicants"),
    staff: ref("staff"),
  },
});
