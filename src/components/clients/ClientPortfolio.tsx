"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  Download,
  ArrowUpRight,
  FileText,
  MoreHorizontal,
  LayoutGrid,
  List,
  X,
} from "lucide-react";
import "./client-portfolio.css";

export interface PortfolioClient {
  id: string;
  name: string;
  status: string;
  payment_terms: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  active: number;
  tm: number;
  ls: number;
  resources: string[];
  hours: number;
  lastActivity?: string;
  scopes: { id: string; name: string }[];
}
type Group = "status" | "terms" | "billing";
type Filters = {
  search: string;
  lifecycle: string;
  billing: string;
  work: string;
  sort: string;
  groups: Group[];
};
const terms = (value: string) =>
  (value || "").replace(/^net[_\s-]?(\d+)$/i, "Net $1") || "Terms not set";
const billing = (c: PortfolioClient) =>
  c.tm && c.ls
    ? "Mixed billing"
    : c.ls
      ? "Monthly fee"
      : c.tm
        ? "Time & materials"
        : "No active billing";
const fmt = (n: number) =>
  n.toLocaleString("en-US", { maximumFractionDigits: 1 });
const groupLabel = (c: PortfolioClient, g: Group) =>
  g === "terms"
    ? terms(c.payment_terms)
    : g === "billing"
      ? billing(c)
      : c.status.charAt(0).toUpperCase() + c.status.slice(1);
const defaults: Filters = {
  search: "",
  lifecycle: "current",
  billing: "all",
  work: "all",
  sort: "name",
  groups: [],
};

export function selectPortfolio(clients: PortfolioClient[], filters: Filters) {
  const query = filters.search.trim().toLowerCase();
  return clients
    .filter(
      (c) =>
        (filters.lifecycle === "all" ||
          (filters.lifecycle === "current"
            ? c.status !== "archived"
            : c.status === filters.lifecycle)) &&
        (filters.billing === "all" ||
          (filters.billing === "tm" ? c.tm > 0 : c.ls > 0)) &&
        (filters.work === "all" ||
          (filters.work === "scopes" ? c.active > 0 : c.active === 0)) &&
        (!query ||
          [
            c.name,
            c.contact_name,
            c.email,
            c.phone,
            ...c.scopes.map((s) => s.name),
            ...c.resources,
          ]
            .join(" ")
            .toLowerCase()
            .includes(query)),
    )
    .sort((a, b) =>
      filters.sort === "scopes"
        ? b.active - a.active || a.name.localeCompare(b.name)
        : filters.sort === "hours"
          ? b.hours - a.hours || a.name.localeCompare(b.name)
          : filters.sort === "activity"
            ? (b.lastActivity || "").localeCompare(a.lastActivity || "") ||
              a.name.localeCompare(b.name)
            : a.name.localeCompare(b.name),
    );
}

function groupPortfolio(clients: PortfolioClient[], groups: Group[]) {
  const result = new Map<
    string,
    { labels: string[]; clients: PortfolioClient[] }
  >();
  clients.forEach((c) => {
    const labels = groups.map((g) => groupLabel(c, g)),
      key = JSON.stringify(labels);
    if (!result.has(key)) result.set(key, { labels, clients: [] });
    result.get(key)!.clients.push(c);
  });
  return Array.from(result.values());
}

export default function ClientPortfolio({
  clients,
  totals,
  onAdd,
  onExport,
  onEdit,
  onStatus,
  onDelete,
}: {
  clients: PortfolioClient[];
  totals: { scopes: number; resources: number; hours: number };
  onAdd: () => void;
  onExport: () => void;
  onEdit: (id: string) => void;
  onStatus: (id: string, status: string) => void;
  onDelete: (id: string) => void;
}) {
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if (
        event.key === "/" &&
        !(
          document.activeElement instanceof HTMLElement &&
          (["INPUT", "TEXTAREA", "SELECT"].includes(
            document.activeElement.tagName,
          ) ||
            document.activeElement.isContentEditable)
        )
      ) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);
  const [filters, setFilters] = useState<Filters>(defaults);
  const [view, setView] = useState<"cards" | "comparison">("cards");
  const [menu, setMenu] = useState<string | null>(null);
  const shown = useMemo(
    () => selectPortfolio(clients, filters),
    [clients, filters],
  );
  const grouped = useMemo(
    () => groupPortfolio(shown, filters.groups),
    [shown, filters.groups],
  );
  const update = (key: keyof Filters, value: string) =>
    setFilters((f) => ({ ...f, [key]: value }));
  const toggleGroup = (g: Group) =>
    setFilters((f) => ({
      ...f,
      groups: f.groups.includes(g)
        ? f.groups.filter((v) => v !== g)
        : [...f.groups, g],
    }));
  const activeFilters =
    filters.search ||
    filters.lifecycle !== defaults.lifecycle ||
    filters.billing !== "all" ||
    filters.work !== "all" ||
    filters.groups.length > 0;
  const actions = (c: PortfolioClient) => (
    <div className="cp-actions">
      <button
        aria-label={`Manage ${c.name}`}
        aria-expanded={menu === c.id}
        onClick={() => setMenu(menu === c.id ? null : c.id)}
      >
        <MoreHorizontal size={19} />
      </button>
      {menu === c.id && (
        <div className="cp-menu">
          <button
            onClick={() => {
              setMenu(null);
              onEdit(c.id);
            }}
          >
            Edit client
          </button>
          <button
            onClick={() => {
              setMenu(null);
              onStatus(c.id, c.status === "archived" ? "active" : "archived");
            }}
          >
            {c.status === "archived" ? "Restore client" : "Archive client"}
          </button>
          <button
            className="cp-delete"
            onClick={() => {
              setMenu(null);
              onDelete(c.id);
            }}
          >
            Delete client
          </button>
          <button onClick={() => setMenu(null)}>Close menu</button>
        </div>
      )}
    </div>
  );
  const links = (c: PortfolioClient) => (
    <div className="cp-links">
      <Link href={`/clients/${c.id}`}>
        Open workspace <ArrowUpRight size={14} />
      </Link>
      <Link href={`/clients/${c.id}?tab=documents`}>
        <FileText size={14} /> Commercial docs
      </Link>
    </div>
  );

  return (
    <div className="client-portfolio">
      <header className="cp-header">
        <div>
          <div className="cp-eyebrow">Portfolio / Relationships</div>
          <h1>
            Clients<span>.</span>
          </h1>
          <p>
            Your clients, scopes and commercial agreements. One connected
            workspace.
          </p>
        </div>
        <div className="cp-header-actions">
          <button
            onClick={onExport}
            title="Export the entire client portfolio to CSV"
          >
            <Download size={15} /> Export CSV
          </button>
          <button className="cp-primary" onClick={onAdd}>
            <Plus size={16} /> Add client
          </button>
        </div>
      </header>
      <section className="cp-totals" aria-label="Entire portfolio totals">
        {[
          [
            "Current clients",
            clients.filter((c) => c.status !== "archived").length,
            `${clients.filter((c) => c.status === "archived").length} archived`,
          ],
          ["Active scopes", totals.scopes, "Across the portfolio"],
          ["People assigned", totals.resources, "On active scopes"],
          ["Hours this month", fmt(totals.hours), "Draft entries excluded"],
        ].map(([label, number, hint]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{number}</strong>
            <small>{hint}</small>
          </div>
        ))}
      </section>
      <section className="cp-controls" aria-label="Find and organize clients">
        <div className="cp-control-top">
          <label className="cp-search">
            <Search size={17} />
            <input
              ref={searchRef}
              aria-label="Search clients, scopes or people"
              placeholder="Find a client, scope or person…"
              value={filters.search}
              onChange={(e) => update("search", e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") update("search", "");
              }}
            />
          </label>
          <div className="cp-view" aria-label="Display">
            <button
              aria-pressed={view === "cards"}
              onClick={() => setView("cards")}
            >
              <LayoutGrid size={16} /> Cards
            </button>
            <button
              aria-pressed={view === "comparison"}
              onClick={() => setView("comparison")}
            >
              <List size={16} /> Compare
            </button>
          </div>
        </div>
        <div className="cp-filter-row">
          <label>
            Client status
            <select
              value={filters.lifecycle}
              onChange={(e) => update("lifecycle", e.target.value)}
            >
              <option value="current">Current clients</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="archived">Archived</option>
              <option value="all">All clients</option>
            </select>
          </label>
          <label>
            Billing
            <select
              value={filters.billing}
              onChange={(e) => update("billing", e.target.value)}
            >
              <option value="all">All billing models</option>
              <option value="tm">Time & materials</option>
              <option value="fee">Monthly fee</option>
            </select>
          </label>
          <label>
            Scope activity
            <select
              value={filters.work}
              onChange={(e) => update("work", e.target.value)}
            >
              <option value="all">All scope activity</option>
              <option value="scopes">With active scopes</option>
              <option value="none">No active scopes</option>
            </select>
          </label>
          <label>
            Sort by
            <select
              value={filters.sort}
              onChange={(e) => update("sort", e.target.value)}
            >
              <option value="name">Client name · A–Z</option>
              <option value="scopes">Most active scopes</option>
              <option value="hours">Most hours this month</option>
              <option value="activity">Latest activity</option>
            </select>
          </label>
        </div>
        <div className="cp-group-row">
          <span>Group by</span>
          {(["status", "terms", "billing"] as Group[]).map((g) => (
            <button
              key={g}
              aria-pressed={filters.groups.includes(g)}
              onClick={() => toggleGroup(g)}
            >
              {filters.groups.includes(g) && (
                <span>{filters.groups.indexOf(g) + 1} · </span>
              )}
              {g === "terms"
                ? "Payment terms"
                : g === "billing"
                  ? "Billing model"
                  : "Status"}
            </button>
          ))}
          <small>Select multiple · click in your preferred order</small>
          {activeFilters && (
            <button className="cp-reset" onClick={() => setFilters(defaults)}>
              <X size={13} /> Reset
            </button>
          )}
        </div>
      </section>
      <div className="cp-results">
        <h2>Client workspaces</h2>
        <span>
          {shown.length} of {clients.length} clients · portfolio totals above
        </span>
      </div>
      {shown.length === 0 && (
        <div className="cp-empty">
          <h3>No clients match these filters.</h3>
          <p>Try a broader search or reset your selection.</p>
          <button onClick={() => setFilters(defaults)}>Reset filters</button>
        </div>
      )}
      {grouped.map((group) => (
        <section
          key={JSON.stringify(group.labels)}
          className="cp-group"
          aria-label={group.labels.join(" / ") || "Client results"}
        >
          {group.labels.length > 0 && (
            <h3 className="cp-group-title">
              {group.labels.join(" / ")}
              <span>{group.clients.length} clients</span>
            </h3>
          )}
          {view === "cards" ? (
            <div className="cp-grid">
              {group.clients.map((c) => (
                <article className="cp-card" key={c.id}>
                  <div className="cp-card-top">
                    <div className="cp-avatar">{c.name.slice(0, 1)}</div>
                    <div className="cp-identity">
                      <Link href={`/clients/${c.id}`}>
                        <h3>{c.name}</h3>
                      </Link>
                      <p>{c.contact_name || "Primary contact not set"}</p>
                    </div>
                    <span className={`cp-status cp-status-${c.status}`}>
                      {c.status}
                    </span>
                    {actions(c)}
                  </div>
                  <div className="cp-card-metrics">
                    <div>
                      <strong>{c.active}</strong>
                      <span>Active scopes</span>
                    </div>
                    <div
                      title={
                        c.resources.join(", ") ||
                        "No people assigned to active scopes"
                      }
                    >
                      <strong>{c.resources.length}</strong>
                      <span>People assigned</span>
                    </div>
                    <div>
                      <strong>
                        {fmt(c.hours)}
                        <small> hrs</small>
                      </strong>
                      <span>This month</span>
                    </div>
                  </div>
                  <div className="cp-scope-list">
                    {c.scopes.length ? (
                      c.scopes.slice(0, 2).map((s) => (
                        <Link key={s.id} href={`/projects?project=${s.id}`}>
                          {s.name}
                          <ArrowUpRight size={12} />
                        </Link>
                      ))
                    ) : (
                      <span>No active scopes</span>
                    )}
                    {c.scopes.length > 2 && (
                      <Link href={`/clients/${c.id}`}>
                        +{c.scopes.length - 2} more scopes
                      </Link>
                    )}
                  </div>
                  <div className="cp-card-meta">
                    <span>{terms(c.payment_terms)}</span>
                    <span>{billing(c)}</span>
                  </div>
                  {links(c)}
                  <div className="cp-last">
                    {c.lastActivity
                      ? `Latest time entry · ${new Date(c.lastActivity + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                      : "No time entries recorded in the last 90 days"}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="cp-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Client / primary contact</th>
                    <th>Active scopes</th>
                    <th>People</th>
                    <th>Hours MTD</th>
                    <th>Commercial</th>
                    <th>Access / actions</th>
                  </tr>
                </thead>
                <tbody>
                  {group.clients.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/clients/${c.id}`}>{c.name}</Link>
                        <small>
                          {c.contact_name || "Primary contact not set"} ·{" "}
                          {c.status}
                        </small>
                      </td>
                      <td>{c.active}</td>
                      <td title={c.resources.join(", ")}>
                        {c.resources.length}
                      </td>
                      <td>{fmt(c.hours)}</td>
                      <td>
                        {billing(c)}
                        <small>{terms(c.payment_terms)}</small>
                      </td>
                      <td>
                        <div className="cp-table-access">
                          {links(c)}
                          {actions(c)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
