import { BudgetUtilization, percentLabel } from "./resource-report-budget";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  hoursLabel,
  reportDate,
  ResourceReportRow,
  ReportMonthTotal,
  shiftDate,
} from "./resource-report";
// This public document receives only report fields, never full time entries.
export async function createResourceReportPDF(
  rows: ResourceReportRow[],
  summaries: Record<string, string>,
  start: string,
  end: string,
  title: string,
  logo?: Uint8Array,
  mtd: ReportMonthTotal[] = [],
  utilization: BudgetUtilization[] = [],
) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  pdf.setAuthor("Mano CG LLC");
  pdf.setCreator("VantageFP");
  const regular = await pdf.embedFont(StandardFonts.Helvetica),
    bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mark = logo ? await pdf.embedPng(logo) : null;
  const ink = rgb(0.14, 0.2, 0.23),
    muted = rgb(0.38, 0.44, 0.49),
    accent = rgb(0.77, 0.4, 0.05);
  const safe = (value: string) =>
    Array.from(value.replace(/[\r\n\t]+/g, " "))
      .map((char) => {
        try {
          regular.encodeText(char);
          return char;
        } catch {
          return "?";
        }
      })
      .join("");
  const wrap = (value: string, width: number, size: number, strong = false) => {
    const font = strong ? bold : regular;
    const words = safe(value).split(/\s+/),
      result: string[] = [];
    let line = "";
    for (const word of words) {
      if (
        font.widthOfTextAtSize(line ? `${line} ${word}` : word, size) <= width
      ) {
        line = line ? `${line} ${word}` : word;
        continue;
      }
      if (line) result.push(line);
      line = "";
      for (const char of word) {
        if (font.widthOfTextAtSize(line + char, size) > width && line) {
          result.push(line);
          line = "";
        }
        line += char;
      }
    }
    if (line) result.push(line);
    return result;
  };
  let page = pdf.addPage([595.28, 841.89]),
    y = 0;
  const text = (
    value: string,
    x: number,
    top: number,
    size = 10,
    strong = false,
    color = ink,
  ) =>
    page.drawText(safe(value), {
      x,
      y: top,
      size,
      font: strong ? bold : regular,
      color,
    });
  const header = () => {
    if (mark) page.drawImage(mark, { x: 42, y: 773, width: 120, height: 24 });
    else text("Mano CG LLC", 42, 780, 18, true);
    text("RESOURCE REPORT", 385, 789, 10, true, muted);
    text("Submitted hours and work summary", 350, 774, 9, false, muted);
    page.drawLine({
      start: { x: 42, y: 755 },
      end: { x: 553, y: 755 },
      thickness: 2,
      color: ink,
    });
    let top = 730;
    for (const line of wrap(title, 510, 18, true)) {
      text(line, 42, top, 18, true);
      top -= 23;
    }
    text(
      `${reportDate(start)} - ${reportDate(end)}`,
      42,
      top - 1,
      10,
      false,
      muted,
    );
    text(
      "Actual submitted hours | Weeks run Monday to Sunday",
      42,
      top - 17,
      9,
      false,
      muted,
    );
    y = top - 44;
  };
  let section = "";
  const nextPage = () => {
    page = pdf.addPage([595.28, 841.89]);
    header();
    section = "";
  };
  const ensure = (height: number) => {
    if (y - height < 65) nextPage();
  };
  header();
  if (mtd.length) {
    text(
      `REPORTING PERIOD: ${hoursLabel(rows.reduce((sum, row) => sum + row.hours, 0))} hrs`,
      42,
      y,
      11,
      true,
    );
    y -= 24;
    text("MONTH-TO-DATE HOURS", 42, y, 10, true, accent);
    y -= 17;
    for (const line of wrap(
      "Same selected projects and resources; includes earlier submissions in each month. MTD hours are context and are not added to the reporting-period total.",
      500,
      9,
    )) {
      text(line, 42, y, 9, false, muted);
      y -= 12;
    }
    y -= 8;
    for (const month of mtd) {
      ensure(60);
      text(
        `${reportDate(month.start)} - ${reportDate(month.end)}`,
        42,
        y,
        10,
        true,
      );
      text(`${hoursLabel(month.hours)} hrs MTD`, 445, y, 10, true, accent);
      y -= 20;
      for (const resource of month.resources) {
        const lines = wrap(
          `${resource.resource} / ${resource.client ? resource.client + " / " : ""}${resource.project}`,
          390,
          9,
        );
        ensure(lines.length * 13 + 8);
        for (let i = 0; i < lines.length; i++) {
          text(lines[i], 42, y, 9);
          if (i === 0) text(`${hoursLabel(resource.hours)} hrs`, 479, y, 9);
          y -= 13;
        }
        y -= 5;
      }
      y -= 10;
    }
    y -= 8;
  }
  if (utilization.length) {
    ensure(95);
    text("MONTHLY BUDGET UTILIZATION", 42, y, 10, true, accent);
    y -= 18;
    for (const line of wrap(
      "Full project usage across all resources. Both percentages use the monthly allocation. Client totals combine configured selected projects only. Submitted billable hours are shown.",
      500,
      9,
    )) {
      text(line, 42, y, 9, false, muted);
      y -= 12;
    }
    y -= 10;
    for (const row of utilization) {
      const lines = wrap(
        `${row.level === "client" ? "Client: " : ""}${row.name}${row.level === "project" && row.client ? " / " + row.client : ""}`,
        500,
        10,
        true,
      );
      ensure(lines.length * 14 + 72);
      for (const line of lines) {
        text(line, 42, y, 10, true);
        y -= 14;
      }
      text(
        `Week: ${reportDate(row.weekStart)} - ${reportDate(row.weekEnd)}`,
        42,
        y,
        9,
        false,
        muted,
      );
      y -= 13;
      text(
        `MTD: ${reportDate(row.month)} - ${reportDate(row.mtdEnd)}${row.level === "client" ? ` | ${row.projectCount} configured project(s)` : ""}`,
        42,
        y,
        9,
        false,
        muted,
      );
      y -= 16;
      text(
        `Week: ${hoursLabel(row.weekHours)} hrs | ${percentLabel(row.weekPercent)} used`,
        42,
        y,
        10,
      );
      text(
        `MTD: ${hoursLabel(row.mtdHours)} hrs | ${percentLabel(row.mtdPercent)} used`,
        300,
        y,
        10,
      );
      y -= 25;
    }
    y -= 10;
  }
  for (const row of rows) {
    const key = JSON.stringify([row.week, row.client, row.project]);
    const label = `${row.client ? row.client + " / " : ""}${row.project}`;
    const resourceLines = wrap(row.resource, 425, 11, true);
    const summary = summaries[row.key]?.trim() || "No description submitted.";
    const summaryLines = wrap(summary, 495, 10);
    const sectionLines = wrap(label, 500, 11, true);
    const sectionHeight = key !== section ? sectionLines.length * 14 + 33 : 0;
    const bodyHeight =
      resourceLines.length * 14 +
      summaryLines.length * 14 +
      17 +
      (row.missingDescriptions ? 14 : 0);
    ensure(sectionHeight + Math.min(bodyHeight, 240));
    if (key !== section) {
      text(
        `WEEK OF ${reportDate(row.week)} - ${reportDate(shiftDate(row.week, 6))}`,
        42,
        y,
        9,
        true,
        accent,
      );
      y -= 17;
      for (const line of sectionLines) {
        text(line, 42, y, 11, true);
        y -= 14;
      }
      y -= 10;
      section = key;
    }
    for (let i = 0; i < resourceLines.length; i++) {
      ensure(18);
      text(resourceLines[i], 42, y, 11, true);
      if (i === 0) text(`${hoursLabel(row.hours)} hrs`, 479, y, 10, true);
      y -= 14;
    }
    y -= 3;
    for (const line of summaryLines) {
      if (y - 15 < 65) {
        nextPage();
        text(`${row.resource} (continued)`, 42, y, 10, true);
        y -= 19;
      }
      text(line, 42, y, 10);
      y -= 14;
    }
    if (row.missingDescriptions) {
      ensure(16);
      text(
        `${row.missingDescriptions} submission(s) without a description.`,
        42,
        y,
        9,
        false,
        muted,
      );
      y -= 14;
    }
    y -= 13;
  }
  ensure(45);
  page.drawLine({
    start: { x: 42, y },
    end: { x: 553, y },
    thickness: 1,
    color: ink,
  });
  y -= 23;
  text("TOTAL SUBMITTED HOURS", 42, y, 10, true);
  text(
    `${hoursLabel(rows.reduce((sum, row) => sum + row.hours, 0))} hrs`,
    460,
    y,
    12,
    true,
    accent,
  );
  const pages = pdf.getPages();
  pages.forEach((p, index) => {
    p.drawText("Mano CG LLC | Generated by VantageFP", {
      x: 42,
      y: 32,
      size: 8,
      font: regular,
      color: muted,
    });
    p.drawText(`${index + 1} / ${pages.length}`, {
      x: 522,
      y: 32,
      size: 8,
      font: regular,
      color: muted,
    });
  });
  return pdf.save();
}
