"use client";
import React, { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Search,
  MessageSquare,
  ChevronDown,
  Settings,
  LogOut,
  Menu,
  ChevronRight,
  X,
  ArrowUpRight,
} from "lucide-react";
import {
  workspaceContext,
  findDestinations,
  workspaceDestinations,
} from "@/lib/workspace-navigation";
interface HeaderProps {
  userEmail?: string;
  userName?: string;
  onOpenChat: () => void;
  sidebarCollapsed: boolean;
  onSignOut?: () => void;
  onOpenNavigation?: () => void;
}
export default function Header({
  userEmail,
  userName,
  onOpenChat,
  sidebarCollapsed,
  onSignOut,
  onOpenNavigation,
}: HeaderProps) {
  const pathname = usePathname(),
    router = useRouter(),
    context = workspaceContext(pathname);
  const [menuOpen, setMenuOpen] = useState(false),
    [query, setQuery] = useState(""),
    [index, setIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null),
    searchDialog = useRef<HTMLDialogElement>(null),
    input = useRef<HTMLInputElement>(null);
  const results = findDestinations(query),
    displayName = userName || userEmail?.split("@")[0] || "Your account";
  const openSearch = () => {
    setQuery("");
    setIndex(0);
    if (!searchDialog.current?.open) searchDialog.current?.showModal();
    input.current?.focus();
  };
  const closeSearch = () => searchDialog.current?.close();
  useEffect(() => {
    const click = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openSearch();
      }
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", click);
    window.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", click);
      window.removeEventListener("keydown", key);
    };
  }, []);
  useEffect(() => {
    setMenuOpen(false);
    closeSearch();
  }, [pathname]);
  const navigate = (href: string) => {
    closeSearch();
    router.push(href);
  };
  return (
    <>
      <header
        className={`workspace-topbar ${sidebarCollapsed ? "is-collapsed" : ""}`}
      >
        <div className="workspace-topbar-left">
          <button
            className="workspace-menu-button ui-icon-button"
            aria-label="Open navigation"
            aria-controls="workspace-navigation"
            onClick={onOpenNavigation}
          >
            <Menu size={20} />
          </button>
          <div className="workspace-breadcrumb">
            <span>{context.section}</span>
            <ChevronRight size={13} aria-hidden />
            <strong>{context.label}</strong>
          </div>
        </div>
        <div className="workspace-topbar-actions">
          <button className="workspace-search-trigger" onClick={openSearch}>
            <Search size={16} aria-hidden />
            <span>Find a page</span>
            <kbd>⌘ K</kbd>
          </button>
          <button className="workspace-sage-trigger" onClick={onOpenChat}>
            <MessageSquare size={16} aria-hidden />
            <span>Ask Sage</span>
          </button>
          <div className="workspace-account" ref={menuRef}>
            <button
              className="workspace-account-trigger"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-expanded={menuOpen}
              aria-label="Account menu"
            >
              <span className="workspace-user-avatar">
                {displayName
                  .split(/\s+/)
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </span>
              <ChevronDown size={13} />
            </button>
            {menuOpen && (
              <div className="workspace-account-menu">
                <div>
                  <strong>{displayName}</strong>
                  {userEmail && <span>{userEmail}</span>}
                </div>
                <a href="/settings">
                  <Settings size={15} />
                  Account settings
                </a>
                {onSignOut && (
                  <button onClick={onSignOut}>
                    <LogOut size={15} />
                    Sign out
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>
      <dialog
        className="workspace-command"
        ref={searchDialog}
        aria-labelledby="workspace-command-title"
        onClick={(e) => {
          if (e.target === searchDialog.current) closeSearch();
        }}
      >
        <div className="workspace-command-search">
          <Search size={19} aria-hidden />
          <label
            className="sr-only"
            id="workspace-command-title"
            htmlFor="workspace-page-search"
          >
            Find a workspace page
          </label>
          <input
            id="workspace-page-search"
            ref={input}
            placeholder="Where would you like to go?"
            value={query}
            autoComplete="off"
            onChange={(e) => {
              setQuery(e.target.value);
              setIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setIndex((i) => Math.min(i + 1, results.length - 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setIndex((i) => Math.max(0, i - 1));
              }
              if (e.key === "Enter" && results[index]) {
                e.preventDefault();
                navigate(results[index].href);
              }
            }}
          />
          <button
            className="ui-icon-button"
            aria-label="Close page search"
            onClick={closeSearch}
          >
            <X size={18} />
          </button>
        </div>
        <div className="workspace-command-results">
          <p>{query ? "Matching pages" : "Your workspace"}</p>
          {results.map((d, i) => (
            <button
              key={d.href}
              className={i === index ? "is-selected" : ""}
              onMouseEnter={() => setIndex(i)}
              onClick={() => navigate(d.href)}
            >
              <span>
                <strong>{d.label}</strong>
                <small>{d.description}</small>
              </span>
              <ArrowUpRight size={17} aria-hidden />
            </button>
          ))}
          {!results.length && (
            <div className="workspace-command-empty">
              No pages match “{query}”. Try clients, hours, reports, or
              settings.
            </div>
          )}
        </div>
        <footer>
          <span>Search pages and destinations</span>
          <span>↑ ↓ Navigate · Enter Open</span>
        </footer>
      </dialog>
    </>
  );
}
