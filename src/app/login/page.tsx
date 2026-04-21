"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";

// ── Orchard logo mark ─────────────────────────────────────────────────────────

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
    <div className="min-h-screen flex" style={{ fontFamily: "var(--font-inter), Inter, system-ui, sans-serif" }}>

      {/* ── Left panel — 50% moss ── */}
      <div
        className="hidden lg:flex lg:w-1/2 relative flex-col flex-shrink-0 overflow-hidden"
        style={{ background: "#2D4A2D", padding: "52px 56px" }}
      >
        {/* Subtle dot pattern */}
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

        {/* Tagline block */}
        <div className="relative z-10" style={{ paddingBottom: 16 }}>
          <div style={{ fontSize: 28, fontWeight: 400, color: "#fff", lineHeight: 1.25, marginBottom: 12 }}>
            Cultivate your pipeline.
          </div>
          <div style={{ fontSize: 14, fontWeight: 400, color: "rgba(255,255,255,0.65)", lineHeight: 1.6, maxWidth: 320 }}>
            The recruitment OS for boutique agencies.
          </div>
        </div>

        {/* Bottom copyright */}
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

          <div style={{ fontSize: 24, fontWeight: 500, color: "#0f1711", letterSpacing: "-0.3px", marginBottom: 6 }}>
            Welcome back
          </div>
          <div style={{ fontSize: 13.5, color: "#5a6a60", marginBottom: 32 }}>
            Sign in to your workspace
          </div>

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
                style={{ width: "100%", padding: "10px 14px", fontSize: 14, fontFamily: "inherit", border: "1px solid rgba(20,33,26,0.12)", borderRadius: 8, outline: "none", color: "#0f1711", background: "#fff", transition: "border-color 0.15s, box-shadow 0.15s" }}
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
                  style={{ width: "100%", padding: "10px 40px 10px 14px", fontSize: 14, fontFamily: "inherit", border: "1px solid rgba(20,33,26,0.12)", borderRadius: 8, outline: "none", color: "#0f1711", background: "#fff", transition: "border-color 0.15s, box-shadow 0.15s" }}
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

            {/* Remember */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setRemember(v => !v)}
                style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, background: remember ? "#2D4A2D" : "transparent", border: remember ? "1px solid #2D4A2D" : "1px solid rgba(20,33,26,0.2)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
              >
                {remember && (
                  <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                    <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
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
              style={{ width: "100%", padding: "11px 16px", background: loading ? "#3D6B3D" : "#2D4A2D", color: "#fff", fontSize: 14, fontWeight: 500, fontFamily: "inherit", border: "none", borderRadius: 8, cursor: loading ? "default" : "pointer", transition: "background 0.15s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = "#3D6B3D"; }}
              onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = "#2D4A2D"; }}
            >
              {loading ? <><Loader2 size={15} className="animate-spin" /> Signing in…</> : "Sign in"}
            </motion.button>
          </form>

          <div style={{ textAlign: "center", fontSize: 12.5, color: "#8a9a90", marginTop: 24 }}>
            Don&apos;t have an account?{" "}
            <Link href="/register" style={{ color: "#2D4A2D", textDecoration: "none", fontWeight: 500 }}>Register now →</Link>
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
