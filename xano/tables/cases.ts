import { table, f } from "@xanots/sdk";
import { applicants } from "./applicants.js";
import { users } from "./users.js";

/**
 * A benefit application as it moves through its lifecycle. `status` is the state
 * machine the whole app governs: received, verifying, determination, appeal,
 * closed. Only the `advance`, `decide`, and `file` endpoints change it, and only
 * along a legal transition.
 *
 * `assigned_to` is an optional foreign key. An optional FK stores a `0` sentinel
 * rather than null (a null in an int FK is unqueryable), so it declares
 * `default: 0`; "unassigned" reads as `0`.
 *
 * Indexed on `status` and `assigned_to` — the two columns the case queue filters
 * on.
 */
export const cases = table({
  name: "cases",
  schema: {
    applicant_id: f.tableRef(applicants, { required: true }),
    program: f.enum(["snap", "tanf", "medicaid"], { required: true }),
    status: f.enum(["received", "verifying", "determination", "appeal", "closed"], {
      required: true,
    }),
    assigned_to: f.tableRef(users, { default: 0 }),
    opened_reason: f.text(),
  },
  index: [
    { type: "btree", fields: [{ name: "status" }] },
    { type: "btree", fields: [{ name: "assigned_to" }] },
  ],
});
