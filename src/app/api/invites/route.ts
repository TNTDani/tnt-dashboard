import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { randomBytes } from "crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { sendInvite } from "@/lib/email";

async function getCaller(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.AUTH_SECRET });
  if (!token?.email) return null;

  const { data: caller } = await supabaseAdmin
    .from("agency_users")
    .select("agency_id, role, email")
    .eq("email", token.email as string)
    .maybeSingle();

  return caller ?? null;
}

// ── GET /api/invites ──────────────────────────────────────────────────────────
// Returns all invite_codes for the caller's agency with a computed status field.

export async function GET(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["owner", "admin"].includes(caller.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: rows, error } = await supabaseAdmin
    .from("invite_codes")
    .select("*, users(email)")
    .eq("agency_id", caller.agency_id);

  if (error) {
    console.error("[GET /api/invites]", error);
    return NextResponse.json({ error: "Failed to fetch invites." }, { status: 500 });
  }

  const now = Date.now();
  type Row = {
    code: string;
    agency_id: string;
    role: string;
    created_by: string;
    created_at: string;
    expires_at: string | null;
    used_by_user_id: string | null;
    used_at: string | null;
    users: { email: string } | null;
  };

  const result = (rows as Row[]).map(r => ({
    code:           r.code,
    role:           r.role,
    created_by:     r.created_by,
    created_at:     r.created_at,
    expires_at:     r.expires_at,
    used_at:        r.used_at,
    used_by_email:  r.users?.email ?? null,
    status: r.used_at
      ? "used"
      : r.expires_at && new Date(r.expires_at).getTime() < now
        ? "expired"
        : "active",
  }));

  result.sort((a, b) => {
    if (a.status === "active" && b.status !== "active") return -1;
    if (a.status !== "active" && b.status === "active") return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return NextResponse.json(result);
}

// ── POST /api/invites ─────────────────────────────────────────────────────────
// Generates a new invite code for the caller's agency.

export async function POST(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["owner", "admin"].includes(caller.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const role: unknown = body.role ?? "member";
  const expiresInDays: unknown = body.expiresInDays ?? 14;
  const inviteEmail: string | undefined = typeof body.inviteEmail === "string" ? body.inviteEmail.trim().toLowerCase() : undefined;

  // Role validation — never allow 'owner' codes; admins can only invite members.
  if (role !== "member" && role !== "admin") {
    return NextResponse.json({ error: "role must be 'member' or 'admin'." }, { status: 400 });
  }
  if (caller.role === "admin" && role === "admin") {
    return NextResponse.json(
      { error: "Admins can only invite members. Only owners can invite admins." },
      { status: 403 },
    );
  }

  // expiresInDays validation.
  if (!Number.isInteger(expiresInDays) || (expiresInDays as number) < 1 || (expiresInDays as number) > 90) {
    return NextResponse.json({ error: "expiresInDays must be an integer between 1 and 90." }, { status: 400 });
  }

  const code = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + (expiresInDays as number) * 86400000).toISOString();

  const { error } = await supabaseAdmin.from("invite_codes").insert({
    code,
    agency_id:  caller.agency_id,
    role,
    created_by: caller.email,
    expires_at: expiresAt,
  });

  if (error) {
    console.error("[POST /api/invites]", error);
    return NextResponse.json({ error: "Failed to create invite." }, { status: 500 });
  }

  // Optionally send invite email.
  if (inviteEmail) {
    try {
      const { data: agency } = await supabaseAdmin
        .from("agencies")
        .select("name")
        .eq("id", caller.agency_id)
        .maybeSingle();

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.orchard.works";
      await sendInvite({
        to: inviteEmail,
        inviteUrl: `${appUrl}/register?code=${code}`,
        agencyName: agency?.name ?? "your agency",
        inviterName: caller.email,
      });
    } catch (mailErr) {
      // Non-fatal: code was created, email sending just failed.
      console.error("[POST /api/invites] email send failed", mailErr);
    }
  }

  return NextResponse.json({ code, expiresAt });
}
