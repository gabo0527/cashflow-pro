"use client";
import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  BudgetProject,
  budgetMonths,
  ProjectReportBudget,
} from "@/lib/resource-report-budget";
export interface ReportBudgetState {
  budgets: ProjectReportBudget[];
  ready: boolean;
  dirty: boolean;
  error: boolean;
}
async function request(path: string, body?: unknown) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Sign in to configure report budgets.");
  const response = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "Budget settings are unavailable.");
  return data.budgets as ProjectReportBudget[];
}
export default function ReportBudgetControls({
  enabled,
  onToggle,
  start,
  end,
  projects,
  onState,
}: {
  enabled: boolean;
  onToggle: (value: boolean) => void;
  start: string;
  end: string;
  projects: BudgetProject[];
  onState: (state: ReportBudgetState) => void;
}) {
  const months = budgetMonths(start, end);
  const [month, setMonth] = useState(end.slice(0, 7) + "-01"),
    [saved, setSaved] = useState<ProjectReportBudget[]>([]),
    [drafts, setDrafts] = useState<
      Record<string, { amount: string; enabled: boolean }>
    >({});
  const [loading, setLoading] = useState(false),
    [saving, setSaving] = useState(false),
    [dirty, setDirty] = useState(false),
    [message, setMessage] = useState(""),
    [reload, setReload] = useState(0);
  useEffect(() => {
    if (!months.includes(month)) setMonth(months[months.length - 1] || "");
  }, [start, end, month]);
  useEffect(() => {
    if (!enabled || !months.length) return;
    let alive = true;
    setLoading(true);
    setMessage("");
    onState({ budgets: [], ready: false, dirty: false, error: false });
    request(
      `/api/resource-report-budgets?start=${months[0]}&end=${months[months.length - 1]}`,
    )
      .then((budgets) => {
        if (!alive) return;
        const next: typeof drafts = {};
        budgets.forEach((b) => {
          next[JSON.stringify([b.month, b.project_id])] = {
            amount: String(b.amount),
            enabled: b.enabled !== false,
          };
        });
        setSaved(budgets);
        setDrafts(next);
        setDirty(false);
        onState({ budgets, ready: true, dirty: false, error: false });
      })
      .catch((e) => {
        if (alive) {
          setMessage(e.message);
          onState({ budgets: [], ready: false, dirty: false, error: true });
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [enabled, start, end, reload, onState]);
  const edit = (
    id: string,
    field: "amount" | "enabled",
    value: string | boolean,
  ) => {
    const key = JSON.stringify([month, id]);
    setDrafts((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || { amount: "", enabled: false }),
        [field]: value,
      },
    }));
    setDirty(true);
    setMessage("");
    onState({ budgets: saved, ready: true, dirty: true, error: false });
  };
  const save = async () => {
    setMessage("");
    setSaving(true);
    try {
      const changes: {
        project_id: string;
        amount: number;
        enabled: boolean;
      }[] = [];
      for (const project of projects) {
        const draft = drafts[JSON.stringify([month, project.id])];
        if (!draft) continue;
        const amount = Number(draft.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
          if (
            draft.enabled ||
            saved.some((b) => b.project_id === project.id && b.month === month)
          )
            throw new Error(
              `Enter a positive monthly budget for ${project.name}. Uncheck Include to omit it from utilization.`,
            );
          continue;
        }
        changes.push({
          project_id: project.id,
          amount,
          enabled: draft.enabled,
        });
      }
      if (!changes.length)
        throw new Error(
          "Enter a monthly budget and select Include for at least one project.",
        );
      const updated = await request("/api/resource-report-budgets", {
        month,
        budgets: changes,
      });
      const next = [
        ...saved.filter(
          (b) =>
            !updated.some(
              (u) => u.month === b.month && u.project_id === b.project_id,
            ),
        ),
        ...updated,
      ];
      setSaved(next);
      // Other reporting months may still have unsaved edits; do not silently discard them.
      const stillDirty = Object.entries(drafts).some(([key, draft]) => {
        const [draftMonth, projectId] = JSON.parse(key);
        const original = next.find(
          (b) => b.month === draftMonth && b.project_id === projectId,
        );
        return (
          draft.enabled !== (original ? original.enabled !== false : false) ||
          (draft.amount.trim() === ""
            ? Boolean(original)
            : Number(draft.amount) !== Number(original?.amount || 0))
        );
      });
      setDirty(stillDirty);
      setMessage(
        stillDirty
          ? "Saved this selection. Some other changes are still unsaved."
          : "Monthly budgets saved. Only hours and percentages appear in the report.",
      );
      onState({ budgets: next, ready: true, dirty: stillDirty, error: false });
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="border-t pt-4 space-y-3">
      <label className="flex items-start gap-2 text-sm">
        <input
          aria-label="Include budget utilization"
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
          className="mt-1"
        />
        <span>
          Include budget utilization
          <span className="block text-xs text-slate-500 mt-1">
            Full projects and clients, across all their resources. Turn off for
            a resource-only report.
          </span>
        </span>
      </label>
      {enabled && (
        <div className="rounded-lg border border-slate-200 p-3 space-y-3">
          <p className="text-xs text-slate-500">
            Private admin setup. Budgets are saved by project and month. These
            amounts never appear in the report or PDF. Utilization values
            submitted billable hours at your existing internal bill rates.
          </p>
          <label className="block text-xs font-semibold">
            Budget month
            <select
              aria-label="Budget month"
              value={month}
              disabled={loading || saving}
              onChange={(e) => setMonth(e.target.value)}
              className="block border rounded-lg w-full p-2 mt-1"
            >
              {months.map((m) => (
                <option key={m} value={m}>
                  {new Date(m + "T12:00:00Z").toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                    timeZone: "UTC",
                  })}
                </option>
              ))}
            </select>
          </label>
          {loading ? (
            <p className="text-xs">Loading saved budgets…</p>
          ) : (
            <fieldset
              disabled={saving}
              className="space-y-3 max-h-64 overflow-y-auto"
            >
              {projects.map((project) => {
                const draft = drafts[JSON.stringify([month, project.id])] || {
                  amount: "",
                  enabled: false,
                };
                return (
                  <div key={project.id} className="border-t pt-2">
                    <p className="text-xs font-semibold">
                      {project.client ? project.client + " / " : ""}
                      {project.name}
                    </p>
                    <label className="flex gap-2 text-xs items-center mt-1">
                      <input
                        type="checkbox"
                        aria-label={`Include budget for ${project.name}`}
                        checked={draft.enabled}
                        onChange={(e) =>
                          edit(project.id, "enabled", e.target.checked)
                        }
                      />
                      Include
                    </label>
                    <label className="block text-xs text-slate-500 mt-2">
                      Monthly budget (USD)
                      <input
                        aria-label={`Monthly budget for ${project.name}`}
                        type="number"
                        min="0.01"
                        max="999999999999.99"
                        step="0.01"
                        value={draft.amount}
                        onChange={(e) =>
                          edit(project.id, "amount", e.target.value)
                        }
                        placeholder="Enter monthly allocation"
                        className="block border rounded-lg w-full p-2 mt-1 text-slate-900"
                      />
                    </label>
                  </div>
                );
              })}
            </fieldset>
          )}
          <button
            onClick={save}
            disabled={loading || saving || !dirty}
            className="rounded-lg bg-slate-800 text-white px-3 py-2 text-xs disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save monthly budgets"}
          </button>
          {dirty && (
            <button
              className="ml-2 text-xs underline"
              disabled={saving}
              onClick={() => {
                const next: typeof drafts = {};
                saved.forEach((b) => {
                  next[JSON.stringify([b.month, b.project_id])] = {
                    amount: String(b.amount),
                    enabled: b.enabled !== false,
                  };
                });
                setDrafts(next);
                setDirty(false);
                setMessage("");
                onState({
                  budgets: saved,
                  ready: true,
                  dirty: false,
                  error: false,
                });
              }}
            >
              Discard unsaved changes
            </button>
          )}
          {dirty && (
            <p className="text-xs text-amber-700">
              Save changes before downloading budget utilization.
            </p>
          )}
          {message && (
            <p role="status" className="text-xs text-slate-600">
              {message}
            </p>
          )}
          {!loading && message && !saved.length && !dirty && (
            <button
              className="text-xs underline"
              onClick={() => setReload((value) => value + 1)}
            >
              Retry loading budgets
            </button>
          )}
        </div>
      )}
    </div>
  );
}
