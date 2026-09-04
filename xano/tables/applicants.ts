import { table, f } from "@xanots/sdk";

/**
 * A person who applied for a benefit. `income_monthly` and `household_size` are
 * the operational data the eligibility rule reads. Income is held as a whole
 * number of dollars per month (an int), which is all the rule needs.
 */
export const applicants = table({
  name: "applicants",
  schema: {
    full_name: f.text({ required: true }),
    dob: f.date(),
    household_size: f.int({ required: true }),
    income_monthly: f.int({ required: true }),
    contact_email: f.email(),
  },
});
