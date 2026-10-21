import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  BudgetUtilization,
  percentLabel,
  utilizationTitle,
  utilizationCaption,
  utilizationScope,
} from "./resource-report-budget";
import {
  hoursLabel,
  reportDate,
  ResourceReportRow,
  ReportMonthTotal,
  shiftDate,
} from "./resource-report";

// All inputs are report projections; financial fields never enter the document.
export async function createResourceReportPDF(
  rows: ResourceReportRow[],
  summaries: Record<string, string>,
  start: string,
  end: string,
  title: string,
  logo?: Uint8Array,
  mtd: ReportMonthTotal[] = [],
  utilization: BudgetUtilization[] = [],
  peopleMode: "resource" | "role" = "resource",
) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  pdf.setAuthor("Mano CG LLC");
  pdf.setCreator("VantageFP");
  const normal = await pdf.embedFont(StandardFonts.Helvetica),
    bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mark = logo ? await pdf.embedPng(logo) : null;
  const H = 841.89,
    X = 42,
    W = 511.28,
    bottom = 777;
  const ink = rgb(0.141, 0.2, 0.231),
    muted = rgb(0.4, 0.46, 0.5),
    copper = rgb(0.76, 0.39, 0.05);
  const pale = rgb(0.96, 0.97, 0.975),
    line = rgb(0.85, 0.88, 0.9),
    warm = rgb(1, 0.955, 0.91),
    white = rgb(1, 1, 1);
  let page = pdf.addPage([595.28, H]),
    y = 0;
  const safe = (value: string) =>
    Array.from(value.replace(/[\r\n\t]+/g, " "))
      .map((c) => {
        try {
          normal.encodeText(c);
          return c;
        } catch {
          return "?";
        }
      })
      .join("");
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
      y: H - top - size,
      size,
      font: strong ? bold : normal,
      color,
    });
  const right = (
    value: string,
    x: number,
    top: number,
    size = 10,
    strong = false,
    color = ink,
  ) =>
    text(
      value,
      x - (strong ? bold : normal).widthOfTextAtSize(safe(value), size),
      top,
      size,
      strong,
      color,
    );
  const box = (
    x: number,
    top: number,
    width: number,
    height: number,
    fill = white,
    border = line,
  ) =>
    page.drawRectangle({
      x,
      y: H - top - height,
      width,
      height,
      color: fill,
      borderColor: border,
      borderWidth: 0.65,
    });
  const rule = (top: number, x = X, width = W) =>
    page.drawLine({
      start: { x, y: H - top },
      end: { x: x + width, y: H - top },
      color: line,
      thickness: 0.65,
    });
  const wrap = (value: string, width: number, size: number, strong = false) => {
    const font = strong ? bold : normal,
      result: string[] = [];
    let current = "";
    for (const word of safe(value).split(/\s+/)) {
      const candidate = current ? current + " " + word : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) {
        current = candidate;
        continue;
      }
      if (current) result.push(current);
      current = "";
      for (const c of word) {
        if (font.widthOfTextAtSize(current + c, size) > width && current) {
          result.push(current);
          current = "";
        }
        current += c;
      }
    }
    if (current) result.push(current);
    return result.length ? result : [""];
  };
  const paragraph = (
    value: string,
    x: number,
    top: number,
    width: number,
    size = 9,
    leading = 13,
    color = muted,
  ) => {
    const lines = wrap(value, width, size);
    lines.forEach((s, i) => text(s, x, top + i * leading, size, false, color));
    return lines.length * leading;
  };
  const header = (first: boolean, context: string) => {
    if (mark)
      page.drawImage(mark, { x: X, y: H - 43 - 24, width: 122, height: 24 });
    else text("Mano CG LLC", X, 43, 19, true);
    right("RESOURCE REPORT", X + W, 44, 8, true, muted);
    right(
      first ? "MANO CG LLC" : context.toUpperCase(),
      X + W,
      59,
      7,
      false,
      muted,
    );
    rule(82);
    if (first) {
      y = 102;
      for (const s of wrap(title, W, 23, true)) {
        text(s, X, y, 23, true);
        y += 29;
      }
      text(
        `${reportDate(start)} - ${reportDate(end)}`,
        X,
        y + 3,
        10,
        false,
        muted,
      );
      text(
        "Submitted hours and work summary | Monday-Sunday weeks",
        X,
        y + 21,
        8,
        false,
        muted,
      );
      y += 52;
    } else y = 101;
  };
  const newPage = (context: string) => {
    page = pdf.addPage([595.28, H]);
    header(false, context);
  };
  const ensure = (height: number, context = "Report overview") => {
    if (y + height > bottom) {
      newPage(context);
      return true;
    }
    return false;
  };
  const section = (number: string, label: string, description?: string) => {
    ensure(58);
    text(number, X, y + 1, 8, true, copper);
    text(label, X + 25, y - 2, 13, true);
    y += 24;
    if (description) y += paragraph(description, X, y, W, 8, 11) + 9;
  };
  const stats = [
    {
      label: "REPORTING PERIOD",
      value: `${hoursLabel(rows.reduce((sum, r) => sum + r.hours, 0))} hrs`,
      detail: `${reportDate(start)} - ${reportDate(end)}`,
    },
    ...(mtd.length === 1
      ? [
          {
            label: "MONTH TO DATE",
            value: `${hoursLabel(mtd[0].hours)} hrs`,
            detail: `Through ${reportDate(mtd[0].end)}`,
          },
        ]
      : []),
    {
      label: peopleMode === "role" ? "ROLES" : "RESOURCES",
      value: String(new Set(rows.map((r) => r.resource)).size),
      detail: "In the selected reporting period",
    },
  ];
  header(true, "Overview");
  const gap = 10,
    cardW = (W - gap * (stats.length - 1)) / stats.length;
  stats.forEach((stat, i) => {
    const left = X + i * (cardW + gap);
    box(left, y, cardW, 70, i === 0 ? ink : pale, i === 0 ? ink : line);
    text(stat.label, left + 13, y + 11, 7, true, i === 0 ? white : muted);
    text(stat.value, left + 13, y + 26, 22, true, i === 0 ? white : ink);
    text(
      stat.detail,
      left + 13,
      y + 55,
      6.7,
      false,
      i === 0 ? rgb(0.79, 0.84, 0.87) : muted,
    );
  });
  y += 94;
  if (mtd.length) {
    section(
      "01",
      "Month-to-date hours",
      "Same selected projects and resources. MTD provides context; it is not added to reporting-period hours.",
    );
    for (const month of mtd) {
      const tableHead = () => {
        box(X, y, W, 26, ink, ink);
        text(
          `${reportDate(month.start)} - ${reportDate(month.end)}`,
          X + 12,
          y + 8,
          8,
          true,
          white,
        );
        right(
          `${hoursLabel(month.hours)} hrs MTD`,
          X + W - 12,
          y + 7,
          10,
          true,
          white,
        );
        y += 26;
        box(X, y, W, 22, pale);
        text("PROJECT", X + 12, y + 7, 7, true, muted);
        text(
          peopleMode === "role" ? "ROLE" : "RESOURCE",
          X + 163,
          y + 7,
          7,
          true,
          muted,
        );
        right("MTD HOURS", X + W - 12, y + 7, 7, true, muted);
        y += 22;
      };
      ensure(82);
      tableHead();
      month.resources.forEach((r, index) => {
        const project = wrap(
            `${r.client ? r.client + " / " : ""}${r.project}`,
            140,
            8,
          ),
          person = wrap(r.resource, 255, 9);
        const height = Math.max(project.length * 11, person.length * 12) + 11;
        if (ensure(height, "Month-to-date hours")) tableHead();
        box(X, y, W, height, index % 2 ? pale : white);
        project.forEach((s, i) =>
          text(s, X + 12, y + 7 + i * 11, 8, false, muted),
        );
        person.forEach((s, i) => text(s, X + 163, y + 7 + i * 12, 9, true));
        right(hoursLabel(r.hours), X + W - 12, y + 7, 9, true);
        y += height;
      });
      y += 18;
    }
  }
  if (utilization.length) {
    section(
      mtd.length ? "02" : "01",
      utilizationTitle(utilization),
      utilizationCaption(utilization),
    );
    const groups = new Map<string, BudgetUtilization[]>();
    for (const r of utilization) {
      const key = JSON.stringify([
        r.client,
        r.month,
        r.weekStart,
        r.weekEnd,
        r.mtdEnd,
      ]);
      groups.set(key, [...(groups.get(key) || []), r]);
    }
    for (const group of Array.from(groups.values())) {
      const r = group[0];
      const tableHead = () => {
        box(X, y, W, 36, pale);
        text(
          (r.client || "Selected projects") +
            (r.basis === "program"
              ? ` | by ${r.breakdown === "project" ? "site" : r.breakdown === "role" ? "role" : "resource"}`
              : ""),
          X + 12,
          y + 6,
          9,
          true,
        );
        text(
          `Week: ${reportDate(r.weekStart)} - ${reportDate(r.weekEnd)} | MTD: ${reportDate(r.month)} - ${reportDate(r.mtdEnd)}`,
          X + 12,
          y + 21,
          7,
          false,
          muted,
        );
        y += 36;
        box(X, y, W, 24, white);
        text("SCOPE", X + 12, y + 8, 7, true, muted);
        ["WEEK HRS", "WEEK USED", "MTD HRS", "MTD USED"].forEach((label, i) =>
          right(label, X + [275, 350, 420, W - 12][i], y + 8, 6.7, true, muted),
        );
        y += 24;
      };
      ensure(100);
      tableHead();
      const sorted = [
        ...group.filter((r) => r.level !== "client"),
        ...group.filter((r) => r.level === "client"),
      ];
      for (const row of sorted) {
        const isClient = row.level === "client",
          names = wrap(
            isClient
              ? `${row.name} - ${row.basis === "program" ? "program" : "client"} total`
              : row.name,
            192,
            9,
            true,
          ),
          height = Math.max(37, names.length * 12 + (isClient ? 23 : 15));
        if (ensure(height, "Budget utilization")) tableHead();
        box(X, y, W, height, isClient ? ink : white, isClient ? ink : line);
        const color = isClient ? white : ink;
        names.forEach((s, i) =>
          text(s, X + 12, y + 7 + i * 12, 9, true, color),
        );
        if (isClient) {
          text(
            utilizationScope(row),
            X + 12,
            y + height - 12,
            6.7,
            false,
            rgb(0.79, 0.84, 0.87),
          );
        }
        const values = [
          hoursLabel(row.weekHours),
          percentLabel(row.weekPercent),
          hoursLabel(row.mtdHours),
          percentLabel(row.mtdPercent),
        ];
        values.forEach((value, index) =>
          right(
            value,
            X + [275, 350, 420, W - 12][index],
            y + 9,
            9,
            index % 2 === 1,
            color,
          ),
        );
        if (row.mtdPercent !== null) {
          const left = X + W - 73;
          box(
            left,
            y + height - 10,
            61,
            3,
            isClient ? muted : line,
            isClient ? muted : line,
          );
          const fraction = Math.min(1, Math.max(0, row.mtdPercent / 100));
          if (fraction)
            box(left, y + height - 10, 61 * fraction, 3, copper, copper);
        }
        y += height;
      }
      y += 18;
    }
  }
  if ((mtd.length || utilization.length) && rows.length) newPage("Work detail");
  section(
    mtd.length && utilization.length
      ? "03"
      : mtd.length || utilization.length
        ? "02"
        : "01",
    "Weekly work detail",
    `Submitted hours and reviewed work summaries, grouped by project and ${peopleMode === "role" ? "reporting role" : "resource"}.`,
  );
  const groups = new Map<string, ResourceReportRow[]>();
  for (const r of rows) {
    const key = JSON.stringify([r.week, r.client, r.project]);
    groups.set(key, [...(groups.get(key) || []), r]);
  }
  let currentWeek = "";
  for (const group of Array.from(groups.values())) {
    const r = group[0],
      total = group.reduce((sum, r) => sum + r.hours, 0);
    const projectHeader = (continued = false) => {
      const names = wrap(
          r.project + (continued ? " (continued)" : ""),
          W - 115,
          12,
          true,
        ),
        height = names.length * 16 + 28;
      box(X, y, W, height, ink, ink);
      text(
        r.client.toUpperCase() || "PROJECT",
        X + 14,
        y + 7,
        7,
        true,
        rgb(0.79, 0.84, 0.87),
      );
      names.forEach((s, i) =>
        text(s, X + 14, y + 21 + i * 16, 12, true, white),
      );
      right(`${hoursLabel(total)} hrs`, X + W - 14, y + 21, 12, true, white);
      y += height;
    };
    ensure(145, "Work detail");
    if (currentWeek !== r.week) {
      text(
        `WEEK OF ${reportDate(r.week)} - ${reportDate(shiftDate(r.week, 6))}`,
        X,
        y,
        8,
        true,
        copper,
      );
      y += 22;
      currentWeek = r.week;
    }
    projectHeader();
    for (const row of group) {
      const nameLines = wrap(row.resource, W - 120, 10.5, true),
        summaryLines = wrap(
          summaries[row.key]?.trim() || "No description submitted.",
          W - 30,
          10,
        );
      let remaining = [...summaryLines],
        continued = false;
      while (remaining.length) {
        const nameHeight = nameLines.length * 14,
          warningHeight = row.missingDescriptions ? 16 : 0,
          fixed = nameHeight + 30 + warningHeight;
        if (y + fixed + 30 > bottom) {
          newPage("Work detail");
          projectHeader(true);
        }
        const available = Math.max(1, Math.floor((bottom - y - fixed) / 15)),
          count = Math.min(remaining.length, available),
          chunk = remaining.slice(0, count),
          height = fixed + chunk.length * 15;
        box(X, y, W, height, white);
        nameLines.forEach((s, i) =>
          text(
            s + (continued && i === nameLines.length - 1 ? " (continued)" : ""),
            X + 15,
            y + 12 + i * 14,
            10.5,
            true,
          ),
        );
        box(X + W - 89, y + 9, 74, 23, warm, warm);
        right(
          `${hoursLabel(row.hours)} hrs`,
          X + W - 25,
          y + 15,
          9.5,
          true,
          copper,
        );
        chunk.forEach((s, i) =>
          text(s, X + 15, y + 18 + nameHeight + i * 15, 10),
        );
        if (row.missingDescriptions && count === remaining.length)
          text(
            `${row.missingDescriptions} submission(s) without a description.`,
            X + 15,
            y + height - 20,
            8,
            false,
            muted,
          );
        y += height;
        remaining = remaining.slice(count);
        continued = true;
      }
    }
    y += 20;
  }
  ensure(51, "Work detail");
  box(X, y, W, 43, pale);
  text("TOTAL SUBMITTED HOURS", X + 14, y + 15, 8, true, muted);
  right(
    `${hoursLabel(rows.reduce((sum, r) => sum + r.hours, 0))} hrs`,
    X + W - 14,
    y + 11,
    17,
    true,
  );
  const pages = pdf.getPages();
  pages.forEach((p, index) => {
    p.drawLine({
      start: { x: X, y: 42 },
      end: { x: X + W, y: 42 },
      thickness: 0.65,
      color: line,
    });
    p.drawText("Mano CG LLC | Generated by VantageFP", {
      x: X,
      y: 26,
      size: 7.5,
      font: normal,
      color: muted,
    });
    const label = `${index + 1} / ${pages.length}`;
    p.drawText(label, {
      x: X + W - normal.widthOfTextAtSize(label, 7.5),
      y: 26,
      size: 7.5,
      font: normal,
      color: muted,
    });
  });
  return pdf.save();
}
