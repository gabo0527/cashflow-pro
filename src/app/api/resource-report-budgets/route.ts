import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/contractor-auth";
import { isAdminEmail } from "@/lib/admin-allowlist";
import { validISODate } from "@/lib/timesheet-daily";
export const runtime = "nodejs";
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
async function context(req: NextRequest) {
  const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!token)
    return {
      error: reply({ error: "Sign in to configure report budgets." }, 401),
    };
  const db = getSupabaseAdmin(),
    { data, error } = await db.auth.getUser(token);
  if (error || !data.user)
    return { error: reply({ error: "Your session has expired." }, 401) };
  if (!isAdminEmail(data.user.email))
    return {
      error: reply({ error: "Administrator access is required." }, 403),
    };
  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("company_id")
    .eq("id", data.user.id)
    .single();
  if (profileError || !profile?.company_id)
    return { error: reply({ error: "Company access is unavailable." }, 403) };
  return { db, companyId: profile.company_id, userId: data.user.id };
}
const validMonth = (value: unknown): value is string =>
  typeof value === "string" && validISODate(value) && value.endsWith("-01");
export async function GET(req: NextRequest) {
  try {
    const ctx = await context(req);
    if (ctx.error) return ctx.error;
    const start = req.nextUrl.searchParams.get("start"),
      end = req.nextUrl.searchParams.get("end");
    if (
      !validMonth(start) ||
      !validMonth(end) ||
      start > end ||
      Date.parse(end) - Date.parse(start) > 397 * 86400000
    )
      return reply({ error: "Choose a valid reporting period." }, 400);
    const { data, error } = await ctx
      .db!.from("report_monthly_budgets")
      .select("project_id,month,amount,enabled")
      .eq("company_id", ctx.companyId)
      .gte("month", start)
      .lte("month", end);
    if (error) throw error;
    return reply({ budgets: data || [] });
  } catch {
    return reply(
      { error: "Report budgets could not be loaded. Please retry." },
      500,
    );
  }
}
export async function POST(req: NextRequest) {
  try {
    const ctx = await context(req);
    if (ctx.error) return ctx.error;
    const raw = await req.text();
    if (raw.length > 50000)
      return reply({ error: "Save fewer projects at once." }, 413);
    let body: any;
    try {
      body = JSON.parse(raw);
    } catch {
      return reply({ error: "Invalid budget settings." }, 400);
    }
    if (
      !validMonth(body.month) ||
      !Array.isArray(body.budgets) ||
      !body.budgets.length ||
      body.budgets.length > 200
    )
      return reply({ error: "Choose a month and projects." }, 400);
    const ids = new Set<string>();
    for (const row of body.budgets) {
      if (
        !row ||
        typeof row.project_id !== "string" ||
        !/^[0-9a-f-]{36}$/i.test(row.project_id) ||
        ids.has(row.project_id) ||
        typeof row.amount !== "number" ||
        !Number.isFinite(row.amount) ||
        row.amount <= 0 ||
        row.amount > 999999999999.99 ||
        Math.abs(row.amount * 100 - Math.round(row.amount * 100)) > 0.001 ||
        typeof row.enabled !== "boolean"
      )
        return reply(
          {
            error:
              "Enter a positive monthly budget with at most two decimal places for each included project.",
          },
          400,
        );
      ids.add(row.project_id);
    }
    const { data: projects, error: projectError } = await ctx
      .db!.from("projects")
      .select("id")
      .eq("company_id", ctx.companyId)
      .in("id", Array.from(ids));
    if (projectError || projects?.length !== ids.size)
      return reply(
        { error: "One or more projects are outside your company." },
        403,
      );
    const records = body.budgets.map((row: any) => ({
      company_id: ctx.companyId,
      project_id: row.project_id,
      month: body.month,
      amount: row.amount,
      enabled: row.enabled,
      updated_by: ctx.userId,
      updated_at: new Date().toISOString(),
    }));
    const { data, error } = await ctx
      .db!.from("report_monthly_budgets")
      .upsert(records, { onConflict: "company_id,project_id,month" })
      .select("project_id,month,amount,enabled");
    if (error) throw error;
    return reply({ budgets: data || [] });
  } catch {
    return reply(
      {
        error: "Report budgets could not be saved. Your inputs are preserved.",
      },
      500,
    );
  }
}
