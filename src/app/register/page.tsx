"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { motion } from "motion/react";
import { Loader2, Eye, EyeOff } from "lucide-react";

function OrchardMark({ size = 36, color = "white" }: { size?: number; color?: string }) {
  const w = Math.round((size / 36) * 48);
  return (
    <svg width={w} height={size} viewBox="0 0 48 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3"  y="2"  width="8" height="8" rx="2" fill={color} />
      <rect x="20" y="2"  width="8" height="8" rx="2" fill={color} />
      <rect x="37" y="2"  width="8" height="8" rx="2" fill={color} />
      <rect x="20" y="14" width="8" height="8" rx="2" fill={color} />
      <rect x="3"  y="26" width="8" height="8" rx="2" fill={color} />
      <rect x="20" y="26" width="8" height="8" rx="2" fill={color} />
      <rect x="37" y="26" width="8" height="8" rx="2" fill={color} />
      <line x1="7"  y1="10" x2="24" y2="14" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="24" y1="10" x2="24" y2="14" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="41" y1="10" x2="24" y2="14" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="24" y1="22" x2="7"  y2="26" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="24" y1="22" x2="24" y2="26" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="24" y1="22" x2="41" y2="26" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

type Mode = "create" | "join";

export default function RegisterPage() {
  const router = useRouter();

  const [mode,            setMode]            = useState<Mode>("create");
  const [agencyName,      setAgencyName]      = useState("");
  const [inviteCode,      setInviteCode]      = useState("");
  const [fullName,        setFullName]        = useState("");
  const [email,           setEmail]           = useState("");
  const [password,        setPassword]        = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd,         setShowPwd]         = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState("");
  const [focusedField,    setFocusedField]    = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }

    setLoading(true);
    try {
      const body =
        mode === "join"
          ? { inviteCode: inviteCode.trim(), name: fullName, email, password }
          : { agencyName: agencyName.trim(), name: fullName, email, password };

      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Registration failed."); return; }

      const result = await signIn("credentials", { email, password, redirect: false });
      router.push(result?.error ? "/login" : "/");
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (field: string): React.CSSProperties => ({
    width: "100%",
    padding: "10px 14px",
    fontSize: 14,
    fontFamily: "inherit",
    border: `1px solid ${focusedField === field ? "#2D4A2D" : "rgba(20,33,26,0.12)"}`,
    borderRadius: 8,
    outline: "none",
    color: "#0f1711",
    background: "#fff",
    boxShadow: focusedField === field ? "0 0 0 3px rgba(45,74,45,0.1)" : "none",
    transition: "border-color 0.15s, box-shadow 0.15s",
  });

  const segmentStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: "7px 12px",
    fontSize: 13,
    fontWeight: active ? 500 : 400,
    fontFamily: "inherit",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    background: active ? "#fff" : "transparent",
    color: active ? "#0f1711" : "#8a9a90",
    boxShadow: active ? "0 1px 3px rgba(20,33,26,0.1)" : "none",
    transition: "background 0.15s, color 0.15s, box-shadow 0.15s",
  });

  return (
    <div className="min-h-screen flex" style={{ fontFamily: "var(--font-inter), Inter, system-ui, sans-serif" }}>

      {/* ── Left panel — 50% moss ── */}
      <div
        className="hidden lg:flex lg:w-1/2 relative flex-col flex-shrink-0 overflow-hidden"
        style={{ background: "#2D4A2D", padding: "52px 56px" }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
            pointerEvents: "none",
          }}
        />

        {/* Logo */}
        <div className="flex items-center gap-3 relative z-10 mb-auto">
          <OrchardMark size={32} color="white" />
          <span style={{ fontSize: 22, fontWeight: 500, color: "#fff", letterSpacing: "-0.3px" }}>Orchard</span>
        </div>

        {/* Tagline */}
        <div className="relative z-10" style={{ paddingBottom: 16 }}>
          <div style={{ fontSize: 28, fontWeight: 400, color: "#fff", lineHeight: 1.25, marginBottom: 12 }}>
            Cultivate your pipeline.
          </div>
          <div style={{ fontSize: 14, fontWeight: 400, color: "rgba(255,255,255,0.65)", lineHeight: 1.6, maxWidth: 320 }}>
            The recruitment OS for boutique agencies.
          </div>
        </div>

        <div className="relative z-10" style={{ marginTop: 40 }}>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: "0.2px" }}>
            © 2026 Orchard · Built in Amsterdam
          </p>
        </div>
      </div>

      {/* ── Right panel — 50% near-white ── */}
      <div
        className="flex-1 flex items-center justify-center"
        style={{ background: "#fafafa", padding: 40 }}
      >
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          style={{ width: "100%", maxWidth: 380 }}
        >
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div style={{ background: "#2D4A2D", borderRadius: 8, padding: 6 }}>
              <OrchardMark size={20} color="white" />
            </div>
            <span style={{ fontSize: 18, fontWeight: 600, color: "#0f1711" }}>Orchard</span>
          </div>

          <div style={{ fontSize: 24, fontWeight: 500, color: "#0f1711", letterSpacing: "-0.3px", marginBottom: 4 }}>
            {mode === "create" ? "Create your workspace" : "Join your agency"}
          </div>
          <div style={{ fontSize: 13.5, color: "#5a6a60", marginBottom: 28 }}>
            {mode === "create" ? "Start growing in 30 seconds" : "Enter your invite code to get started"}
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Mode toggle */}
            <div
              style={{
                display: "flex",
                gap: 4,
                background: "rgba(20,33,26,0.06)",
                borderRadius: 8,
                padding: 3,
                marginBottom: 2,
              }}
            >
              <button type="button" style={segmentStyle(mode === "create")} onClick={() => setMode("create")}>
                Create new agency
              </button>
              <button type="button" style={segmentStyle(mode === "join")} onClick={() => setMode("join")}>
                Join with invite code
              </button>
            </div>

            {/* Agency name / invite code */}
            {mode === "create" ? (
              <div>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 500, color: "#2a3a30", marginBottom: 5 }}>
                  Agency name
                </label>
                <input
                  type="text" value={agencyName} onChange={e => setAgencyName(e.target.value)}
                  required placeholder="Acme Recruitment"
                  style={inputStyle("agency")}
                  onFocus={() => setFocusedField("agency")} onBlur={() => setFocusedField(null)}
                />
              </div>
            ) : (
              <div>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 500, color: "#2a3a30", marginBottom: 5 }}>
                  Invite code
                </label>
                <input
                  type="text" value={inviteCode} onChange={e => setInviteCode(e.target.value)}
                  required placeholder="xxxx-xxxx-xxxx"
                  autoComplete="off" spellCheck={false}
                  style={inputStyle("invite")}
                  onFocus={() => setFocusedField("invite")} onBlur={() => setFocusedField(null)}
                />
              </div>
            )}

            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 500, color: "#2a3a30", marginBottom: 5 }}>
                Your name
              </label>
              <input
                type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                required placeholder="Jane Smith"
                style={inputStyle("name")}
                onFocus={() => setFocusedField("name")} onBlur={() => setFocusedField(null)}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 500, color: "#2a3a30", marginBottom: 5 }}>
                Email
              </label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                required autoComplete="email" placeholder="you@agency.com"
                style={inputStyle("email")}
                onFocus={() => setFocusedField("email")} onBlur={() => setFocusedField(null)}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 500, color: "#2a3a30", marginBottom: 5 }}>
                Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPwd ? "text" : "password"} value={password}
                  onChange={e => setPassword(e.target.value)}
                  required minLength={8} autoComplete="new-password" placeholder="Min. 8 characters"
                  style={{ ...inputStyle("pwd"), paddingRight: 40 }}
                  onFocus={() => setFocusedField("pwd")} onBlur={() => setFocusedField(null)}
                />
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#8a9a90", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 500, color: "#2a3a30", marginBottom: 5 }}>
                Confirm password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showConfirm ? "text" : "password"} value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required autoComplete="new-password" placeholder="••••••••"
                  style={{ ...inputStyle("confirm"), paddingRight: 40 }}
                  onFocus={() => setFocusedField("confirm")} onBlur={() => setFocusedField(null)}
                />
                <button type="button" onClick={() => setShowConfirm(v => !v)}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#8a9a90", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <div style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "10px 14px" }}>
                <p style={{ fontSize: 13, color: "#EF4444" }}>{error}</p>
              </div>
            )}

            <motion.button
              type="submit" disabled={loading} whileTap={{ scale: 0.98 }}
              style={{ width: "100%", padding: "11px 16px", background: loading ? "#3D6B3D" : "#2D4A2D", color: "#fff", fontSize: 14, fontWeight: 500, fontFamily: "inherit", border: "none", borderRadius: 8, cursor: loading ? "default" : "pointer", transition: "background 0.15s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4 }}
              onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = "#3D6B3D"; }}
              onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = "#2D4A2D"; }}
            >
              {loading
                ? <><Loader2 size={15} className="animate-spin" /> {mode === "create" ? "Creating account…" : "Joining agency…"}</>
                : mode === "create" ? "Create account" : "Join agency"}
            </motion.button>
          </form>

          <div style={{ textAlign: "center", fontSize: 12.5, color: "#8a9a90", marginTop: 24 }}>
            Already have an account?{" "}
            <a href="/login" style={{ color: "#2D4A2D", textDecoration: "none", fontWeight: 500 }}>Sign in →</a>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
