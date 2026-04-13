"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";

// ── Orchard SVG Icon ──────────────────────────────────────────────────────────

function OrchardIcon({ size = 40, color = "white" }: { size?: number; color?: string }) {
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

// ── Background node pattern (decorative, very low opacity) ─────────────────────

function NodePattern() {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: 0.06 }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id="nodes" x="0" y="0" width="80" height="60" patternUnits="userSpaceOnUse">
          <rect x="4"  y="3"  width="8" height="8" rx="2" fill="white" />
          <rect x="36" y="3"  width="8" height="8" rx="2" fill="white" />
          <rect x="68" y="3"  width="8" height="8" rx="2" fill="white" />
          <rect x="36" y="26" width="8" height="8" rx="2" fill="white" />
          <rect x="4"  y="49" width="8" height="8" rx="2" fill="white" />
          <rect x="36" y="49" width="8" height="8" rx="2" fill="white" />
          <rect x="68" y="49" width="8" height="8" rx="2" fill="white" />
          <line x1="8" y1="11" x2="40" y2="26" stroke="white" strokeWidth="1" />
          <line x1="40" y1="11" x2="40" y2="26" stroke="white" strokeWidth="1" />
          <line x1="72" y1="11" x2="40" y2="26" stroke="white" strokeWidth="1" />
          <line x1="40" y1="34" x2="8" y2="49" stroke="white" strokeWidth="1" />
          <line x1="40" y1="34" x2="40" y2="49" stroke="white" strokeWidth="1" />
          <line x1="40" y1="34" x2="72" y2="49" stroke="white" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#nodes)" />
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
    <div className="min-h-screen flex">
      {/* ── Left panel: green brand side ── */}
      <div
        className="hidden lg:flex lg:w-1/2 relative flex-col items-center justify-center p-16 overflow-hidden"
        style={{ background: "#2D4A2D" }}
      >
        <NodePattern />
        <div className="relative z-10 flex flex-col items-center text-center">
          <OrchardIcon size={56} color="white" />
          <p
            className="text-white mt-5 text-4xl tracking-tight leading-none"
            style={{ fontFamily: "var(--font-nunito), Nunito, sans-serif", fontWeight: 700 }}
          >
            Orchard
          </p>
          <p className="mt-4 text-lg" style={{ color: "rgba(255,255,255,0.6)" }}>
            Cultivate your pipeline.
          </p>
        </div>
      </div>

      {/* ── Right panel: white form side ── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-white px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
          className="w-full max-w-sm"
        >
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <OrchardIcon size={28} color="#2D4A2D" />
            <p
              className="text-[#2D4A2D] text-2xl leading-none"
              style={{ fontFamily: "var(--font-nunito), Nunito, sans-serif", fontWeight: 700 }}
            >
              Orchard
            </p>
          </div>

          <h2 className="text-[22px] font-medium mb-1" style={{ color: "#2D4A2D" }}>
            Welcome back
          </h2>
          <p className="text-sm mb-8" style={{ color: "#6B7280" }}>
            Sign in to your account to continue
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-[0.08em] mb-1.5" style={{ color: "#6B7280" }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@orchard.io"
                className="w-full rounded-md px-3 py-2.5 text-sm bg-white transition-colors focus:outline-none"
                style={{
                  border: "1px solid rgba(45,74,45,0.2)",
                  color: "#2D4A2D",
                }}
                onFocus={e => { (e.target as HTMLInputElement).style.borderColor = "#2D4A2D"; }}
                onBlur={e => { (e.target as HTMLInputElement).style.borderColor = "rgba(45,74,45,0.2)"; }}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-[0.08em] mb-1.5" style={{ color: "#6B7280" }}>
                Password
              </label>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full rounded-md pl-3 pr-10 py-2.5 text-sm bg-white transition-colors focus:outline-none"
                  style={{
                    border: "1px solid rgba(45,74,45,0.2)",
                    color: "#2D4A2D",
                  }}
                  onFocus={e => { (e.target as HTMLInputElement).style.borderColor = "#2D4A2D"; }}
                  onBlur={e => { (e.target as HTMLInputElement).style.borderColor = "rgba(45,74,45,0.2)"; }}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: "#6B7280" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#2D4A2D"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#6B7280"; }}
                >
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Remember me */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setRemember(v => !v)}
                className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors"
                style={{
                  background: remember ? "#2D4A2D" : "transparent",
                  border: remember ? "1px solid #2D4A2D" : "1px solid rgba(45,74,45,0.3)",
                }}
              >
                {remember && (
                  <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                    <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
              <span className="text-sm" style={{ color: "#6B7280" }}>
                Remember me
                <span className="ml-1 text-xs" style={{ color: "#9CA3AF" }}>
                  ({remember ? "7 days" : "24 hours"})
                </span>
              </span>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-md px-3 py-2.5" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
                <p className="text-sm text-[#EF4444]">{error}</p>
              </div>
            )}

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={loading}
              whileTap={{ scale: 0.98 }}
              className="w-full text-white font-semibold py-2.5 rounded-md text-sm transition-colors flex items-center justify-center gap-2 mt-1"
              style={{ background: loading ? "#3D6B3D" : "#2D4A2D" }}
              onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = "#3D6B3D"; }}
              onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = "#2D4A2D"; }}
            >
              {loading ? (
                <><Loader2 size={16} className="animate-spin" /> Signing in…</>
              ) : (
                "Sign in"
              )}
            </motion.button>
          </form>

          <p className="text-center text-xs mt-8" style={{ color: "#9CA3AF" }}>
            Orchard · Internal use only
          </p>
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
