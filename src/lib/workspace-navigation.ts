export interface WorkspaceDestination {
  href: string;
  label: string;
  section: string;
  description: string;
  icon: string;
  keywords?: string;
}
export const workspaceDestinations: WorkspaceDestination[] = [
  {
    href: "/dashboard",
    label: "Overview",
    section: "Workspace",
    description: "Business performance and priorities",
    icon: "overview",
    keywords: "dashboard home revenue",
  },
  {
    href: "/clients",
    label: "Clients",
    section: "Workspace",
    description: "Relationships, scopes, and agreements",
    icon: "clients",
    keywords: "portfolio documents contracts",
  },
  {
    href: "/projects",
    label: "Projects",
    section: "Workspace",
    description: "Delivery, pipeline, and commercial terms",
    icon: "projects",
    keywords: "budgets sites import",
  },
  {
    href: "/time-tracking",
    label: "Time tracking",
    section: "Operations",
    description: "Submitted hours and resource reporting",
    icon: "time",
    keywords: "timesheets hours burn resources",
  },
  {
    href: "/contractor-management",
    label: "Contractors",
    section: "Operations",
    description: "Invoices, expenses, and onboarding",
    icon: "contractors",
    keywords: "AP payments invoice expenses",
  },
  {
    href: "/team",
    label: "Team",
    section: "Operations",
    description: "People, rate cards, and profitability",
    icon: "team",
    keywords: "employees resources rates",
  },
  {
    href: "/reports",
    label: "Reports",
    section: "Insights",
    description: "Statements and custom reporting",
    icon: "reports",
    keywords: "financial reports templates",
  },
  {
    href: "/ai-assistant",
    label: "Sage",
    section: "Insights",
    description: "Explore your business with Sage",
    icon: "sage",
    keywords: "AI assistant chat conversations",
  },
  {
    href: "/settings",
    label: "Settings",
    section: "Organization",
    description: "Account and workspace preferences",
    icon: "settings",
  },
];
export const personalDestinations: WorkspaceDestination[] = [
  {
    href: "/timesheet",
    label: "My timesheet",
    section: "My workspace",
    description: "Submit your hours",
    icon: "time",
  },
  {
    href: "/expense-report",
    label: "My expenses",
    section: "My workspace",
    description: "Submit an expense report",
    icon: "contractors",
  },
];
export function workspaceContext(path: string) {
  if (path.startsWith("/clients/"))
    return { label: "Client workspace", section: "Clients" };
  return (
    workspaceDestinations.find(
      (d) => path === d.href || path.startsWith(d.href + "/"),
    ) ||
    (
      {
        "/forecast": { label: "Forecast", section: "Insights" },
        "/expense-management": { label: "Expenses", section: "Operations" },
      } as Record<string, { label: string; section: string }>
    )[path] || { label: "Workspace", section: "VantageFP" }
  );
}
export function findDestinations(
  query: string,
  destinations = workspaceDestinations,
) {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return destinations.filter((d) =>
    words.every((w) =>
      `${d.label} ${d.section} ${d.description} ${d.keywords || ""}`
        .toLowerCase()
        .includes(w),
    ),
  );
}
