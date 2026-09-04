import { useState } from "react";
import { Loader2 } from "lucide-react";

import type { IntakeBody, Program } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

/**
 * Open a new case. Intake is a caseworker action; a viewer or supervisor who
 * submits is refused by the API, and the refusal surfaces as an error toast in
 * the parent. That refusal is the role based access control on display.
 */
export function IntakeForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (body: IntakeBody) => Promise<void>;
  onCancel: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("1990-01-01");
  const [household, setHousehold] = useState("3");
  const [income, setIncome] = useState("2000");
  const [email, setEmail] = useState("");
  const [program, setProgram] = useState<Program>("snap");
  const [reason, setReason] = useState("Applied for benefits.");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const body = {
        full_name: fullName.trim(),
        dob,
        household_size: Number(household),
        income_monthly: Number(income),
        contact_email: email.trim(),
        program,
        opened_reason: reason.trim(),
      } as IntakeBody;
      await onSubmit(body);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <div className="grid gap-1.5">
        <Label htmlFor="full_name">Applicant name</Label>
        <Input id="full_name" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jordan Lee" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="contact_email">Contact email</Label>
        <Input id="contact_email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jordan.lee@example.test" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="dob">Date of birth</Label>
        <Input id="dob" type="date" required value={dob} onChange={(e) => setDob(e.target.value)} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="program">Program</Label>
        <Select id="program" value={program} onChange={(e) => setProgram(e.target.value as Program)}>
          <option value="snap">SNAP</option>
          <option value="tanf">TANF</option>
          <option value="medicaid">Medicaid</option>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="household_size">Household size</Label>
        <Input id="household_size" type="number" min={1} required value={household} onChange={(e) => setHousehold(e.target.value)} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="income_monthly">Monthly income</Label>
        <Input id="income_monthly" type="number" min={0} required value={income} onChange={(e) => setIncome(e.target.value)} />
      </div>
      <div className="grid gap-1.5 sm:col-span-2">
        <Label htmlFor="opened_reason">Reason for opening</Label>
        <Textarea id="opened_reason" required value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : null}
          Open case
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
