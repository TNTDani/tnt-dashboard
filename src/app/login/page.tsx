"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";

// ── Orchard logo mark ─────────────────────────────────────────────────────────

function OrchardMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2"  y="2"  width="8" height="8" rx="2" fill="white"/>
      <rect x="14" y="2"  width="8" height="8" rx="2" fill="white"/>
      <rect x="26" y="2"  width="8" height="8" rx="2" fill="white"/>
      <rect x="14" y="14" width="8" height="8" rx="2" fill="white"/>
      <rect x="2"  y="26" width="8" height="8" rx="2" fill="white"/>
      <rect x="14" y="26" width="8" height="8" rx="2" fill="white"/>
      <rect x="26" y="26" width="8" height="8" rx="2" fill="white"/>
      <line x1="10" y1="6"  x2="14" y2="6"  stroke="white" strokeWidth="1.5"/>
      <line x1="22" y1="6"  x2="26" y2="6"  stroke="white" strokeWidth="1.5"/>
      <line x1="18" y1="10" x2="18" y2="14" stroke="white" strokeWidth="1.5"/>
      <line x1="18" y1="22" x2="18" y2="26" stroke="white" strokeWidth="1.5"/>
      <line x1="10" y1="30" x2="14" y2="30" stroke="white" strokeWidth="1.5"/>
      <line x1="22" y1="30" x2="26" y2="30" stroke="white" strokeWidth="1.5"/>
      <line x1="6"  y1="10" x2="6"  y2="26" stroke="white" strokeWidth="1.5"/>
    </svg>
  );
}

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

  return (
    <div className="min-h-screen flex" style={{ fontFamily: "var(--font-dm-sans, var(--font-inter), system-ui, sans-serif)" }}>

      {/* ── Left panel ── */}
      <div
        className="hidden lg:flex lg:w-[420px] relative flex-col flex-shrink-0 overflow-hidden"
        style={{ background: "#1D2B1F", padding: "52px 48px" }}
      >
        {/* Organic bg circles */}
        <div style={{ position: "absolute", width: 500, height: 500, borderRadius: "50%", background: "rgba(255,255,255,0.025)", bottom: -180, left: -120, pointerEvents: "none" }} />
        <div style={{ position: "absolute", width: 280, height: 280, borderRadius: "50%", background: "rgba(109,200,138,0.07)", top: -80, right: -80, pointerEvents: "none" }} />

        {/* Logo */}
        <div className="flex items-center gap-3 relative z-10" style={{ marginBottom: "auto" }}>
          <OrchardMark size={36} />
          <span style={{ fontSize: 24, fontWeight: 500, color: "#fff", letterSpacing: "-0.3px" }}>Orchard</span>
        </div>

        {/* Tagline + stats */}
        <div className="relative z-10" style={{ paddingBottom: 12 }}>
          <div style={{ fontFamily: "var(--font-dm-serif, serif)", fontSize: 34, color: "#fff", fontWeight: 400, lineHeight: 1.2, letterSpacing: "-0.5px", marginBottom: 16 }}>
            Recruitment,<br /><span style={{ color: "#6DC88A" }}>rooted</span> in data.
          </div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.6, maxWidth: 280 }}>
            Source candidates, track vacancies, and close placements — all in one place.
          </div>
          <div style={{ display: "flex", gap: 32, marginTop: 40, paddingTop: 32, borderTop: "0.5px solid rgba(255,255,255,0.1)" }}>
            {[
              { value: "2.4k", label: "Candidates sourced" },
              { value: "98%",  label: "Placement rate"     },
              { value: "34",   label: "Active clients"     },
            ].map((s) => (
              <div key={s.label}>
                <div style={{ fontSize: 22, fontWeight: 600, color: "#fff", letterSpacing: "-0.5px" }}>{s.value}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.8px" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div
        className="flex-1 flex items-center justify-center"
        style={{ background: "#ECEEE8", backgroundImage: "radial-gradient(#c8cbbf 1px, transparent 1px)", backgroundSize: "22px 22px", padding: 40 }}
      >
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
          style={{ width: "100%", maxWidth: 400, background: "#fff", borderRadius: 24, padding: "48px 44px", border: "0.5px solid rgba(0,0,0,0.06)" }}
        >
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div style={{ background: "#1D2B1F", borderRadius: 10, padding: 6 }}>
              <OrchardMark size={22} />
            </div>
            <span style={{ fontSize: 20, fontWeight: 600, color: "#1D2B1F" }}>Orchard</span>
          </div>

          <div style={{ fontSize: 22, fontWeight: 600, color: "#1D2B1F", letterSpacing: "-0.3px", marginBottom: 6 }}>
            Welcome back
          </div>
          <div style={{ fontSize: 13.5, color: "#7A8878", marginBottom: 32 }}>
            Sign in to your Orchard workspace
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Email */}
            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 500, color: "#4A5E4C", marginBottom: 6 }}>
                Work email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@company.com"
                style={{ width: "100%", padding: "11px 14px", fontSize: 14, fontFamily: "inherit", border: "0.5px solid rgba(0,0,0,0.14)", borderRadius: 10, outline: "none", color: "#1D2B1F", background: "#fff", transition: "border-color 0.15s, box-shadow 0.15s" }}
                onFocus={e => { e.target.style.borderColor = "#6DC88A"; e.target.style.boxShadow = "0 0 0 3px rgba(109,200,138,0.12)"; }}
                onBlur={e => { e.target.style.borderColor = "rgba(0,0,0,0.14)"; e.target.style.boxShadow = "none"; }}
              />
            </div>

            {/* Password */}
            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 500, color: "#4A5E4C", marginBottom: 6 }}>
                Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  style={{ width: "100%", padding: "11px 40px 11px 14px", fontSize: 14, fontFamily: "inherit", border: "0.5px solid rgba(0,0,0,0.14)", borderRadius: 10, outline: "none", color: "#1D2B1F", background: "#fff", transition: "border-color 0.15s, box-shadow 0.15s" }}
                  onFocus={e => { e.target.style.borderColor = "#6DC88A"; e.target.style.boxShadow = "0 0 0 3px rgba(109,200,138,0.12)"; }}
                  onBlur={e => { e.target.style.borderColor = "rgba(0,0,0,0.14)"; e.target.style.boxShadow = "none"; }}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#7A8878", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Forgot */}
            <div style={{ textAlign: "right", marginTop: -8 }}>
              <a href="#" style={{ fontSize: 12, color: "#3BAF64", textDecoration: "none" }}>Forgot password?</a>
            </div>

            {/* Error */}
            {error && (
              <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "10px 14px" }}>
                <p style={{ fontSize: 13, color: "#EF4444" }}>{error}</p>
              </div>
            )}

            {/* Remember */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setRemember(v => !v)}
                style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, background: remember ? "#1D2B1F" : "transparent", border: remember ? "1px solid #1D2B1F" : "1px solid rgba(0,0,0,0.2)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
              >
                {remember && (
                  <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                    <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
              <span style={{ fontSize: 13, color: "#7A8878" }}>
                Remember me <span style={{ fontSize: 11, color: "#9BAA99" }}>({remember ? "7 days" : "24 hours"})</span>
              </span>
            </div>

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={loading}
              whileTap={{ scale: 0.98 }}
              style={{ width: "100%", padding: 12, background: loading ? "#2E4432" : "#1D2B1F", color: "#fff", fontSize: 14, fontWeight: 500, fontFamily: "inherit", border: "none", borderRadius: 12, cursor: loading ? "default" : "pointer", transition: "background 0.15s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4 }}
              onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = "#2E4432"; }}
              onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = "#1D2B1F"; }}
            >
              {loading ? <><Loader2 size={16} className="animate-spin" /> Signing in…</> : "Sign in"}
            </motion.button>
          </form>

          <div style={{ textAlign: "center", fontSize: 12, color: "#9BAA99", marginTop: 20 }}>
            Don&apos;t have an account?{" "}
            <Link href="/register" style={{ color: "#3BAF64", textDecoration: "none", fontWeight: 500 }}>Register now</Link>
          </div>
        </motion.div>
      </div>
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
