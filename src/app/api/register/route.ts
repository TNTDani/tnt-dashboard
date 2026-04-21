import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const { agencyName, inviteCode, name, email, password } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: "All fields are required." }, { status: 400 });
    }
    if (!agencyName && !inviteCode) {
      return NextResponse.json(
        { error: "Provide either an agency name (create) or an invite code (join)." },
        { status: 400 },
      );
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const { data: existing } = await supabaseAdmin
      .from("agency_users")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "Email already registered." }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const userId = uuid();

    if (inviteCode) {
      // ── Join existing agency via invite code ──────────────────────────────
      const { data: invite } = await supabaseAdmin
        .from("invite_codes")
        .select("agency_id, role, expires_at, used_at")
        .eq("code", inviteCode.trim())
        .maybeSingle();

      if (!invite) {
        return NextResponse.json({ error: "Invalid invite code." }, { status: 400 });
      }
      if (invite.used_at) {
        return NextResponse.json({ error: "Invite code has already been used." }, { status: 400 });
      }
      if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
        return NextResponse.json({ error: "Invite code has expired." }, { status: 400 });
      }

      // Write order matters:
      // 1) insert users       — stable identity row; FK anchor for the audit trail
      // 2) insert agency_users — membership record; if this fails, the code stays
      //                         usable and the orphan users row is recoverable
      // 3) mark code used     — only after membership succeeds; reversing steps 2
      //                         and 3 would burn the invite on a failed insert with
      //                         no way to recover it
      const { error: userErr } = await supabaseAdmin
        .from("users")
        .insert({ id: userId, email: normalizedEmail });
      if (userErr) throw userErr;

      const { error: memberErr } = await supabaseAdmin.from("agency_users").insert({
        id:            userId,
        agency_id:     invite.agency_id,
        email:         normalizedEmail,
        password_hash: passwordHash,
        name:          name.trim(),
        role:          invite.role,
      });
      if (memberErr) throw memberErr;

      // Guard against a race: only update if the code is still unused.
      const { error: codeErr } = await supabaseAdmin
        .from("invite_codes")
        .update({ used_by_user_id: userId, used_at: new Date().toISOString() })
        .eq("code", inviteCode.trim())
        .is("used_at", null);
      if (codeErr) throw codeErr;

    } else {
      // ── Create new agency ─────────────────────────────────────────────────
      const agencyId = uuid();

      const { error: agencyErr } = await supabaseAdmin
        .from("agencies")
        .insert({ id: agencyId, name: agencyName.trim(), owner_email: normalizedEmail });
      if (agencyErr) throw agencyErr;

      const { error: userErr } = await supabaseAdmin
        .from("users")
        .insert({ id: userId, email: normalizedEmail });
      if (userErr) throw userErr;

      const { error: memberErr } = await supabaseAdmin.from("agency_users").insert({
        id:            userId,
        agency_id:     agencyId,
        email:         normalizedEmail,
        password_hash: passwordHash,
        name:          name.trim(),
        role:          "owner",
      });
      if (memberErr) throw memberErr;
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[register]", err);
    return NextResponse.json({ error: "Registration failed." }, { status: 500 });
  }
}
