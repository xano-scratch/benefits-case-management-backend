import { table, f } from "@xanots/sdk";

/**
 * Staff who act on cases. This is the AUTH table (`auth: true`): a login mints a
 * token against it, and every protected endpoint names it as `auth:` so the
 * engine rejects an unauthenticated request before the stack runs.
 *
 * `role` is the whole authorization model. It is API-layer RBAC: each endpoint
 * reads the caller's row and gates on this column. There is no row-level
 * security anywhere in this app, and there is none in Xano to model.
 */
export const users = table({
  name: "users",
  auth: true,
  // `id` (int PK) + `created_at` (epochms) are auto-injected.
  schema: {
    name: f.text({ required: true }),
    email: f.email({ required: true }),
    // Hashes on write; read it back only by naming it in a db.get `output`.
    password: f.password({ required: true }),
    role: f.enum(["caseworker", "supervisor", "viewer"], { required: true }),
  },
  index: [{ type: "unique", fields: [{ name: "email" }] }],
});
