import { mondayOf, shiftDate } from "./resource-report";
export interface ProjectReportBudget {
  project_id: string;
  month: string;
  amount: number;
  enabled?: boolean;
}
export interface BudgetProject {
  id: string;
  name: string;
  clientId: string;
  client: string;
}
export interface BudgetUsageEntry {
  resourceId?: string;
  date: string;
  projectId: string;
  hours: number;
  rate: number;
  billable: boolean;
}
// Only this projection may be passed to the report preview or PDF exporter.
export interface BudgetUtilization {
  key: string;
  level: "project" | "client" | "role" | "resource";
  basis?: "program";
  breakdown?: "project" | "role" | "resource";
  name: string;
  client: string;
  month: string;
  weekStart: string;
  weekEnd: string;
  mtdEnd: string;
  weekHours: number;
  mtdHours: number;
  weekPercent: number | null;
  mtdPercent: number | null;
  projectCount: number;
}
export const percentLabel = (value: number | null) =>
  value === null
    ? "Unavailable"
    : `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
export function budgetMonths(start: string, end: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(start) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(end) ||
    start > end
  )
    return [];
  const months: string[] = [];
  let date = `${start.slice(0, 7)}-01`;
  while (date <= end && months.length < 14) {
    months.push(date);
    const next = new Date(`${date}T12:00:00Z`);
    next.setUTCMonth(next.getUTCMonth() + 1);
    date = next.toISOString().slice(0, 10);
  }
  return months;
}
export function budgetUtilization(
  entries: BudgetUsageEntry[],
  projects: BudgetProject[],
  budgets: ProjectReportBudget[],
  selectedProjects: string[],
  start: string,
  end: string,
  asOf = end,
): BudgetUtilization[] {
  const cutoff = end < asOf ? end : asOf;
  if (start > cutoff) return [];
  const output: BudgetUtilization[] = [];
  for (const month of budgetMonths(start, cutoff)) {
    const next = new Date(`${month}T12:00:00Z`);
    next.setUTCMonth(next.getUTCMonth() + 1);
    const monthEnd = shiftDate(next.toISOString().slice(0, 10), -1);
    const periodStart = start > month ? start : month;
    const periodEnd = cutoff < monthEnd ? cutoff : monthEnd;
    const configured = budgets.filter(
      (b) =>
        b.enabled !== false &&
        b.month === month &&
        selectedProjects.includes(b.project_id) &&
        Number.isFinite(Number(b.amount)) &&
        Number(b.amount) > 0 &&
        projects.some((p) => p.id === b.project_id),
    );
    for (
      let week = mondayOf(periodStart);
      week <= periodEnd;
      week = shiftDate(week, 7)
    ) {
      const from = week < periodStart ? periodStart : week,
        sunday = shiftDate(week, 6),
        through = sunday < periodEnd ? sunday : periodEnd;
      const clientGroups = new Map<
        string,
        { name: string; ids: string[]; denominator: number }
      >();
      const calculate = (ids: string[], denominator: number) => {
        let wh = 0,
          mh = 0,
          wv = 0,
          mv = 0,
          missingWeek = false,
          missingMtd = false;
        for (const e of entries) {
          const date = e.date.slice(0, 10),
            hours = Number(e.hours),
            rate = Number(e.rate);
          if (
            !ids.includes(e.projectId) ||
            !e.billable ||
            date < month ||
            date > through ||
            !Number.isFinite(hours) ||
            hours <= 0
          )
            continue;
          mh += hours;
          const inWeek = date >= from;
          if (inWeek) wh += hours;
          if (!Number.isFinite(rate) || rate <= 0) {
            missingMtd = true;
            if (inWeek) missingWeek = true;
            continue;
          }
          mv += hours * rate;
          if (inWeek) wv += hours * rate;
        }
        return {
          weekHours: wh,
          mtdHours: mh,
          weekPercent: missingWeek ? null : (wv / denominator) * 100,
          mtdPercent: missingMtd ? null : (mv / denominator) * 100,
        };
      };
      for (const budget of configured) {
        const project = projects.find((p) => p.id === budget.project_id)!;
        output.push({
          key: JSON.stringify(["project", project.id, month, week]),
          level: "project",
          name: project.name,
          client: project.client,
          month,
          weekStart: from,
          weekEnd: through,
          mtdEnd: through,
          projectCount: 1,
          ...calculate([project.id], Number(budget.amount)),
        });
        const group = clientGroups.get(project.clientId) || {
          name: project.client || "Unassigned client",
          ids: [],
          denominator: 0,
        };
        group.ids.push(project.id);
        group.denominator += Number(budget.amount);
        clientGroups.set(project.clientId, group);
      }
      for (const [id, group] of Array.from(clientGroups.entries()))
        output.push({
          key: JSON.stringify(["client", id, month, week]),
          level: "client",
          name: group.name,
          client: group.name,
          month,
          weekStart: from,
          weekEnd: through,
          mtdEnd: through,
          projectCount: group.ids.length,
          ...calculate(group.ids, group.denominator),
        });
    }
  }
  return output;
}

export const utilizationTitle = (rows: BudgetUtilization[]) =>
  rows.some((r) => r.basis === "program")
    ? "Monthly program utilization"
    : "Monthly budget utilization";
export const utilizationCaption = (rows: BudgetUtilization[]) =>
  rows.some((r) => r.basis === "program")
    ? "Whole-client billable usage across all sites and resources. Each percentage is a share of one monthly program projection."
    : "Full project usage across all resources. Both percentages use the monthly allocation; client totals cover configured selected projects.";
export const utilizationScope = (row: BudgetUtilization) =>
  row.basis === "program"
    ? `${row.projectCount} program site(s) · all resources`
    : `${row.projectCount} configured project(s)`;
