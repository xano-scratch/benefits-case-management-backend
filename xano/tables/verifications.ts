import { table, f } from "@xanots/sdk";
import { cases } from "./cases.js";
import { users } from "./users.js";

/**
 * A single check on a case (income, identity, or residency) and its result. The
 * eligibility rule requires all three to be `verified` before it can approve.
 * `verified_by` is an optional FK to the staff member who recorded it (0 when
 * not recorded yet).
 */
export const verifications = table({
  name: "verifications",
  schema: {
    case_id: f.tableRef(cases, { required: true }),
    type: f.enum(["income", "identity", "residency"], { required: true }),
    status: f.enum(["pending", "verified", "failed"], { required: true }),
    verified_by: f.tableRef(users, { default: 0 }),
    note: f.text(),
  },
  index: [{ type: "btree", fields: [{ name: "case_id" }] }],
});
