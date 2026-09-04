import { query, s, ref, c } from "@xanots/sdk";
import { seedApi } from "./groups.js";
import { users } from "../tables/users.js";
import { applicants } from "../tables/applicants.js";
import { cases } from "../tables/cases.js";
import { verifications } from "../tables/verifications.js";
import { determinations } from "../tables/determinations.js";
import { case_events } from "../tables/case-events.js";
import { evaluateEligibility } from "../functions/evaluate-eligibility.js";

/**
 * Reset and reseed the workspace so the live app is browsable on first open.
 * Three staff (a caseworker, a supervisor, a viewer), five applicants, and five
 * cases that together cover every lifecycle stage: received, verifying,
 * determination-ready, closed with an approval, and one denied case that has
 * been appealed. Public so it can bootstrap a fresh environment.
 * `truncate({ reset: true })` restarts the id sequences, so the seed is
 * deterministic on every run (users 1..3, applicants 1..5, cases 1..5).
 *
 * The two decided cases run through the SAME `evaluate_eligibility` function the
 * API uses, so the seeded outcomes and the live ones come from one rule.
 */
export const seedQuery = query({
  name: "seed",
  verb: "GET",
  apiGroup: seedApi,
  auth: false,
  stack: [
    // Children first, so foreign keys never dangle mid-reset.
    s.db.truncate({ table: case_events, reset: true }),
    s.db.truncate({ table: determinations, reset: true }),
    s.db.truncate({ table: verifications, reset: true }),
    s.db.truncate({ table: cases, reset: true }),
    s.db.truncate({ table: applicants, reset: true }),
    s.db.truncate({ table: users, reset: true }),

    // Staff. Passwords are plaintext here; the column hashes them on write.
    s.db.add({
      table: users,
      row: { name: "Dana Okafor", email: "dana@agency.example", password: "caseworker-demo", role: "caseworker" },
      as: "caseworker",
    }),
    s.db.add({
      table: users,
      row: { name: "Sam Rivera", email: "sam@agency.example", password: "supervisor-demo", role: "supervisor" },
      as: "supervisor",
    }),
    s.db.add({
      table: users,
      row: { name: "Val Chen", email: "val@agency.example", password: "viewer-demo", role: "viewer" },
      as: "viewer",
    }),

    // Applicants.
    s.db.add({ table: applicants, row: { full_name: "Marcus Bell", dob: "1988-04-12", household_size: 3, income_monthly: 2200, contact_email: "marcus.bell@example.test" }, as: "a1" }),
    s.db.add({ table: applicants, row: { full_name: "Nadia Rahman", dob: "1991-09-03", household_size: 1, income_monthly: 1800, contact_email: "nadia.rahman@example.test" }, as: "a2" }),
    s.db.add({ table: applicants, row: { full_name: "Owen Pierce", dob: "1975-01-22", household_size: 4, income_monthly: 2600, contact_email: "owen.pierce@example.test" }, as: "a3" }),
    s.db.add({ table: applicants, row: { full_name: "Quinn Alvarez", dob: "1969-07-30", household_size: 5, income_monthly: 3200, contact_email: "quinn.alvarez@example.test" }, as: "a4" }),
    s.db.add({ table: applicants, row: { full_name: "Ruth Feld", dob: "1983-11-15", household_size: 2, income_monthly: 1500, contact_email: "ruth.feld@example.test" }, as: "a5" }),

    // Case 1: just received.
    s.db.add({ table: cases, row: { applicant_id: ref("a1.id"), program: "snap", status: "received", assigned_to: ref("caseworker.id"), opened_reason: "Applied for food assistance." }, as: "case1" }),
    s.db.add({ table: case_events, row: { case_id: ref("case1.id"), actor_id: ref("caseworker.id"), actor_role: "caseworker", event_type: "intake", from_status: "", to_status: "received", reason: "Applied for food assistance." } }),

    // Case 2: verifying (two of three checks done; residency still pending).
    s.db.add({ table: cases, row: { applicant_id: ref("a3.id"), program: "medicaid", status: "verifying", assigned_to: ref("caseworker.id"), opened_reason: "Applied for medical coverage." }, as: "case2" }),
    s.db.add({ table: verifications, row: { case_id: ref("case2.id"), type: "income", status: "verified", verified_by: ref("caseworker.id"), note: "Pay stubs reviewed." } }),
    s.db.add({ table: verifications, row: { case_id: ref("case2.id"), type: "identity", status: "verified", verified_by: ref("caseworker.id"), note: "State ID on file." } }),
    s.db.add({ table: verifications, row: { case_id: ref("case2.id"), type: "residency", status: "pending", verified_by: c.int(0), note: "Awaiting a utility bill." } }),
    s.db.add({ table: case_events, row: { case_id: ref("case2.id"), actor_id: ref("caseworker.id"), actor_role: "caseworker", event_type: "intake", from_status: "", to_status: "received", reason: "Applied for medical coverage." } }),
    s.db.add({ table: case_events, row: { case_id: ref("case2.id"), actor_id: ref("caseworker.id"), actor_role: "caseworker", event_type: "transition", from_status: "received", to_status: "verifying", reason: "Documents requested from the applicant." } }),
    s.db.add({ table: case_events, row: { case_id: ref("case2.id"), actor_id: ref("caseworker.id"), actor_role: "caseworker", event_type: "verification", from_status: "verifying", to_status: "verifying", reason: "Pay stubs reviewed." } }),
    s.db.add({ table: case_events, row: { case_id: ref("case2.id"), actor_id: ref("caseworker.id"), actor_role: "caseworker", event_type: "verification", from_status: "verifying", to_status: "verifying", reason: "State ID on file." } }),

    // Case 3: all checks in, ready for a determination.
    s.db.add({ table: cases, row: { applicant_id: ref("a5.id"), program: "tanf", status: "determination", assigned_to: ref("caseworker.id"), opened_reason: "Applied for temporary assistance." }, as: "case3" }),
    s.db.add({ table: verifications, row: { case_id: ref("case3.id"), type: "income", status: "verified", verified_by: ref("caseworker.id"), note: "Pay stubs reviewed." } }),
    s.db.add({ table: verifications, row: { case_id: ref("case3.id"), type: "identity", status: "verified", verified_by: ref("caseworker.id"), note: "Driver license on file." } }),
    s.db.add({ table: verifications, row: { case_id: ref("case3.id"), type: "residency", status: "verified", verified_by: ref("caseworker.id"), note: "Lease agreement verified." } }),
    s.db.add({ table: case_events, row: { case_id: ref("case3.id"), actor_id: ref("caseworker.id"), actor_role: "caseworker", event_type: "intake", from_status: "", to_status: "received", reason: "Applied for temporary assistance." } }),
    s.db.add({ table: case_events, row: { case_id: ref("case3.id"), actor_id: ref("caseworker.id"), actor_role: "caseworker", event_type: "transition", from_status: "received", to_status: "verifying", reason: "Documents requested from the applicant." } }),
    s.db.add({ table: case_events, row: { case_id: ref("case3.id"), actor_id: ref("caseworker.id"), actor_role: "caseworker", event_type: "verification", from_status: "verifying", to_status: "verifying", reason: "Pay stubs reviewed." } }),
    s.db.add({ table: case_events, row: { case_id: ref("case3.id"), actor_id: ref("caseworker.id"), actor_role: "caseworker", event_type: "verification", from_status: "verifying", to_status: "verifying", reason: "Driver license on file." } }),
    s.db.add({ table: case_events, row: { case_id: ref("case3.id"), actor_id: ref("caseworker.id"), actor_role: "caseworker", event_type: "verification", from_status: "verifying", to_status: "verifying", reason: "Lease agreement verified." } }),
    s.db.add({ table: case_events, row: { case_id: ref("case3.id"), actor_id: ref("caseworker.id"), actor_role: "caseworker", event_type: "transition", from_status: "verifying", to_status: "determination", reason: "All checks complete; ready for a determination." } }),

    // Case 4: household of five, approved by the shared rule and closed.
    s.db.add({ table: cases, row: { applicant_id: ref("a4.id"), program: "snap", status: "determination", assigned_to: ref("caseworker.id"), opened_reason: "Applied for food assistance for a household of five." }, as: "case4" }),
    s.db.add({ table: verifications, row: { case_id: ref("case4.id"), type: "income", status: "verified", verified_by: ref("caseworker.id"), note: "Pay stubs reviewed." } }),
    s.db.add({ table: verifications, row: { case_id: ref("case4.id"), type: "identity", status: "verified", verified_by: ref("caseworker.id"), note: "Passport on file." } }),
    s.db.add({ table: verifications, row: { case_id: ref("case4.id"), type: "residency", status: "verified", verified_by: ref("caseworker.id"), note: "Utility bill verified." } }),
    s.db.add({ table: case_events, row: { case_id: ref("case4.id"), actor_id: ref("caseworker.id"), actor_role: "caseworker", event_type: "intake", from_status: "", to_status: "received", reason: "Applied for food assistance for a household of five." } }),
    s.db.add({ table: case_events, row: { case_id: ref("case4.id"), actor_id: ref("caseworker.id"), actor_role: "caseworker", event_type: "transition", from_status: "received", to_status: "verifying", reason: "Documents requested from the applicant." } }),
    s.db.add({ table: case_events, row: { case_id: ref("case4.id"), actor_id: ref("caseworker.id"), actor_role: "caseworker", event_type: "verification", from_status: "verifying", to_status: "verifying", reason: "Pay stubs reviewed." } }),
    s.db.add({ table: case_events, row: { case_id: ref("case4.id"), actor_id: ref("caseworker.id"), actor_role: "caseworker", event_type: "verification", from_status: "verifying", to_status: "verifying", reason: "Passport on file." } }),
    s.db.add({ table: case_events, row: { case_id: ref("case4.id"), actor_id: ref("caseworker.id"), actor_role: "caseworker", event_type: "verification", from_status: "verifying", to_status: "verifying", reason: "Utility bill verified." } }),
    s.db.add({ table: case_events, row: { case_id: ref("case4.id"), actor_id: ref("caseworker.id"), actor_role: "caseworker", event_type: "transition", from_status: "verifying", to_status: "determination", reason: "All checks complete; ready for a determination." } }),
    s.function.run({ fn: evaluateEligibility, input: { case_id: ref("case4.id"), actor_id: ref("supervisor.id"), actor_role: c.text("supervisor") } }),

    // Case 5: single-person household, denied by the rule, then appealed.
    s.db.add({ table: cases, row: { applicant_id: ref("a2.id"), program: "snap", status: "determination", assigned_to: ref("caseworker.id"), opened_reason: "Applied for food assistance; single-person household." }, as: "case5" }),
    s.db.add({ table: verifications, row: { case_id: ref("case5.id"), type: "income", status: "verified", verified_by: ref("caseworker.id"), note: "Pay stubs reviewed." } }),
    s.db.add({ table: verifications, row: { case_id: ref("case5.id"), type: "identity", status: "verified", verified_by: ref("caseworker.id"), note: "State ID on file." } }),
    s.db.add({ table: verifications, row: { case_id: ref("case5.id"), type: "residency", status: "verified", verified_by: ref("caseworker.id"), note: "Lease agreement verified." } }),
    s.db.add({ table: case_events, row: { case_id: ref("case5.id"), actor_id: ref("caseworker.id"), actor_role: "caseworker", event_type: "intake", from_status: "", to_status: "received", reason: "Applied for food assistance; single-person household." } }),
    s.db.add({ table: case_events, row: { case_id: ref("case5.id"), actor_id: ref("caseworker.id"), actor_role: "caseworker", event_type: "transition", from_status: "received", to_status: "verifying", reason: "Documents requested from the applicant." } }),
    s.db.add({ table: case_events, row: { case_id: ref("case5.id"), actor_id: ref("caseworker.id"), actor_role: "caseworker", event_type: "verification", from_status: "verifying", to_status: "verifying", reason: "Pay stubs reviewed." } }),
    s.db.add({ table: case_events, row: { case_id: ref("case5.id"), actor_id: ref("caseworker.id"), actor_role: "caseworker", event_type: "verification", from_status: "verifying", to_status: "verifying", reason: "State ID on file." } }),
    s.db.add({ table: case_events, row: { case_id: ref("case5.id"), actor_id: ref("caseworker.id"), actor_role: "caseworker", event_type: "verification", from_status: "verifying", to_status: "verifying", reason: "Lease agreement verified." } }),
    s.db.add({ table: case_events, row: { case_id: ref("case5.id"), actor_id: ref("caseworker.id"), actor_role: "caseworker", event_type: "transition", from_status: "verifying", to_status: "determination", reason: "All checks complete; ready for a determination." } }),
    s.function.run({ fn: evaluateEligibility, input: { case_id: ref("case5.id"), actor_id: ref("supervisor.id"), actor_role: c.text("supervisor") } }),
    // The applicant appeals the denial; the case moves back to appeal.
    s.db.edit({ table: cases, fieldValue: ref("case5.id"), row: { status: "appeal" } }),
    s.db.add({ table: case_events, row: { case_id: ref("case5.id"), actor_id: ref("caseworker.id"), actor_role: "caseworker", event_type: "appeal", from_status: "closed", to_status: "appeal", reason: "Applicant appealed the income determination and provided a corrected pay stub." } }),
  ],
  response: {
    ok: c.bool(true),
    users: c.int(3),
    applicants: c.int(5),
    cases: c.int(5),
  },
});
