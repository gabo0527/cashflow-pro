import {
  BudgetProject,
  BudgetUsageEntry,
  BudgetUtilization,
  budgetUtilization,
} from "./resource-report-budget";
import { ResourceSubmission } from "./resource-report";

export interface ProgramProjection {
  client_id: string;
  month: string;
  amount: number;
  enabled: boolean;
}
export interface ReportingRole {
  client_id: string;
  team_member_id: string;
  role: string;
}
export type ProgramBreakdown = "project" | "role" | "resource";
export const roleFor = (
  roles: ReportingRole[],
  clientId: string,
  resourceId: string,
) =>
  roles
    .find((r) => r.client_id === clientId && r.team_member_id === resourceId)
    ?.role.trim() || "Unassigned role";

// A role report uses role identities before aggregation and summarization, so
// names cannot leak through MTD rows, PDF fields, or generated summary prompts.
export function submissionsByRole(
  entries: ResourceSubmission[],
  projects: BudgetProject[],
  roles: ReportingRole[],
) {
  return entries.map((entry) => {
    const clientId =
      projects.find((p) => p.id === entry.project_id)?.clientId || "";
    const role = roleFor(roles, clientId, entry.team_member_id);
    return {
      ...entry,
      team_member_id: JSON.stringify([clientId, role.toLowerCase()]),
      team_member_name: role,
    };
  });
}

// All program sites and resources contribute regardless of the work-detail
// filters. Each breakdown row shares the one client/month denominator.
export function programUtilization(
  entries: BudgetUsageEntry[],
  projects: BudgetProject[],
  projections: ProgramProjection[],
  selectedProjects: string[],
  start: string,
  end: string,
  asOf = end,
  breakdown: ProgramBreakdown = "project",
  roles: ReportingRole[] = [],
  resources: { id: string; label: string }[] = [],
): BudgetUtilization[] {
  const clientIds = new Set(
    projects
      .filter((p) => selectedProjects.includes(p.id))
      .map((p) => p.clientId),
  );
  const output: BudgetUtilization[] = [];
  for (const projection of projections) {
    if (
      !projection.enabled ||
      !clientIds.has(projection.client_id) ||
      !Number.isFinite(Number(projection.amount)) ||
      Number(projection.amount) <= 0
    )
      continue;
    const sites = projects.filter((p) => p.clientId === projection.client_id);
    if (!sites.length) continue;
    const siteIds = new Set(sites.map((p) => p.id));
    const usage = entries.filter((e) => siteIds.has(e.projectId));
    const groups = new Map<
      string,
      { name: string; entries: BudgetUsageEntry[] }
    >();
    if (breakdown === "project") {
      sites.forEach((p) =>
        groups.set(p.id, {
          name: p.name,
          entries: usage.filter((e) => e.projectId === p.id),
        }),
      );
    } else {
      for (const entry of usage) {
        const name =
          breakdown === "role"
            ? roleFor(roles, projection.client_id, entry.resourceId || "")
            : resources.find((r) => r.id === entry.resourceId)?.label ||
              "Unknown resource";
        const key =
          breakdown === "role"
            ? name.toLowerCase()
            : entry.resourceId || "unknown";
        const group = groups.get(key) || { name, entries: [] };
        group.entries.push(entry);
        groups.set(key, group);
      }
    }
    const calculate = (groupEntries: BudgetUsageEntry[]) =>
      budgetUtilization(
        groupEntries.map((e) => ({ ...e, projectId: "program" })),
        [
          {
            id: "program",
            name: "Program",
            clientId: projection.client_id,
            client: sites[0].client,
          },
        ],
        [
          {
            project_id: "program",
            month: projection.month,
            amount: Number(projection.amount),
          },
        ],
        ["program"],
        start,
        end,
        asOf,
      ).filter((r) => r.level === "project");
    for (const [id, group] of Array.from(groups.entries()).sort((a, b) =>
      a[1].name.localeCompare(b[1].name),
    )) {
      for (const row of calculate(group.entries)) {
        // Omit people without activity in the applicable month; sites remain
        // visible at zero so the full program scope is apparent.
        if (breakdown !== "project" && !row.mtdHours) continue;
        output.push({
          ...row,
          key: JSON.stringify([
            "program",
            projection.client_id,
            projection.month,
            row.weekStart,
            breakdown,
            id,
          ]),
          level: breakdown,
          name: group.name,
          basis: "program",
          breakdown,
          projectCount: sites.length,
        });
      }
    }
    for (const row of calculate(usage))
      output.push({
        ...row,
        key: JSON.stringify([
          "program",
          projection.client_id,
          projection.month,
          row.weekStart,
          "total",
        ]),
        level: "client",
        name: sites[0].client,
        basis: "program",
        breakdown,
        projectCount: sites.length,
      });
  }
  return output;
}

// Stable compact revision keeps AI row keys bounded, and requires a fresh
// review when role membership changes the aggregated hours or source notes.
export function roleRowRevision(value: unknown) {
  let a = 2166136261,
    b = 2246822507;
  for (const c of JSON.stringify(value)) {
    a = Math.imul(a ^ c.charCodeAt(0), 16777619);
    b = Math.imul(b ^ c.charCodeAt(0), 3266489909);
  }
  return (a >>> 0).toString(36) + (b >>> 0).toString(36);
}
