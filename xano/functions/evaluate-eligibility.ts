import { defineFunction, input, s, ref, inp, c, col, expr, and, or } from "@xanots/sdk";
import { cases } from "../tables/cases.js";
import { applicants } from "../tables/applicants.js";
import { verifications } from "../tables/verifications.js";
import { determinations } from "../tables/determinations.js";
import { case_events } from "../tables/case-events.js";

/**
 * The governed eligibility rule, defined ONCE. Both the `determinations/decide`
 * endpoint and the seed call this through `s.function.run`, so the live API and
 * the sample data run the exact same rule, not two copies of it. That single
 * definition is the point of the play: the eligibility policy lives in one
 * readable, versioned, auditable place.
 *
 * The rule has two parts, both required to approve:
 *   1. All three checks (income, identity, residency) are `verified`.
 *   2. Monthly income is within the versioned limit for the household size.
 *
 * It writes a determination pinned to `rule_version`, moves the case to closed,
 * and appends a `determination` audit event naming the reason. Bumping a number
 * here and moving the version string is how a policy change ships, and every
 * determination records the version that decided it.
 */
export const evaluateEligibility = defineFunction({
  name: "evaluate_eligibility",
  input: {
    case_id: input.int({ required: true }),
    actor_id: input.int({ required: true }),
    actor_role: input.text({ required: true }),
  },
  stack: [
    // Load the case and guard it exists before drilling into it.
    s.db.get_by_id({ table: cases, id: inp("case_id"), as: "case" }),
    s.precondition({
      expr: expr(ref("case"), "!=", c.null()),
      error: c.text("Case not found."),
      error_type: "notfound",
    }),
    // A determination may only run at the point in the lifecycle that allows it.
    s.precondition({
      expr: or(
        expr(ref("case.status"), "=", c.text("determination")),
        expr(ref("case.status"), "=", c.text("appeal")),
      ),
      error: c.text("A determination can only run when the case is in determination or appeal."),
      error_type: "badrequest",
    }),

    // Load the applicant behind the case.
    s.db.get_by_id({ table: applicants, id: ref("case.applicant_id"), as: "applicant" }),
    s.precondition({
      expr: expr(ref("applicant"), "!=", c.null()),
      error: c.text("Applicant not found."),
      error_type: "notfound",
    }),

    // Required checks: each type must have a row in `verified`.
    s.db.query({
      table: verifications,
      where: [
        expr(col("case_id"), "=", ref("case.id")),
        expr(col("type"), "=", c.text("income")),
        expr(col("status"), "=", c.text("verified")),
      ],
      returnType: "exists",
      as: "income_ok",
    }),
    s.db.query({
      table: verifications,
      where: [
        expr(col("case_id"), "=", ref("case.id")),
        expr(col("type"), "=", c.text("identity")),
        expr(col("status"), "=", c.text("verified")),
      ],
      returnType: "exists",
      as: "identity_ok",
    }),
    s.db.query({
      table: verifications,
      where: [
        expr(col("case_id"), "=", ref("case.id")),
        expr(col("type"), "=", c.text("residency")),
        expr(col("status"), "=", c.text("verified")),
      ],
      returnType: "exists",
      as: "residency_ok",
    }),

    // The versioned monthly income limits, by household size (whole dollars).
    s.set_var("rule_version", c.text("income-eligibility-2025.09")),
    s.set_var("threshold", c.int(3840)),
    s.conditional({
      when: expr(ref("applicant.household_size"), "<=", c.int(1)),
      then: [s.update_var("threshold", c.int(1600))],
      elif: [
        {
          when: expr(ref("applicant.household_size"), "=", c.int(2)),
          then: [s.update_var("threshold", c.int(2160))],
        },
        {
          when: expr(ref("applicant.household_size"), "=", c.int(3)),
          then: [s.update_var("threshold", c.int(2720))],
        },
        {
          when: expr(ref("applicant.household_size"), "=", c.int(4)),
          then: [s.update_var("threshold", c.int(3280))],
        },
      ],
      else: [s.update_var("threshold", c.int(3840))], // household of 5 or more
    }),

    // Apply the rule. Default is denied; the approve path must clear both parts.
    s.set_var("eligible", c.bool(false)),
    s.set_var("outcome", c.text("denied")),
    s.set_var("reason", c.text("")),
    s.conditional({
      when: and(
        expr(ref("income_ok"), "=", c.bool(true)),
        expr(ref("identity_ok"), "=", c.bool(true)),
        expr(ref("residency_ok"), "=", c.bool(true)),
      ),
      then: [
        s.conditional({
          when: expr(ref("applicant.income_monthly"), "<=", ref("threshold")),
          then: [
            s.update_var("eligible", c.bool(true)),
            s.update_var("outcome", c.text("approved")),
            s.update_var(
              "reason",
              c.text(
                "All three checks passed and monthly income is within the household limit for this program.",
              ),
            ),
          ],
          else: [
            s.update_var(
              "reason",
              c.text("Monthly income is above the household income limit this policy version allows."),
            ),
          ],
        }),
      ],
      else: [
        s.update_var(
          "reason",
          c.text("One or more required checks (income, identity, residency) are not verified."),
        ),
      ],
    }),

    // Persist the determination, pinned to the rule version that produced it.
    s.db.add({
      table: determinations,
      row: {
        case_id: ref("case.id"),
        outcome: ref("outcome"),
        eligible: ref("eligible"),
        reason: ref("reason"),
        rule_version: ref("rule_version"),
      },
      as: "determination",
    }),

    // Close the case and record the determination in the audit trail.
    s.set_var("from_status", ref("case.status")),
    s.db.edit({ table: cases, fieldValue: ref("case.id"), row: { status: "closed" } }),
    s.db.add({
      table: case_events,
      row: {
        case_id: ref("case.id"),
        actor_id: inp("actor_id"),
        actor_role: inp("actor_role"),
        event_type: "determination",
        from_status: ref("from_status"),
        to_status: c.text("closed"),
        reason: ref("reason"),
      },
    }),
  ],
  response: {
    determination: ref("determination"),
    eligible: ref("eligible"),
    threshold: ref("threshold"),
    rule_version: ref("rule_version"),
  },
});
