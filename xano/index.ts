import { workspace } from "@xanots/sdk";

// Tables
import { users } from "./tables/users.js";
import { applicants } from "./tables/applicants.js";
import { cases } from "./tables/cases.js";
import { verifications } from "./tables/verifications.js";
import { determinations } from "./tables/determinations.js";
import { case_events } from "./tables/case-events.js";

// API groups
import {
  authApi,
  casesApi,
  verificationsApi,
  determinationsApi,
  appealsApi,
  seedApi,
} from "./api/groups.js";

// Shared logic
import { evaluateEligibility } from "./functions/evaluate-eligibility.js";

// Endpoints
import { loginQuery } from "./api/auth-login.js";
import { intakeQuery } from "./api/cases-intake.js";
import { listQuery } from "./api/cases-list.js";
import { getQuery } from "./api/cases-get.js";
import { advanceQuery } from "./api/cases-advance.js";
import { recordQuery } from "./api/verifications-record.js";
import { decideQuery } from "./api/determinations-decide.js";
import { fileQuery } from "./api/appeals-file.js";
import { seedQuery } from "./api/seed.js";

/**
 * The Benefits Case Management backend: a governed case lifecycle, a versioned
 * eligibility rule, and an append-only audit trail in one API layer, with
 * API-layer RBAC (never row-level security). See xano/EXAMPLE.md and the README.
 */
export default workspace("benefits-case-management-backend")
  .registerTables([users, applicants, cases, verifications, determinations, case_events])
  .registerApiGroups([authApi, casesApi, verificationsApi, determinationsApi, appealsApi, seedApi])
  .registerFunctions([evaluateEligibility])
  .registerQueries([
    loginQuery,
    intakeQuery,
    listQuery,
    getQuery,
    advanceQuery,
    recordQuery,
    decideQuery,
    fileQuery,
    seedQuery,
  ]);
