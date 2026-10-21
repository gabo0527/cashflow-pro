"use client";
import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { BudgetProject, budgetMonths } from "@/lib/resource-report-budget";
import {
  ProgramProjection,
  ReportingRole,
} from "@/lib/resource-report-program";
export interface ProgramReportState {
  projections: ProgramProjection[];
  roles: ReportingRole[];
  ready: boolean;
  projectionDirty: boolean;
  rolesDirty: boolean;
  error: boolean;
}
const keyFor = (a: string, b: string) => JSON.stringify([a, b]);
async function request(path: string, body?: unknown) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Sign in to configure report settings.");
  const response = await fetch(path, {
    method: body ? "POST" : "GET",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "Report settings are unavailable.");
  return data as { projections?: ProgramProjection[]; roles?: ReportingRole[] };
}
export default function ProgramReportControls({
  enabled,
  onToggle,
  showProjection,
  start,
  end,
  projects,
  resources,
  onState,
}: {
  enabled: boolean;
  onToggle: (value: boolean) => void;
  showProjection: boolean;
  start: string;
  end: string;
  projects: BudgetProject[];
  resources: { id: string; label: string; clientIds: string[] }[];
  onState: (state: ProgramReportState) => void;
}) {
  const months = budgetMonths(start, end);
  const [month, setMonth] = useState(end.slice(0, 7) + "-01"),
    [client, setClient] = useState("");
  const [saved, setSaved] = useState<ProgramProjection[]>([]),
    [roles, setRoles] = useState<ReportingRole[]>([]);
  const [drafts, setDrafts] = useState<
    Record<
      string,
      { client_id: string; month: string; amount: string; enabled: boolean }
    >
  >({});
  const [roleDrafts, setRoleDrafts] = useState<Record<string, ReportingRole>>(
    {},
  );
  const [loading, setLoading] = useState(true),
    [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false),
    [message, setMessage] = useState(""),
    [reload, setReload] = useState(0);
  const clients = Array.from(
    new Map(
      projects.filter((p) => p.clientId).map((p) => [p.clientId, p.client]),
    ).entries(),
  );
  const clientKey = clients.map((c) => c[0]).join(",");
  useEffect(() => {
    if (!clients.some((c) => c[0] === client)) setClient(clients[0]?.[0] || "");
  }, [clientKey, client]);
  useEffect(() => {
    if (!months.includes(month)) setMonth(months.at(-1) || "");
  }, [start, end, month]);
  useEffect(() => {
    if (!months.length) {
      setReady(false);
      return;
    }
    let alive = true;
    setLoading(true);
    setReady(false);
    setFailed(false);
    setMessage("");
    request(
      `/api/resource-report-program?start=${months[0]}&end=${months.at(-1)}`,
    )
      .then((data) => {
        if (!alive) return;
        setSaved((previous) => [
          ...previous.filter(
            (p) =>
              !data.projections?.some(
                (n) => n.client_id === p.client_id && n.month === p.month,
              ),
          ),
          ...(data.projections || []),
        ]);
        setRoles(data.roles || []);
        setReady(true);
      })
      .catch((e) => {
        if (alive) {
          setFailed(true);
          setMessage(e.message);
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [start, end, reload]);
  useEffect(() => {
    onState({
      projections: saved,
      roles,
      ready,
      projectionDirty: !!Object.keys(drafts).length,
      rolesDirty: !!Object.keys(roleDrafts).length,
      error: failed,
    });
  }, [saved, roles, ready, drafts, roleDrafts, failed, onState]);
  const draft = drafts[keyFor(client, month)] || {
    client_id: client,
    month,
    amount: String(
      saved.find((p) => p.client_id === client && p.month === month)?.amount ||
        "",
    ),
    enabled:
      saved.find((p) => p.client_id === client && p.month === month)?.enabled ||
      false,
  };
  const editProjection = (
    field: "amount" | "enabled",
    value: string | boolean,
  ) => {
    setDrafts((prev) => ({
      ...prev,
      [keyFor(client, month)]: { ...draft, [field]: value },
    }));
    setMessage("");
  };
  const save = async (kind: "projections" | "roles") => {
    setSaving(true);
    setMessage("");
    try {
      const rows =
        kind === "roles"
          ? Object.values(roleDrafts)
          : Object.values(drafts).map((d) => ({
              ...d,
              amount: Number(d.amount),
            }));
      if (
        kind === "projections" &&
        rows.some(
          (r) =>
            !("amount" in r) || !Number.isFinite(r.amount) || r.amount <= 0,
        )
      )
        throw new Error("Enter a positive monthly projection before saving.");
      const result = await request("/api/resource-report-program", {
        kind,
        rows,
      });
      if (kind === "roles") {
        setRoles((prev) => [
          ...prev.filter(
            (p) =>
              !result.roles?.some(
                (n) =>
                  n.client_id === p.client_id &&
                  n.team_member_id === p.team_member_id,
              ),
          ),
          ...(result.roles || []),
        ]);
        setRoleDrafts({});
      } else {
        setSaved((prev) => [
          ...prev.filter(
            (p) =>
              !result.projections?.some(
                (n) => n.client_id === p.client_id && n.month === p.month,
              ),
          ),
          ...(result.projections || []),
        ]);
        setDrafts({});
      }
      setMessage(
        kind === "roles"
          ? "Roles saved. They will be remembered until you edit them."
          : "Program projections saved. Only hours and percentages appear in the report.",
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="border-t pt-4 space-y-3">
      {showProjection && (
        <label className="flex items-start gap-2 text-sm">
          <input
            aria-label="Include program utilization"
            type="checkbox"
            checked={enabled}
            onChange={(e) => onToggle(e.target.checked)}
            className="mt-1"
          />
          <span>
            Include program utilization
            <span className="block text-xs text-slate-500 mt-1">
              Whole-client usage across all sites and resources, even when work
              details are filtered.
            </span>
          </span>
        </label>
      )}
      <div className="rounded-lg border border-slate-200 p-3 space-y-3">
        <label className="block text-xs font-semibold">
          Client / program
          <select
            aria-label="Program client"
            className="block border rounded-lg w-full p-2 mt-1"
            value={client}
            disabled={saving}
            onChange={(e) => setClient(e.target.value)}
          >
            {clients.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        {loading ? (
          <p className="text-xs">Loading saved report settings…</p>
        ) : failed ? (
          <button
            className="text-xs underline"
            onClick={() => setReload((n) => n + 1)}
          >
            Retry loading report settings
          </button>
        ) : (
          <>
            {showProjection && enabled && (
              <fieldset disabled={saving || !client} className="space-y-3">
                <p className="text-xs text-slate-500">
                  Private monthly reference. The amount and rates are excluded
                  from the PDF. Every site uses this same program projection.
                </p>
                <label className="block text-xs font-semibold">
                  Projection month
                  <select
                    aria-label="Projection month"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    className="block border rounded-lg w-full p-2 mt-1"
                  >
                    {months.map((m) => (
                      <option key={m} value={m}>
                        {new Date(m + "T12:00:00Z").toLocaleDateString(
                          "en-US",
                          { month: "long", year: "numeric", timeZone: "UTC" },
                        )}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex gap-2 text-xs">
                  <input
                    aria-label="Use this program projection"
                    type="checkbox"
                    checked={draft.enabled}
                    onChange={(e) =>
                      editProjection("enabled", e.target.checked)
                    }
                  />
                  Use this projection
                </label>
                <label className="block text-xs text-slate-500">
                  Monthly program projection (USD)
                  <input
                    aria-label="Monthly program projection"
                    type="number"
                    min="0.01"
                    max="999999999999.99"
                    step="0.01"
                    value={draft.amount}
                    onChange={(e) => editProjection("amount", e.target.value)}
                    className="block border rounded-lg w-full p-2 mt-1 text-slate-900"
                  />
                </label>
                <button
                  onClick={() => save("projections")}
                  disabled={!Object.keys(drafts).length}
                  className="rounded-lg bg-slate-800 text-white px-3 py-2 text-xs disabled:opacity-40"
                >
                  Save program projections
                </button>
                {!!Object.keys(drafts).length && (
                  <button
                    className="text-xs underline ml-2"
                    onClick={() => setDrafts({})}
                  >
                    Discard projection changes
                  </button>
                )}
              </fieldset>
            )}
            <details className="border-t pt-3">
              <summary className="text-xs font-semibold cursor-pointer">
                Reporting roles
              </summary>
              <p className="text-xs text-slate-500 mt-2">
                Saved per client and resource across all months. Changing a
                reporting role leaves the team profile unchanged. Blank roles
                appear as “Unassigned role.”
              </p>
              <fieldset
                disabled={saving || !client}
                className="mt-3 space-y-2 max-h-64 overflow-y-auto"
              >
                {resources
                  .filter((r) => r.clientIds.includes(client))
                  .map((r) => (
                    <label className="block text-xs" key={r.id}>
                      {r.label}
                      <input
                        aria-label={`Reporting role for ${r.label}`}
                        value={
                          roleDrafts[keyFor(client, r.id)]?.role ??
                          roles.find(
                            (s) =>
                              s.client_id === client &&
                              s.team_member_id === r.id,
                          )?.role ??
                          ""
                        }
                        maxLength={80}
                        placeholder="e.g. Scheduler"
                        onChange={(e) => {
                          const role = e.target.value;
                          setRoleDrafts((prev) => ({
                            ...prev,
                            [keyFor(client, r.id)]: {
                              client_id: client,
                              team_member_id: r.id,
                              role,
                            },
                          }));
                          setMessage("");
                        }}
                        className="block border rounded-lg w-full p-2 mt-1"
                      />
                    </label>
                  ))}
              </fieldset>
              <button
                disabled={saving || !Object.keys(roleDrafts).length}
                onClick={() => save("roles")}
                className="mt-3 rounded-lg bg-slate-800 text-white px-3 py-2 text-xs disabled:opacity-40"
              >
                Save reporting roles
              </button>
              {!!Object.keys(roleDrafts).length && (
                <button
                  disabled={saving}
                  className="text-xs underline ml-2"
                  onClick={() => setRoleDrafts({})}
                >
                  Discard role changes
                </button>
              )}
            </details>
          </>
        )}
        {saving && <p className="text-xs">Saving…</p>}
        {(!!Object.keys(drafts).length || !!Object.keys(roleDrafts).length) && (
          <p className="text-xs text-amber-700">
            Save or discard your changes before exporting the affected report.
          </p>
        )}
        {message && (
          <p role="status" className="text-xs text-slate-600">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
