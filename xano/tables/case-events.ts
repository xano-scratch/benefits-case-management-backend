import { table, f } from "@xanots/sdk";
import { cases } from "./cases.js";
import { users } from "./users.js";

/**
 * The append-only audit spine. Every change to a case writes one row here: who
 * acted (`actor_id` + `actor_role`), what kind of event, the status it moved
 * from and to, and why. Nothing edits or deletes these rows, so the history of a
 * case is whatever this table holds for it, in order.
 */
export const case_events = table({
  name: "case_events",
  schema: {
    case_id: f.tableRef(cases, { required: true }),
    actor_id: f.tableRef(users, { default: 0 }),
    actor_role: f.text(),
    event_type: f.enum(
      ["intake", "transition", "verification", "determination", "appeal"],
      { required: true },
    ),
    from_status: f.text(),
    to_status: f.text(),
    reason: f.text(),
  },
  index: [{ type: "btree", fields: [{ name: "case_id" }] }],
});
