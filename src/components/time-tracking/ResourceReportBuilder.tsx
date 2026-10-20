"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Download, RefreshCw, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import ReportBudgetControls, {
  ReportBudgetState,
} from "./ReportBudgetControls";
import BudgetUtilizationPreview from "./BudgetUtilizationPreview";
import {
  budgetUtilization,
  BudgetUsageEntry,
  BudgetProject,
} from "@/lib/resource-report-budget";
import {
  hoursLabel,
  mondayOf,
  reportDate,
  reportRows,
  reportMonthTotals,
  ResourceSubmission,
  shiftDate,
} from "@/lib/resource-report";

type Choice = { id: string; label: string };
function Picker({
  label,
  choices,
  selected,
  onChange,
}: {
  label: string;
  choices: Choice[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  return (
    <details className="relative rounded-xl border border-slate-200 bg-white">
      <summary className="cursor-pointer px-3 py-2 text-sm font-semibold">
        {label}{" "}
        <span className="text-slate-500 font-normal">
          ({selected.length === choices.length ? "All" : selected.length})
        </span>
      </summary>
      <div className="absolute z-30 left-0 right-0 min-w-[240px] bg-white rounded-xl border border-slate-200 shadow-xl p-3">
        <input
          aria-label={`Search ${label}`}
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full p-2 mb-2 border rounded-lg text-sm"
        />
        <div className="flex gap-4 text-xs mb-2">
          <button
            onClick={() => onChange(choices.map((c) => c.id))}
            className="text-blue-700"
          >
            Select all
          </button>
          <button onClick={() => onChange([])}>Clear</button>
        </div>
        <div className="max-h-56 overflow-y-auto">
          {choices
            .filter((c) => c.label.toLowerCase().includes(search.toLowerCase()))
            .map((c) => (
              <label key={c.id} className="flex gap-2 items-center p-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.includes(c.id)}
                  onChange={(e) =>
                    onChange(
                      e.target.checked
                        ? [...selected, c.id]
                        : selected.filter((id) => id !== c.id),
                    )
                  }
                />
                {c.label}
              </label>
            ))}
        </div>
      </div>
    </details>
  );
}
const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "America/Puerto_Rico" });
export default function ResourceReportBuilder({
  entries,
  projects,
  resources,
  initialProjects,
  initialResources,
  logo,
  onClose,
  budgetEntries = [],
  budgetProjects = [],
}: {
  entries: ResourceSubmission[];
  budgetEntries?: BudgetUsageEntry[];
  budgetProjects?: BudgetProject[];
  projects: Choice[];
  resources: Choice[];
  initialProjects: string[];
  initialResources: string[];
  logo: string;
  onClose: () => void;
}) {
  const [selectedProjects, setProjects] = useState(initialProjects),
    [selectedResources, setResources] = useState(initialResources);
  const [mode, setMode] = useState<"week" | "range" | "month">("week");
  const [week, setWeek] = useState(shiftDate(mondayOf(today()), -7));
  const [month, setMonth] = useState(today().slice(0, 7));
  const [from, setFrom] = useState(shiftDate(mondayOf(today()), -7)),
    [to, setTo] = useState(shiftDate(mondayOf(today()), -1));
  const [includeMtd, setIncludeMtd] = useState(true);
  const [includeBudget, setIncludeBudget] = useState(false);
  const [showProjectBudget, setShowProjectBudget] = useState(true),
    [showClientBudget, setShowClientBudget] = useState(true);
  const [budgetState, setBudgetState] = useState<ReportBudgetState>({
    budgets: [],
    ready: false,
    dirty: false,
    error: false,
  });
  const [title, setTitle] = useState("Weekly Resource Report");
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false),
    [downloading, setDownloading] = useState(false),
    [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const start =
    mode === "week"
      ? week && mondayOf(week)
      : mode === "month"
        ? month && `${month}-01`
        : from;
  const end =
    mode === "week"
      ? start && shiftDate(start, 6)
      : mode === "month"
        ? month &&
          new Date(
            Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0),
          )
            .toISOString()
            .slice(0, 10)
        : to;
  const validRange = Boolean(
    start &&
    end &&
    start <= end &&
    (Date.parse(end) - Date.parse(start)) / 86400000 <= 366,
  );
  const rows = useMemo(
    () =>
      validRange
        ? reportRows(
            entries,
            start,
            end,
            selectedProjects,
            selectedResources,
          ).map((row) => ({
            ...row,
            key: JSON.stringify([row.key, start, end]),
          }))
        : [],
    [entries, start, end, selectedProjects, selectedResources, validRange],
  );
  const mtd = useMemo(
    () =>
      validRange && includeMtd
        ? reportMonthTotals(
            entries,
            start,
            end,
            selectedProjects,
            selectedResources,
            today(),
          )
        : [],
    [
      entries,
      start,
      end,
      selectedProjects,
      selectedResources,
      validRange,
      includeMtd,
    ],
  );
  const utilization = useMemo(
    () =>
      includeBudget && budgetState.ready && !budgetState.dirty
        ? budgetUtilization(
            budgetEntries,
            budgetProjects,
            budgetState.budgets,
            selectedProjects,
            start,
            end,
            today(),
          ).filter((row) =>
            row.level === "project" ? showProjectBudget : showClientBudget,
          )
        : [],
    [
      includeBudget,
      budgetState,
      budgetEntries,
      budgetProjects,
      selectedProjects,
      start,
      end,
      showProjectBudget,
      showClientBudget,
    ],
  );
  const budgetBlocked =
    includeBudget &&
    (!budgetState.ready ||
      budgetState.dirty ||
      budgetState.error ||
      !utilization.length ||
      utilization.some(
        (row) => row.weekPercent === null || row.mtdPercent === null,
      ));
  const missing = rows.filter(
    (row) => row.notes.length && !summaries[row.key]?.trim(),
  );
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  const generate = async () => {
    setBusy(true);
    setError("");
    const attempt = ++generation.current;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Sign in to generate summaries.");
      // Only draft missing descriptions. Reviewed edits are never overwritten.
      for (let index = 0; index < missing.length; index += 6) {
        const response = await fetch("/api/resource-report-summaries", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            lines: missing
              .slice(index, index + 6)
              .map((row) => ({ key: row.key, notes: row.notes })),
          }),
        });
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error || "Unable to draft summaries.");
        if (generation.current !== attempt) return;
        setSummaries((previous) => ({
          ...previous,
          ...Object.fromEntries(
            Object.entries(
              (result.summaries || {}) as Record<string, string>,
            ).filter(([key]) => !previous[key]?.trim()),
          ),
        }));
        if (
          missing
            .slice(index, index + 6)
            .some((row) => !result.summaries?.[row.key]?.trim())
        )
          throw new Error(
            "Some descriptions could not be summarized. Retry or enter the missing summaries.",
          );
      }
    } catch (e) {
      if (generation.current === attempt) setError((e as Error).message);
    } finally {
      if (generation.current === attempt) setBusy(false);
    }
  };
  const download = async () => {
    if (budgetBlocked) return;
    setDownloading(true);
    setError("");
    try {
      const image = new Image();
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(logo.replace("<svg ", '<svg width="664" ').replace('height="24"', 'height="131"'))}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = 664;
      canvas.height = 131;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Unable to render the Mano logo.");
      context.drawImage(image, 0, 0, 664, 131);
      const png = new Uint8Array(
        await (await fetch(canvas.toDataURL("image/png"))).arrayBuffer(),
      );
      const { createResourceReportPDF } =
        await import("@/lib/resource-report-pdf");
      const bytes = await createResourceReportPDF(
        rows,
        summaries,
        start,
        end,
        title.trim() || "Weekly Resource Report",
        png,
        mtd,
        utilization,
      );
      const url = URL.createObjectURL(
        new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `Mano-resource-report-${start}-to-${end}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDownloading(false);
    }
  };
  return (
    <dialog
      ref={dialog}
      aria-labelledby="resource-report-heading"
      onCancel={onClose}
      className="fixed inset-0 m-0 h-[100dvh] max-h-none w-screen max-w-none bg-slate-100 p-0 text-slate-900 backdrop:bg-slate-950/60"
    >
      <div className="flex h-full flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 bg-[#24333b] px-6 py-4 text-white">
          <div>
            <p className="text-xs uppercase tracking-widest text-orange-200">
              Time Tracking / Reports
            </p>
            <h1 id="resource-report-heading" className="text-xl font-bold">
              Resource report
            </h1>
            <p className="text-xs text-slate-300 mt-1">
              Weekly submitted hours and work summaries for your leads
            </p>
          </div>
          <div className="flex gap-3 items-center">
            <button
              onClick={download}
              disabled={
                !rows.length ||
                missing.length > 0 ||
                busy ||
                downloading ||
                budgetBlocked
              }
              className="flex gap-2 items-center rounded-lg bg-white text-slate-900 px-4 py-2 font-semibold disabled:opacity-40"
            >
              <Download size={16} />
              {downloading ? "Preparing PDF…" : "Download PDF"}
            </button>
            <button
              aria-label="Close resource report"
              onClick={onClose}
              className="p-2"
            >
              <X size={22} />
            </button>
          </div>
        </header>
        <div className="flex-1 min-h-0 overflow-auto lg:grid lg:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="bg-white p-5 border-r border-slate-200 lg:overflow-y-auto">
            <fieldset
              disabled={busy || downloading}
              className="space-y-5 disabled:opacity-60"
            >
              <label className="block text-sm font-semibold">
                Report title
                <input
                  value={title}
                  maxLength={120}
                  onChange={(e) => setTitle(e.target.value)}
                  className="block w-full border rounded-lg px-3 py-2 mt-2 font-normal"
                />
              </label>
              <div>
                <p className="text-sm font-semibold mb-2">Period</p>
                <div className="flex rounded-lg bg-slate-100 p-1 gap-1">
                  {(
                    [
                      ["week", "One week"],
                      ["range", "Date range"],
                      ["month", "Full month"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      aria-pressed={mode === value}
                      onClick={() => setMode(value)}
                      className={`flex-1 rounded-md py-2 text-xs ${mode === value ? "bg-white shadow font-semibold" : ""}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {mode === "week" && (
                  <label className="block text-xs mt-3">
                    Choose any day in the week
                    <input
                      aria-label="Report week"
                      type="date"
                      value={week}
                      onChange={(e) => setWeek(e.target.value)}
                      className="block w-full border rounded-lg px-3 py-2 mt-1"
                    />
                  </label>
                )}
                {mode === "month" && (
                  <input
                    aria-label="Report month"
                    type="month"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 mt-3"
                  />
                )}
                {mode === "range" && (
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <label className="text-xs">
                      From
                      <input
                        type="date"
                        value={from}
                        onChange={(e) => setFrom(e.target.value)}
                        className="w-full border rounded-lg p-2 mt-1"
                      />
                    </label>
                    <label className="text-xs">
                      Through
                      <input
                        type="date"
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                        className="w-full border rounded-lg p-2 mt-1"
                      />
                    </label>
                  </div>
                )}
                <p className="text-xs text-slate-500 mt-2">
                  Monday–Sunday weeks. Date ranges and months retain weekly
                  sections; boundary weeks include only dates in your period.
                </p>
              </div>
              <div className="space-y-2">
                <Picker
                  label="Projects"
                  choices={projects}
                  selected={selectedProjects}
                  onChange={setProjects}
                />
                <Picker
                  label="Resources"
                  choices={resources}
                  selected={selectedResources}
                  onChange={setResources}
                />
                <p className="text-xs text-slate-500">
                  Both filters apply together. Keep all resources selected to
                  include everyone on your chosen projects. Keep all projects
                  selected to report on a resource across their projects.
                </p>
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  aria-label="Include month-to-date hours"
                  checked={includeMtd}
                  onChange={(e) => setIncludeMtd(e.target.checked)}
                  className="mt-1"
                />
                <span>
                  Include month-to-date hours
                  <span className="block text-xs text-slate-500 mt-1">
                    From the first of each month through the report cutoff,
                    capped at today. Uses your selected projects and resources.
                  </span>
                </span>
              </label>
              <ReportBudgetControls
                enabled={includeBudget}
                onToggle={setIncludeBudget}
                start={start}
                end={end}
                projects={budgetProjects.filter((p) =>
                  selectedProjects.includes(p.id),
                )}
                onState={setBudgetState}
              />
              {includeBudget && (
                <div className="space-y-2 text-xs">
                  <label className="flex gap-2">
                    <input
                      aria-label="Show project utilization"
                      type="checkbox"
                      checked={showProjectBudget}
                      onChange={(e) => setShowProjectBudget(e.target.checked)}
                    />
                    Project utilization
                  </label>
                  <label className="flex gap-2">
                    <input
                      aria-label="Show client utilization"
                      type="checkbox"
                      checked={showClientBudget}
                      onChange={(e) => setShowClientBudget(e.target.checked)}
                    />
                    Client summary
                  </label>
                  {budgetBlocked && (
                    <p className="text-amber-700">
                      Save an included monthly budget for the selected projects
                      to share utilization. Missing bill rates must be completed
                      in project setup. You can also turn budget utilization
                      off.
                    </p>
                  )}
                </div>
              )}
              <div className="border-t pt-4">
                <button
                  onClick={generate}
                  disabled={!missing.length || busy}
                  className="flex gap-2 items-center justify-center w-full bg-[#24333b] text-white rounded-lg px-3 py-2.5 text-sm disabled:opacity-40"
                >
                  <RefreshCw size={15} className={busy ? "animate-spin" : ""} />
                  {busy ? "Drafting summaries…" : "Draft work summaries"}
                </button>
                <p className="text-xs text-slate-500 mt-2">
                  Daily submissions become a concise weekly paragraph per
                  resource and project. Review and edit before downloading.
                  Existing edits are preserved.
                </p>
                {missing.length > 0 && (
                  <p className="text-xs text-amber-700 mt-2">
                    {missing.length} row(s) need a summary. Draft them or write
                    your own in the preview.
                  </p>
                )}
              </div>
            </fieldset>
            <p className="text-xs text-slate-500 mt-5 border-t pt-4">
              PDF contents: resource, project, weekly submitted hours, and
              reviewed summary. Financial columns are excluded.
            </p>
            {error && (
              <p
                role="alert"
                className="mt-3 rounded-lg bg-red-50 text-red-800 p-3 text-sm"
              >
                {error}
              </p>
            )}
          </aside>
          <main
            className="p-4 md:p-8 lg:overflow-y-auto"
            aria-label="Report preview"
          >
            <article className="mx-auto max-w-[900px] bg-white border border-slate-200 rounded-xl p-5 md:p-9 shadow-sm">
              <div className="flex justify-between items-start gap-4 border-b-2 border-[#24333b] pb-5">
                <div dangerouslySetInnerHTML={{ __html: logo }} />
                <span className="text-xs text-slate-500 uppercase tracking-widest">
                  Resource report
                </span>
              </div>
              <h2 className="text-2xl font-bold mt-6 break-words">
                {title || "Weekly Resource Report"}
              </h2>
              <p className="text-sm text-slate-500 mt-2">
                {validRange
                  ? `${reportDate(start)} – ${reportDate(end)}`
                  : "Choose a valid period of up to one year."}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Actual submitted hours · Monday–Sunday weeks
              </p>
              {rows.length > 0 && (
                <div className="mt-5 rounded-xl bg-slate-50 border border-slate-200 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    Selected reporting period
                  </p>
                  <p className="text-2xl font-bold text-[#24333b] mt-1">
                    {hoursLabel(rows.reduce((sum, row) => sum + row.hours, 0))}{" "}
                    hrs
                  </p>
                </div>
              )}
              {mtd.length > 0 && (
                <section aria-label="Month-to-date hours" className="mt-5">
                  <h3 className="font-semibold text-sm">Month-to-date hours</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Includes earlier submissions in each month for the same
                    selected projects and resources. These hours provide context
                    and are not added to the reporting-period total.
                  </p>
                  {mtd.map((month) => (
                    <div
                      key={month.start}
                      className="mt-3 rounded-xl border border-slate-200 overflow-hidden"
                    >
                      <div className="flex justify-between gap-3 bg-slate-50 px-3 py-3 text-sm">
                        <span>
                          {reportDate(month.start)} – {reportDate(month.end)}
                        </span>
                        <strong className="shrink-0 text-[#c2660c]">
                          {hoursLabel(month.hours)} hrs MTD
                        </strong>
                      </div>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-slate-500">
                            <th className="px-3 py-2 font-medium">
                              Resource / project
                            </th>
                            <th className="px-3 py-2 text-right font-medium">
                              MTD hours
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {month.resources.map((resource) => (
                            <tr
                              key={resource.key}
                              className="border-t border-slate-100"
                            >
                              <td className="px-3 py-2">
                                {resource.resource}
                                <span className="block text-slate-500">
                                  {resource.client
                                    ? `${resource.client} / `
                                    : ""}
                                  {resource.project}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {hoursLabel(resource.hours)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </section>
              )}
              {!rows.length && (
                <p className="my-12 text-center text-slate-500">
                  No submitted hours match this period and selection.
                </p>
              )}
              <BudgetUtilizationPreview rows={utilization} />
              {rows.map((row, index) => {
                const previous = rows[index - 1],
                  section =
                    !previous ||
                    previous.week !== row.week ||
                    previous.project !== row.project ||
                    previous.client !== row.client;
                return (
                  <React.Fragment key={row.key}>
                    {section && (
                      <div className="mt-7 mb-2 border-b pb-2">
                        <p className="text-[11px] uppercase tracking-wide font-semibold text-[#c2660c]">
                          Week of {reportDate(row.week)} –{" "}
                          {reportDate(shiftDate(row.week, 6))}
                        </p>
                        <h3 className="font-semibold text-sm mt-1">
                          {row.client ? `${row.client} / ` : ""}
                          {row.project}
                        </h3>
                      </div>
                    )}
                    <section className="py-4 border-b border-slate-100">
                      <div className="flex justify-between gap-4">
                        <h4 className="font-semibold text-sm">
                          {row.resource}
                        </h4>
                        <span className="shrink-0 tabular-nums font-semibold text-sm">
                          {hoursLabel(row.hours)} hrs
                        </span>
                      </div>
                      <textarea
                        aria-label={`Summary for ${row.resource}, ${row.project}, week of ${row.week}`}
                        value={summaries[row.key] || ""}
                        maxLength={1500}
                        disabled={busy || downloading}
                        onChange={(e) => {
                          const value = e.target.value;
                          setSummaries((prev) => ({
                            ...prev,
                            [row.key]: value,
                          }));
                        }}
                        placeholder={
                          row.notes.length
                            ? "Draft a summary or write one here…"
                            : "No description submitted."
                        }
                        rows={3}
                        className="w-full text-sm leading-relaxed text-slate-600 mt-2 p-2 -ml-2 rounded-md border border-transparent hover:border-slate-200 focus:border-blue-400 focus:outline-none resize-y"
                      />
                      {row.missingDescriptions > 0 && (
                        <p className="text-xs text-amber-700">
                          {row.missingDescriptions} submission(s) without a
                          description.
                        </p>
                      )}
                      {row.notes.length > 0 && (
                        <details className="mt-2 text-xs text-slate-400">
                          <summary className="cursor-pointer">
                            Review source descriptions · excluded from PDF
                          </summary>
                          <div className="space-y-2 mt-2">
                            {row.notes.map((note, i) => (
                              <p
                                key={i}
                                className="whitespace-pre-wrap break-words"
                              >
                                <b>{reportDate(note.date)}</b> · {note.note}
                              </p>
                            ))}
                          </div>
                        </details>
                      )}
                    </section>
                  </React.Fragment>
                );
              })}
              {rows.length > 0 && (
                <div className="flex justify-between border-t-2 border-[#24333b] mt-6 pt-4 font-bold">
                  <span>Total submitted hours</span>
                  <span className="text-[#c2660c]">
                    {hoursLabel(rows.reduce((sum, row) => sum + row.hours, 0))}{" "}
                    hrs
                  </span>
                </div>
              )}
              <footer className="border-t mt-8 pt-4 text-xs text-slate-400 flex justify-between gap-3">
                <span>Mano CG LLC</span>
                <span>Generated by VantageFP</span>
              </footer>
            </article>
          </main>
        </div>
      </div>
    </dialog>
  );
}
