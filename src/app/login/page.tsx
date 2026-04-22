"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { OrchardLogo } from "@/components/OrchardLogo";

// ── Login Form ─────────────────────────────────────────────────────────────────

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl  = searchParams.get("callbackUrl") || "/";

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPwd,  setShowPwd]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const result = await signIn("credentials", { email, password, remember: String(remember), redirect: false });
    setLoading(false);
    if (result?.error) {
      setError("Invalid email or password.");
    } else {
      router.push(callbackUrl);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    fontSize: 14,
    fontFamily: "inherit",
    border: "1px solid rgba(20,33,26,0.12)",
    borderRadius: 8,
    outline: "none",
    color: "#0f1711",
    background: "#fff",
    transition: "border-color 0.15s, box-shadow 0.15s",
  };

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
            Sign in to your workspace.
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
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Email */}
              <div>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 500, color: "#2a3a30", marginBottom: 6 }}>
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@agency.com"
                  style={inputStyle}
                  onFocus={e => { e.target.style.borderColor = "#2D4A2D"; e.target.style.boxShadow = "0 0 0 3px rgba(45,74,45,0.1)"; }}
                  onBlur={e => { e.target.style.borderColor = "rgba(20,33,26,0.12)"; e.target.style.boxShadow = "none"; }}
                />
              </div>

              {/* Password */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <label style={{ fontSize: 12.5, fontWeight: 500, color: "#2a3a30" }}>Password</label>
                  <a href="#" style={{ fontSize: 12, color: "#2D4A2D", textDecoration: "none" }}>Forgot password?</a>
                </div>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPwd ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    style={{ ...inputStyle, paddingRight: 40 }}
                    onFocus={e => { e.target.style.borderColor = "#2D4A2D"; e.target.style.boxShadow = "0 0 0 3px rgba(45,74,45,0.1)"; }}
                    onBlur={e => { e.target.style.borderColor = "rgba(20,33,26,0.12)"; e.target.style.boxShadow = "none"; }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(v => !v)}
                    style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#8a9a90", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                  >
                    {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "10px 14px" }}>
                  <p style={{ fontSize: 13, color: "#EF4444" }}>{error}</p>
                </div>
              )}

              {/* Remember me */}
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setRemember(v => !v)}
                  style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, background: remember ? "#2D4A2D" : "transparent", border: remember ? "1px solid #2D4A2D" : "1px solid rgba(20,33,26,0.2)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                >
                  {remember && (
                    <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                      <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
                <span style={{ fontSize: 13, color: "#5a6a60" }}>
                  Remember me <span style={{ fontSize: 11, color: "#8a9a90" }}>({remember ? "7 days" : "24 hours"})</span>
                </span>
              </div>

              {/* Submit */}
              <motion.button
                type="submit"
                disabled={loading}
                whileTap={{ scale: 0.98 }}
                style={{ width: "100%", padding: "11px 16px", background: loading ? "#3D6B3D" : "#2D4A2D", color: "#fff", fontSize: 14, fontWeight: 500, fontFamily: "inherit", border: "none", borderRadius: 8, cursor: loading ? "default" : "pointer", transition: "background 0.15s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4 }}
                onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = "#3D6B3D"; }}
                onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = "#2D4A2D"; }}
              >
                {loading ? <><Loader2 size={15} className="animate-spin" /> Signing in…</> : "Sign in"}
              </motion.button>
            </form>
          </div>

          <div style={{ textAlign: "center", fontSize: 12.5, color: "#8a9a90", marginTop: 20 }}>
            Don&apos;t have an account?{" "}
            <Link href="/register" style={{ color: "#2D4A2D", textDecoration: "none", fontWeight: 500 }}>Register now →</Link>
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

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
