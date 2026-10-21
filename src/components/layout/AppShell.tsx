"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import IdleLogout from "@/components/IdleLogout";
import Header from "./Header";
import ChatPanel from "@/components/ai/ChatPanel";
import VantageLogo from "@/components/brand/VantageLogo";
import { cn } from "@/lib/utils";
import {
  supabase,
  signOut,
  getCurrentUser,
  getCurrentProfile,
  fetchCompanySettings,
} from "@/lib/supabase";

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();

  // Auth state
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // UI state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!mobileOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const panel = document.getElementById("workspace-navigation");
    const focusables = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>(
          "a[href],button:not([disabled])",
        ) || [],
      ).filter((e) => e.getClientRects().length);
    focusables()[0]?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileOpen(false);
      }
      if (event.key !== "Tab") return;
      const items = focusables(),
        first = items[0],
        last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    const resize = () => {
      if (window.innerWidth >= 1024) setMobileOpen(false);
    };
    window.addEventListener("keydown", key);
    window.addEventListener("resize", resize);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", key);
      window.removeEventListener("resize", resize);
      previousFocus?.focus();
    };
  }, [mobileOpen]);

  // Load sidebar state from localStorage
  useEffect(() => {
    const savedCollapsed = localStorage.getItem("vantage-sidebar-collapsed");
    if (savedCollapsed === "true") {
      setSidebarCollapsed(true);
    }
  }, []);

  // Save sidebar state
  const handleSidebarToggle = useCallback(() => {
    const newCollapsed = !sidebarCollapsed;
    setSidebarCollapsed(newCollapsed);
    localStorage.setItem("vantage-sidebar-collapsed", String(newCollapsed));
  }, [sidebarCollapsed]);

  // Public routes that skip auth entirely
  const PUBLIC_PATHS = [
    "/login",
    "/portal",
    "/timesheet",
    "/contractor-portal",
    "/expense-report",
    "/terms",
    "/privacy",
  ];

  // Auth check
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Skip auth for public/portal routes
        if (
          PUBLIC_PATHS.some(
            (p) => pathname === p || pathname.startsWith(p + "/"),
          )
        ) {
          setLoading(false);
          return;
        }

        const { user } = await getCurrentUser();

        if (!user) {
          router.push("/login");
          return;
        }

        setUser(user);

        const { profile } = await getCurrentProfile();
        setProfile(profile);

        if (profile?.company_id) {
          setCompanyId(profile.company_id);

          const { data: settings } = await fetchCompanySettings(
            profile.company_id,
          );
          if (settings?.company_name) {
            setCompanyName(settings.company_name);
          } else {
            const { data: co } = await supabase
              .from("companies")
              .select("name")
              .eq("id", profile.company_id)
              .single();
            if (co?.name) setCompanyName(co.name);
          }
        }

        setLoading(false);
      } catch (error) {
        console.error("Auth error:", error);
        router.push("/login");
      }
    };

    checkAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        router.push("/login");
      }
    });

    return () => subscription.unsubscribe();
  }, [router, pathname]);

  // Listen for company name updates from Settings page
  useEffect(() => {
    const handler = (e: any) => {
      if (e.detail?.name) setCompanyName(e.detail.name);
    };
    window.addEventListener("company-updated", handler);
    return () => window.removeEventListener("company-updated", handler);
  }, []);

  // Handle sign out
  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  // Skip shell for public/portal pages
  if (
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))
  ) {
    return <>{children}</>;
  }

  // Loading state
  if (loading)
    return (
      <div className="workspace-loading" role="status">
        <VantageLogo className="workspace-loading-logo" />
        <span>Opening your workspace…</span>
        <div />
      </div>
    );

  return (
    <div
      className={`v-app workspace-app ${sidebarCollapsed ? "navigation-collapsed" : ""}`}
    >
      <a className="workspace-skip-link" href="#workspace-content">
        Skip to content
      </a>
      {mobileOpen && (
        <button
          tabIndex={-1}
          aria-label="Close navigation backdrop"
          className="workspace-navigation-scrim"
          onClick={() => setMobileOpen(false)}
        />
      )}
      {/* Privacy: auto sign-out after 10 min of inactivity (60s warning) */}
      {user && <IdleLogout onLogout={handleSignOut} />}

      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={handleSidebarToggle}
        companyName={companyName}
        onSignOut={handleSignOut}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* Header */}
      <Header
        userEmail={user?.email}
        userName={profile?.full_name}
        onOpenChat={() => setChatOpen(true)}
        sidebarCollapsed={sidebarCollapsed}
        onSignOut={handleSignOut}
        onOpenNavigation={() => setMobileOpen(true)}
        navigationOpen={mobileOpen}
      />

      {/* Main Content */}
      <main id="workspace-content" tabIndex={-1} className="workspace-main">
        <div
          className="workspace-page"
          data-workspace-page={pathname.split("/")[1] || "dashboard"}
        >
          {React.Children.map(children, (child) => {
            if (React.isValidElement(child)) {
              return React.cloneElement(child, {
                // @ts-ignore
                companyId,
                user,
                profile,
              });
            }
            return child;
          })}
        </div>
      </main>

      {/* AI Chat Panel */}
      <ChatPanel
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        theme="light"
        companyId={companyId}
      />
    </div>
  );
}
