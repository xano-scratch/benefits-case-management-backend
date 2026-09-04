import { query, input, s, ref, inp, c, expr, auth } from "@xanots/sdk";
import { casesApi } from "./groups.js";
import { users } from "../tables/users.js";
import { applicants } from "../tables/applicants.js";
import { cases } from "../tables/cases.js";
import { case_events } from "../tables/case-events.js";

/**
 * Open a new case. Matches an existing applicant by contact email or creates
 * one, opens the case in `received`, and writes the first audit event. Caseworker
 * role only, enforced at the API by reading the caller's row and gating on it.
 */
export const intakeQuery = query({
  name: "intake",
  verb: "POST",
  apiGroup: casesApi,
  auth: users,
  input: {
    full_name: input.text({ required: true }),
    dob: input.date({ required: true }),
    household_size: input.int({ required: true }),
    income_monthly: input.int({ required: true }),
    contact_email: input.email({ required: true }),
    program: input.enum(["snap", "tanf", "medicaid"], { required: true }),
    opened_reason: input.text({ required: true }),
  },
  stack: [
    // Role guard: only a caseworker may intake.
    s.db.get_by_id({ table: users, id: auth("id"), as: "actor" }),
    s.precondition({
      expr: expr(ref("actor.role"), "=", c.text("caseworker")),
      error: c.text("Only a caseworker can open a new case."),
      error_type: "accessdenied",
    }),

    // Match an applicant by contact email, or create one.
    s.db.get({
      table: applicants,
      fieldName: "contact_email",
      fieldValue: inp("contact_email"),
      as: "existing",
    }),
    s.set_var("applicant_id", c.int(0)),
    s.conditional({
      when: expr(ref("existing"), "!=", c.null()),
      then: [s.update_var("applicant_id", ref("existing.id", { safe: true }))],
      else: [
        s.db.add({
          table: applicants,
          row: {
            full_name: inp("full_name"),
            dob: inp("dob"),
            household_size: inp("household_size"),
            income_monthly: inp("income_monthly"),
            contact_email: inp("contact_email"),
          },
          as: "created",
        }),
        s.update_var("applicant_id", ref("created.id")),
      ],
    }),

    // Open the case in `received`, assigned to the caseworker who took it.
    s.db.add({
      table: cases,
      row: {
        applicant_id: ref("applicant_id"),
        program: inp("program"),
        status: "received",
        assigned_to: ref("actor.id"),
        opened_reason: inp("opened_reason"),
      },
      as: "case",
    }),
    s.db.add({
      table: case_events,
      row: {
        case_id: ref("case.id"),
        actor_id: ref("actor.id"),
        actor_role: ref("actor.role"),
        event_type: "intake",
        from_status: "",
        to_status: "received",
        reason: inp("opened_reason"),
      },
    }),
  ],
  response: { case: ref("case") },
});
