import React from "react";
import { BudgetUtilization, percentLabel } from "@/lib/resource-report-budget";
import { hoursLabel, reportDate } from "@/lib/resource-report";
export default function BudgetUtilizationPreview({
  rows,
}: {
  rows: BudgetUtilization[];
}) {
  if (!rows.length) return null;
  return (
    <section aria-label="Budget utilization" className="mt-6">
      <h3 className="text-sm font-semibold">Monthly budget utilization</h3>
      <p className="text-xs text-slate-500 mt-1">
        Submitted billable hours across all resources on the configured
        projects. Weekly and MTD percentages use the same monthly allocation.
        Client totals combine only the configured projects selected for this
        report.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-slate-500 border-b">
              <th className="py-2 pr-3">Project / client</th>
              <th className="py-2 px-2 text-right">Week hours</th>
              <th className="py-2 px-2 text-right">Week used</th>
              <th className="py-2 px-2 text-right">MTD hours</th>
              <th className="py-2 pl-2 text-right">MTD used</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.key}
                className={`border-b border-slate-100 ${row.level === "client" ? "bg-slate-50 font-semibold" : ""}`}
              >
                <td className="py-3 pr-3">
                  <span>
                    {row.level === "client" ? "Client: " : ""}
                    {row.name}
                  </span>
                  <span className="block text-slate-500 font-normal mt-1">
                    {row.level === "project" && row.client
                      ? row.client + " · "
                      : ""}
                    {reportDate(row.weekStart)} – {reportDate(row.weekEnd)}
                    <br />
                    MTD: {reportDate(row.month)} – {reportDate(row.mtdEnd)}
                    {row.level === "client"
                      ? ` · ${row.projectCount} configured project(s)`
                      : ""}
                  </span>
                </td>
                <td className="px-2 text-right tabular-nums">
                  {hoursLabel(row.weekHours)}
                </td>
                <td className="px-2 text-right tabular-nums">
                  {percentLabel(row.weekPercent)}
                </td>
                <td className="px-2 text-right tabular-nums">
                  {hoursLabel(row.mtdHours)}
                </td>
                <td className="pl-2 text-right tabular-nums">
                  {percentLabel(row.mtdPercent)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
