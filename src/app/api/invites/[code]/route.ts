import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { supabaseAdmin } from "@/lib/supabase";

// ── DELETE /api/invites/:code ─────────────────────────────────────────────────
// Revokes an unused invite code. Returns 404 if not found, already used, or
// belongs to a different agency — deliberately indistinct to avoid leaking
// existence across tenants.

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
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

  const { code } = await params;

  const { count, error } = await supabaseAdmin
    .from("invite_codes")
    .delete({ count: "exact" })
    .eq("code", code)
    .eq("agency_id", caller.agency_id)
    .is("used_at", null);

  if (error) {
    console.error("[DELETE /api/invites/:code]", error);
    return NextResponse.json({ error: "Failed to revoke invite." }, { status: 500 });
  }

  if (!count || count === 0) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
