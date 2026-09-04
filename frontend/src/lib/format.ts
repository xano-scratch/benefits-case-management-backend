// Small display helpers. Values coerce with Number() so an int that arrives as a
// string still formats correctly.

export function formatMoney(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === "") return "—";
  return "$" + Math.round(Number(n)).toLocaleString("en-US") + "/mo";
}

export function formatDob(dob: string | number | null | undefined): string {
  if (dob === null || dob === undefined || dob === "") return "Not set";
  // dob is stored as a date string (YYYY-MM-DD); render it in a readable form.
  const d = new Date(`${dob}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(dob);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(epochms: number | string | null | undefined): string {
  if (epochms === null || epochms === undefined || epochms === "") return "";
  const d = new Date(Number(epochms));
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
