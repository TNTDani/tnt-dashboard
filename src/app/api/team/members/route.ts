import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { supabaseAdmin } from "@/lib/supabase";

// ── GET /api/team/members ─────────────────────────────────────────────────────
// Returns all agency_users for the caller's agency, sorted by role then join date.

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.AUTH_SECRET });
  if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: caller } = await supabaseAdmin
    .from("agency_users")
    .select("agency_id, role")
    .eq("email", token.email as string)
    .maybeSingle();

  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["owner", "admin"].includes(caller.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: members, error } = await supabaseAdmin
    .from("agency_users")
    .select("email, name, role, created_at")
    .eq("agency_id", caller.agency_id)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[GET /api/team/members]", error);
    return NextResponse.json({ error: "Failed to fetch members." }, { status: 500 });
  }

  return NextResponse.json(members);
}
