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
      error: reply({ error: "Sign in to configure report settings." }, 401),
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
const uuid = (v: unknown): v is string =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
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
    const [projections, roles] = await Promise.all([
      ctx
        .db!.from("report_program_projections")
        .select("client_id,month,amount,enabled")
        .eq("company_id", ctx.companyId)
        .gte("month", start)
        .lte("month", end),
      ctx
        .db!.from("report_resource_roles")
        .select("client_id,team_member_id,role")
        .eq("company_id", ctx.companyId),
    ]);
    if (projections.error || roles.error) throw new Error("read");
    return reply({
      projections: projections.data || [],
      roles: roles.data || [],
    });
  } catch {
    return reply(
      { error: "Report settings could not be loaded. Please retry." },
      500,
    );
  }
}
export async function POST(req: NextRequest) {
  try {
    const ctx = await context(req);
    if (ctx.error) return ctx.error;
    const raw = await req.text();
    if (raw.length > 100000)
      return reply({ error: "Save fewer settings at once." }, 413);
    let body: any;
    try {
      body = JSON.parse(raw);
    } catch {
      return reply({ error: "Invalid report settings." }, 400);
    }
    if (
      !body ||
      !["projections", "roles"].includes(body.kind) ||
      !Array.isArray(body.rows) ||
      !body.rows.length ||
      body.rows.length > 300
    )
      return reply({ error: "Choose report settings to save." }, 400);
    const projection = body.kind === "projections",
      clients = new Set<string>(),
      members = new Set<string>(),
      keys = new Set<string>();
    for (const row of body.rows) {
      if (!row || !uuid(row.client_id))
        return reply({ error: "Choose a valid client." }, 400);
      clients.add(row.client_id);
      let key: string;
      if (projection) {
        if (
          !validMonth(row.month) ||
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
                "Enter a positive monthly projection with at most two decimal places.",
            },
            400,
          );
        key = JSON.stringify([row.client_id, row.month]);
      } else {
        if (
          !uuid(row.team_member_id) ||
          typeof row.role !== "string" ||
          row.role.trim().length > 80
        )
          return reply(
            { error: "Choose a resource and a role of at most 80 characters." },
            400,
          );
        members.add(row.team_member_id);
        key = JSON.stringify([row.client_id, row.team_member_id]);
      }
      if (keys.has(key))
        return reply({ error: "Remove duplicate settings." }, 400);
      keys.add(key);
    }
    const { data: allowedClients, error: clientError } = await ctx
      .db!.from("clients")
      .select("id")
      .eq("company_id", ctx.companyId)
      .in("id", Array.from(clients));
    if (clientError || allowedClients?.length !== clients.size)
      return reply(
        { error: "One or more clients are outside your company." },
        403,
      );
    if (!projection) {
      const { data, error } = await ctx
        .db!.from("team_members")
        .select("id")
        .eq("company_id", ctx.companyId)
        .in("id", Array.from(members));
      if (error || data?.length !== members.size)
        return reply(
          { error: "One or more resources are outside your company." },
          403,
        );
    }
    const records = body.rows.map((row: any) => ({
      company_id: ctx.companyId,
      client_id: row.client_id,
      ...(projection
        ? { month: row.month, amount: row.amount, enabled: row.enabled }
        : { team_member_id: row.team_member_id, role: row.role.trim() }),
      updated_by: ctx.userId,
      updated_at: new Date().toISOString(),
    }));
    const { data, error } = await ctx
      .db!.from(
        projection ? "report_program_projections" : "report_resource_roles",
      )
      .upsert(records, {
        onConflict: projection
          ? "company_id,client_id,month"
          : "company_id,client_id,team_member_id",
      })
      .select(
        projection
          ? "client_id,month,amount,enabled"
          : "client_id,team_member_id,role",
      );
    if (error) throw error;
    return reply({ [body.kind]: data || [] });
  } catch {
    return reply(
      {
        error: "Report settings could not be saved. Your inputs are preserved.",
      },
      500,
    );
  }
}
