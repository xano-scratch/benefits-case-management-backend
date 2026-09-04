import { query, input, s, ref, inp, c, expr } from "@xanots/sdk";
import { authApi } from "./groups.js";
import { users } from "../tables/users.js";

/**
 * Authenticate against the users auth table and mint a bearer token. Every role
 * guard in this app depends on this token: a protected endpoint names `users` as
 * its `auth:` table, so the engine rejects a request with no valid token before
 * the stack runs, and the stack then reads the caller's row to check their role.
 *
 * The password is taken as `input.text`, NOT `input.password`: an
 * `input.password` hashes the submission on bind, and the column already hashes
 * on write, so `check_password` would compare two different hashes and a correct
 * password would always fail. The plaintext goes straight to `check_password`,
 * which does the comparison hash itself.
 */
export const loginQuery = query({
  name: "login",
  verb: "POST",
  apiGroup: authApi,
  auth: false,
  input: {
    email: input.email({ required: true }),
    password: input.text({ required: true }),
  },
  stack: [
    // `output` MUST name `password`: the column is access:internal and is absent
    // from the row otherwise, so `check_password` would have nothing to compare.
    s.db.get({
      table: users,
      fieldName: "email",
      fieldValue: inp("email"),
      output: ["id", "name", "email", "role", "password"],
      as: "u",
    }),
    s.precondition({
      expr: expr(ref("u"), "!=", c.null()),
      error: c.text("No account with that email."),
      error_type: "unauthorized",
    }),
    s.security.check_password({
      text_password: inp("password"),
      hash_password: ref("u.password"),
      as: "ok",
    }),
    s.precondition({
      expr: expr(ref("ok"), "=", c.bool(true)),
      error: c.text("Incorrect password."),
      error_type: "unauthorized",
    }),
    s.security.create_auth_token({ table: users, id: ref("u.id"), as: "token" }),
  ],
  response: {
    authToken: ref("token"),
    user: {
      id: ref("u.id"),
      name: ref("u.name"),
      email: ref("u.email"),
      role: ref("u.role"),
    },
  },
});
