"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { motion } from "motion/react";
import { Loader2, Eye, EyeOff } from "lucide-react";

// ── Orchard logo mark (same as login page) ────────────────────────────────────

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

// ── Register Form ─────────────────────────────────────────────────────────────

export default function RegisterPage() {
  const router = useRouter();

  const [agencyName,       setAgencyName]       = useState("");
  const [fullName,         setFullName]         = useState("");
  const [email,            setEmail]            = useState("");
  const [password,         setPassword]         = useState("");
  const [confirmPassword,  setConfirmPassword]  = useState("");
  const [showPwd,          setShowPwd]          = useState(false);
  const [showConfirm,      setShowConfirm]      = useState(false);
  const [loading,          setLoading]          = useState(false);
  const [error,            setError]            = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agencyName, name: fullName, email, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Registration failed.");
        return;
      }

      // Auto sign-in after registration
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (result?.error) {
        // Registration succeeded but auto-login failed — send to login
        router.push("/login");
      } else {
        router.push("/");
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (focused: boolean): React.CSSProperties => ({
    width: "100%",
    padding: "11px 14px",
    fontSize: 14,
    fontFamily: "inherit",
    border: `0.5px solid ${focused ? "#6DC88A" : "rgba(0,0,0,0.14)"}`,
    borderRadius: 10,
    outline: "none",
    color: "#1D2B1F",
    background: "#fff",
    boxShadow: focused ? "0 0 0 3px rgba(109,200,138,0.12)" : "none",
    transition: "border-color 0.15s, box-shadow 0.15s",
  });

  const [focusedField, setFocusedField] = useState<string | null>(null);

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

        {/* Tagline */}
        <div className="relative z-10" style={{ paddingBottom: 12 }}>
          <div style={{ fontFamily: "var(--font-dm-serif, serif)", fontSize: 34, color: "#fff", fontWeight: 400, lineHeight: 1.2, letterSpacing: "-0.5px", marginBottom: 16 }}>
            Cultivate your<br /><span style={{ color: "#6DC88A" }}>pipeline.</span>
          </div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.6, maxWidth: 280 }}>
            Set up your agency in minutes and start sourcing, tracking, and placing — all in one place.
          </div>
          <div style={{ display: "flex", gap: 32, marginTop: 40, paddingTop: 32, borderTop: "0.5px solid rgba(255,255,255,0.1)" }}>
            {[
              { value: "2 min",  label: "Setup time"      },
              { value: "Free",   label: "To get started"  },
              { value: "∞",      label: "Candidates"      },
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
            Create your account
          </div>
          <div style={{ fontSize: 13.5, color: "#7A8878", marginBottom: 32 }}>
            Set up your Orchard workspace in seconds
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Agency name */}
            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 500, color: "#4A5E4C", marginBottom: 6 }}>
                Agency name
              </label>
              <input
                type="text"
                value={agencyName}
                onChange={e => setAgencyName(e.target.value)}
                required
                placeholder="Acme Recruitment"
                style={inputStyle(focusedField === "agency")}
                onFocus={() => setFocusedField("agency")}
                onBlur={() => setFocusedField(null)}
              />
              <p style={{ fontSize: 11, color: "#9BAA99", marginTop: 4 }}>
                If your agency already exists, typing its exact name will join it.
              </p>
            </div>

            {/* Full name */}
            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 500, color: "#4A5E4C", marginBottom: 6 }}>
                Your full name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                required
                placeholder="Jane Smith"
                style={inputStyle(focusedField === "name")}
                onFocus={() => setFocusedField("name")}
                onBlur={() => setFocusedField(null)}
              />
            </div>

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
                placeholder="you@agency.com"
                style={inputStyle(focusedField === "email")}
                onFocus={() => setFocusedField("email")}
                onBlur={() => setFocusedField(null)}
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
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="Min. 8 characters"
                  style={{ ...inputStyle(focusedField === "pwd"), paddingRight: 40 }}
                  onFocus={() => setFocusedField("pwd")}
                  onBlur={() => setFocusedField(null)}
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

            {/* Confirm password */}
            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 500, color: "#4A5E4C", marginBottom: 6 }}>
                Confirm password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="••••••••"
                  style={{ ...inputStyle(focusedField === "confirm"), paddingRight: 40 }}
                  onFocus={() => setFocusedField("confirm")}
                  onBlur={() => setFocusedField(null)}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#7A8878", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "10px 14px" }}>
                <p style={{ fontSize: 13, color: "#EF4444" }}>{error}</p>
              </div>
            )}

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={loading}
              whileTap={{ scale: 0.98 }}
              style={{ width: "100%", padding: 12, background: loading ? "#2E4432" : "#1D2B1F", color: "#fff", fontSize: 14, fontWeight: 500, fontFamily: "inherit", border: "none", borderRadius: 12, cursor: loading ? "default" : "pointer", transition: "background 0.15s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4 }}
              onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = "#2E4432"; }}
              onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = "#1D2B1F"; }}
            >
              {loading ? <><Loader2 size={16} className="animate-spin" /> Creating account…</> : "Create account"}
            </motion.button>
          </form>

          <div style={{ textAlign: "center", fontSize: 12, color: "#9BAA99", marginTop: 24 }}>
            Already have an account?{" "}
            <a href="/login" style={{ color: "#3BAF64", textDecoration: "none", fontWeight: 500 }}>Sign in</a>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
