import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const { agencyName, name, email, password } = await req.json();

    if (!agencyName || !name || !email || !password) {
      return NextResponse.json({ error: "All fields are required." }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

    // Check if email already registered
    const { data: existing } = await supabaseAdmin
      .from("agency_users")
      .select("id")
      .eq("email", email)
      .single();

    if (existing) {
      return NextResponse.json({ error: "Email already registered." }, { status: 409 });
    }

    // Find or create agency
    let agencyId: string;
    const { data: existingAgency } = await supabaseAdmin
      .from("agencies")
      .select("id")
      .ilike("name", agencyName.trim())
      .single();

    if (existingAgency) {
      agencyId = existingAgency.id;
    } else {
      const newId = uuid();
      const { error: agencyErr } = await supabaseAdmin
        .from("agencies")
        .insert({ id: newId, name: agencyName.trim(), owner_email: email });
      if (agencyErr) throw agencyErr;
      agencyId = newId;
    }

    // Hash password and create user
    const passwordHash = await bcrypt.hash(password, 12);
    const { error: userErr } = await supabaseAdmin.from("agency_users").insert({
      id:            uuid(),
      agency_id:     agencyId,
      email:         email.trim().toLowerCase(),
      password_hash: passwordHash,
      name:          name.trim(),
      role:          "member",
    });
    if (userErr) throw userErr;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[register]", err);
    return NextResponse.json({ error: "Registration failed." }, { status: 500 });
  }
}
