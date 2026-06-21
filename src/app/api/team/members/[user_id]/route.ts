import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { supabaseAdmin } from "@/lib/supabase";

// ── DELETE /api/team/members/:user_id ─────────────────────────────────────────
// Removes a member from the caller's agency. Owner-only.
// Guards: cannot remove yourself, cannot remove other owners, cannot remove
// a user that doesn't belong to the same agency.

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ user_id: string }> },
) {
  const token = await getToken({ req, secret: process.env.AUTH_SECRET });
  if (!token?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Resolve caller — need id for self-removal check
  const { data: caller } = await supabaseAdmin
    .from("agency_users")
    .select("id, agency_id, role")
    .eq("email", token.email as string)
    .maybeSingle();

  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (caller.role !== "owner") {
    return NextResponse.json({ error: "Forbidden — only owners can remove members." }, { status: 403 });
  }

  const { user_id: targetId } = await params;

  // Cannot remove yourself
  if (caller.id === targetId) {
    return NextResponse.json(
      { error: "You cannot remove yourself from the team." },
      { status: 400 },
    );
  }

  // Resolve target — scoped to caller's agency to prevent cross-tenant removal
  const { data: target } = await supabaseAdmin
    .from("agency_users")
    .select("id, role")
    .eq("id", targetId)
    .eq("agency_id", caller.agency_id)
    .maybeSingle();

  if (!target) return NextResponse.json({ error: "Member not found." }, { status: 404 });

  // Cannot remove other owners
  if (target.role === "owner") {
    return NextResponse.json({ error: "Owners cannot be removed." }, { status: 403 });
  }

  const { error } = await supabaseAdmin
    .from("agency_users")
    .delete()
    .eq("id", targetId)
    .eq("agency_id", caller.agency_id);

  if (error) {
    console.error("[DELETE /api/team/members]", error);
    return NextResponse.json({ error: "Failed to remove member." }, { status: 500 });
  }

  return NextResponse.json({ removed: targetId });
}
