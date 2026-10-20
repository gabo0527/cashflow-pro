// This boundary deliberately projects submission data into an hours-only report.
export interface ResourceSubmission {
  date: string;
  hours: number;
  team_member_id: string;
  team_member_name: string;
  project_id: string;
  project_name: string;
  client_name: string;
  notes: string | null;
}
export interface ResourceReportRow {
  key: string;
  week: string;
  resource: string;
  project: string;
  client: string;
  hours: number;
  notes: { date: string; note: string }[];
  missingDescriptions: number;
}
export function mondayOf(iso: string) {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}
export function shiftDate(iso: string, days: number) {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function reportRows(
  entries: ResourceSubmission[],
  start: string,
  end: string,
  projects: string[],
  resources: string[],
) {
  const rows = new Map<string, ResourceReportRow>();
  for (const e of entries) {
    const date = e.date.slice(0, 10);
    if (
      date < start ||
      date > end ||
      !projects.includes(e.project_id) ||
      !resources.includes(e.team_member_id)
    )
      continue;
    const hours = Number(e.hours);
    if (!Number.isFinite(hours) || hours <= 0) continue;
    const week = mondayOf(date),
      key = JSON.stringify([week, e.project_id, e.team_member_id]);
    let row = rows.get(key);
    if (!row) {
      row = {
        key,
        week,
        resource: e.team_member_name,
        project: e.project_name,
        client: e.client_name,
        hours: 0,
        notes: [],
        missingDescriptions: 0,
      };
      rows.set(key, row);
    }
    row.hours += hours;
    const note = (e.notes || "").trim();
    if (!note) row.missingDescriptions++;
    else if (
      !row.notes.some(
        (n) =>
          n.note.toLowerCase().replace(/\s+/g, " ") ===
          note.toLowerCase().replace(/\s+/g, " "),
      )
    )
      row.notes.push({ date, note });
  }
  return Array.from(rows.values()).sort(
    (a, b) =>
      a.week.localeCompare(b.week) ||
      a.client.localeCompare(b.client) ||
      a.project.localeCompare(b.project) ||
      a.resource.localeCompare(b.resource),
  );
}
export const hoursLabel = (hours: number) =>
  hours.toLocaleString("en-US", { maximumFractionDigits: 2 });
export const reportDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
