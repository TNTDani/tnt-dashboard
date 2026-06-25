"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { motion } from "motion/react";
import { Loader2, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { OrchardLogo } from "@/components/OrchardLogo";

type Mode = "create" | "join";

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterContent />
    </Suspense>
  );
}

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mode,            setMode]            = useState<Mode>("create");
  const [agencyName,      setAgencyName]      = useState("");
  const [inviteCode,      setInviteCode]      = useState("");

  // Pre-populate invite code from ?code= URL param and switch to join mode.
  useEffect(() => {
    const code = searchParams.get("code");
    if (code) {
      setInviteCode(code);
      setMode("join");
    }
  }, [searchParams]);

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
    <div
      style={{
        position: "relative",
        minHeight: "100vh",
        background: "#FAF7F2",
        fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* Dotted grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "radial-gradient(circle, rgba(20,33,26,0.10) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          pointerEvents: "none",
        }}
      />

      {/* Header */}
      <header
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "20px 32px",
          zIndex: 10,
        }}
      >
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <OrchardLogo size={32} />
          <span style={{ fontFamily: "var(--font-dm-serif)", fontSize: 20, color: "#2D4A2D", letterSpacing: "-0.2px" }}>
            Orchard
          </span>
        </Link>
        <a
          href="https://orchard-marketing.vercel.app/"
          style={{ fontSize: 13, color: "#8a9a90", textDecoration: "none", transition: "color 0.15s" }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = "#2D4A2D"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = "#8a9a90"; }}
        >
          Back to site →
        </a>
      </header>

      {/* Centered content */}
      <main
        style={{
          position: "relative",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "96px 24px 72px",
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          style={{ width: "100%", maxWidth: 400 }}
        >
          {/* Heading */}
          <h1
            style={{
              fontFamily: "var(--font-dm-serif)",
              fontSize: 42,
              fontWeight: 400,
              color: "#0f1711",
              lineHeight: 1.1,
              letterSpacing: "-0.5px",
              marginBottom: 10,
            }}
          >
            Cultivate your pipeline.
          </h1>
          <p style={{ fontSize: 15, color: "#8a9a90", marginBottom: 28 }}>
            {mode === "create" ? "Create your workspace." : "Join your team."}
          </p>

          {/* Form card */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: 16,
              border: "1px solid rgba(20,33,26,0.08)",
              padding: 28,
              boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
            }}
          >
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
          </div>

          <div style={{ textAlign: "center", fontSize: 12.5, color: "#8a9a90", marginTop: 20 }}>
            Already have an account?{" "}
            <Link href="/login" style={{ color: "#2D4A2D", textDecoration: "none", fontWeight: 500 }}>Sign in →</Link>
          </div>
          <div style={{ textAlign: "center", fontSize: 11.5, color: "#aab8b0", marginTop: 10 }}>
            By creating an account you agree to our{" "}
            <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: "#5a6a60", textDecoration: "underline" }}>Terms of Service</a>
            {" "}and{" "}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "#5a6a60", textDecoration: "underline" }}>Privacy Policy</a>.
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          textAlign: "center",
          padding: "20px 24px",
          fontSize: 11,
          color: "#8a9a90",
          letterSpacing: "0.2px",
        }}
      >
        © 2026 Orchard · Built in Amsterdam
      </footer>
    </div>
  );
}
