import { table, f } from "@xanots/sdk";
import { cases } from "./cases.js";

/**
 * The outcome of running the eligibility rule on a case. `rule_version` pins the
 * exact policy version that produced this outcome, so a determination stays
 * auditable even after the policy changes. `eligible` is the boolean the rule
 * computed; `outcome` is the decision that follows from it.
 */
export const determinations = table({
  name: "determinations",
  schema: {
    case_id: f.tableRef(cases, { required: true }),
    outcome: f.enum(["approved", "denied"], { required: true }),
    eligible: f.bool({ required: true }),
    reason: f.text(),
    rule_version: f.text({ required: true }),
  },
  index: [{ type: "btree", fields: [{ name: "case_id" }] }],
});
