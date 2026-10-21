"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Clock3,
  ClipboardList,
  UserRound,
  BarChart3,
  MessageSquare,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  X,
} from "lucide-react";
import VantageLogo from "@/components/brand/VantageLogo";
import {
  workspaceDestinations,
  personalDestinations,
} from "@/lib/workspace-navigation";
interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  companyName?: string;
  onSignOut: () => void;
  userRole?: "owner" | "admin" | "member" | "viewer" | "employee" | string;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}
const icons: Record<string, typeof LayoutDashboard> = {
  overview: LayoutDashboard,
  clients: Users,
  projects: FolderKanban,
  time: Clock3,
  contractors: ClipboardList,
  team: UserRound,
  reports: BarChart3,
  sage: MessageSquare,
  settings: Settings,
};
export default function Sidebar({
  collapsed,
  onToggle,
  companyName,
  onSignOut,
  userRole = "owner",
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname();
  const destinations =
    userRole === "owner" || userRole === "admin"
      ? workspaceDestinations
      : personalDestinations;
  return (
    <aside
      id="workspace-navigation"
      aria-label="Workspace navigation"
      role={mobileOpen ? "dialog" : undefined}
      aria-modal={mobileOpen ? true : undefined}
      className={`workspace-sidebar ${collapsed ? "is-collapsed" : ""} ${mobileOpen ? "is-mobile-open" : ""}`}
    >
      <div className="workspace-sidebar-brand">
        <Link href="/" aria-label="VantageFP home" onClick={onMobileClose}>
          <VantageLogo className="workspace-logo" />
        </Link>
        <button
          className="workspace-mobile-close"
          aria-label="Close navigation"
          onClick={onMobileClose}
        >
          <X size={19} />
        </button>
      </div>
      <div className="workspace-company">
        <span className="workspace-company-avatar">
          {(companyName || "Workspace").slice(0, 1).toUpperCase()}
        </span>
        <div>
          <span>Organization</span>
          <strong title={companyName}>{companyName || "Your workspace"}</strong>
        </div>
      </div>
      <nav aria-label="Main navigation">
        {Array.from(new Set(destinations.map((d) => d.section))).map(
          (section) => (
            <div className="workspace-nav-group" key={section}>
              <p>{section}</p>
              {destinations
                .filter((d) => d.section === section)
                .map((item) => {
                  const Icon = icons[item.icon],
                    active =
                      pathname === item.href ||
                      pathname.startsWith(item.href + "/");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onMobileClose}
                      aria-current={active ? "page" : undefined}
                      title={collapsed ? item.label : undefined}
                      className="workspace-nav-link"
                    >
                      <Icon size={18} strokeWidth={1.65} aria-hidden />
                      <span>{item.label}</span>
                      {active && <i aria-hidden />}
                    </Link>
                  );
                })}
            </div>
          ),
        )}
      </nav>
      <div className="workspace-sidebar-bottom">
        <button onClick={onSignOut} title={collapsed ? "Sign out" : undefined}>
          <LogOut size={17} strokeWidth={1.6} aria-hidden />
          <span>Sign out</span>
        </button>
        <button
          className="workspace-collapse"
          onClick={onToggle}
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          aria-expanded={!collapsed}
        >
          {collapsed ? (
            <PanelLeftOpen size={17} />
          ) : (
            <PanelLeftClose size={17} />
          )}
          <span>Collapse navigation</span>
        </button>
        <div className="workspace-sidebar-signature">
          <span />
          <span>Business operations, in focus.</span>
        </div>
      </div>
    </aside>
  );
}
