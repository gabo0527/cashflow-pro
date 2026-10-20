import React from "react";
import { BudgetUtilization, percentLabel } from "@/lib/resource-report-budget";
import { hoursLabel, reportDate } from "@/lib/resource-report";
export default function BudgetUtilizationPreview({
  rows,
}: {
  rows: BudgetUtilization[];
}) {
  if (!rows.length) return null;
  const groups = new Map<string, BudgetUtilization[]>();
  rows.forEach((row) => {
    const key = JSON.stringify([
      row.client,
      row.month,
      row.weekStart,
      row.weekEnd,
      row.mtdEnd,
    ]);
    groups.set(key, [...(groups.get(key) || []), row]);
  });
  return (
    <section aria-label="Budget utilization" className="mt-7">
      <div className="border-l-4 border-[#c2660c] pl-3">
        <h3 className="text-base font-bold text-[#24333b]">
          Monthly budget utilization
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Full project usage across all resources. Both percentages use the
          monthly allocation; client totals cover configured selected projects.
        </p>
      </div>
      {Array.from(groups.values()).map((group) => {
        const first = group[0],
          sorted = [
            ...group.filter((row) => row.level === "project"),
            ...group.filter((row) => row.level === "client"),
          ];
        return (
          <div
            key={first.key}
            className="mt-4 border border-slate-200 rounded-xl overflow-hidden"
          >
            <div className="bg-slate-50 px-4 py-3">
              <p className="font-bold text-sm">
                {first.client || "Selected projects"}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Week: {reportDate(first.weekStart)} –{" "}
                {reportDate(first.weekEnd)} · MTD: {reportDate(first.month)} –{" "}
                {reportDate(first.mtdEnd)}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-xs">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wide text-slate-500 border-y border-slate-200">
                    <th className="py-3 px-4">Scope</th>
                    <th className="py-3 px-2 text-right">Week hrs</th>
                    <th className="py-3 px-2 text-right">Week used</th>
                    <th className="py-3 px-2 text-right">MTD hrs</th>
                    <th className="py-3 px-4 text-right">MTD used</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((row) => (
                    <tr
                      key={row.key}
                      className={`border-b border-slate-100 last:border-0 ${row.level === "client" ? "bg-[#24333b] text-white" : "bg-white"}`}
                    >
                      <td className="py-3 px-4 font-semibold">
                        {row.name}
                        {row.level === "client" && (
                          <span className="block text-[10px] font-normal text-slate-300 mt-1">
                            Client total · {row.projectCount} configured
                            project(s)
                          </span>
                        )}
                      </td>
                      <td className="px-2 text-right tabular-nums">
                        {hoursLabel(row.weekHours)}
                      </td>
                      <td className="px-2 text-right tabular-nums font-semibold">
                        {percentLabel(row.weekPercent)}
                      </td>
                      <td className="px-2 text-right tabular-nums">
                        {hoursLabel(row.mtdHours)}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums font-semibold">
                        {percentLabel(row.mtdPercent)}
                        {row.mtdPercent !== null && (
                          <span
                            aria-hidden="true"
                            className="block h-1 w-14 bg-slate-200 rounded-full mt-1.5 ml-auto overflow-hidden"
                          >
                            <span
                              className="block h-full bg-[#c2660c]"
                              style={{
                                width: `${Math.min(100, Math.max(0, row.mtdPercent))}%`,
                              }}
                            />
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </section>
  );
}
