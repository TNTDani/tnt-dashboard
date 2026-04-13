"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Building2, User, Mail, Lock, Eye, EyeOff, Loader2 } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();

  const [agencyName, setAgencyName] = useState("");
  const [name,       setName]       = useState("");
  const [email,      setEmail]      = useState("");
  const [password,   setPassword]   = useState("");
  const [showPwd,    setShowPwd]    = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const [success,    setSuccess]    = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agencyName, name, email, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Registration failed.");
        return;
      }
      setSuccess(true);
      setTimeout(() => router.push("/login"), 1500);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  };

  const INP =
    "w-full bg-[#0d1b2a] border border-[rgba(124,58,237,0.2)] rounded-lg px-4 py-2.5 pl-10 text-[#F5F5F5] text-sm placeholder-[#4B5563] focus:outline-none focus:border-[#7C3AED] transition-colors";

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "#0d1b2a" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{
              background: "linear-gradient(135deg, #A855F7 0%, #7C3AED 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            TNT Dashboard
          </h1>
          <p className="text-[#4B5563] text-sm mt-1">Create your agency account</p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8"
          style={{
            background: "#111e2d",
            border: "1px solid rgba(124,58,237,0.15)",
          }}
        >
          {success ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-6"
            >
              <p className="text-[#10B981] font-semibold text-lg">Account created!</p>
              <p className="text-[#4B5563] text-sm mt-1">Redirecting to login…</p>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Agency name */}
              <div>
                <label className="block text-[#A0A0A0] text-xs font-medium mb-1.5">
                  Agency name
                </label>
                <div className="relative">
                  <Building2
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4B5563]"
                  />
                  <input
                    type="text"
                    value={agencyName}
                    onChange={(e) => setAgencyName(e.target.value)}
                    placeholder="TrueNorth Talent"
                    className={INP}
                    required
                  />
                </div>
                <p className="text-[#4B5563] text-[11px] mt-1">
                  If your agency already exists, typing its exact name will join it.
                </p>
              </div>

              {/* Your name */}
              <div>
                <label className="block text-[#A0A0A0] text-xs font-medium mb-1.5">
                  Your name
                </label>
                <div className="relative">
                  <User
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4B5563]"
                  />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Dani"
                    className={INP}
                    required
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-[#A0A0A0] text-xs font-medium mb-1.5">
                  Email
                </label>
                <div className="relative">
                  <Mail
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4B5563]"
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@agency.com"
                    className={INP}
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-[#A0A0A0] text-xs font-medium mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4B5563]"
                  />
                  <input
                    type={showPwd ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    className={INP + " pr-10"}
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4B5563] hover:text-[#A0A0A0]"
                  >
                    {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-red-400 text-sm bg-red-500/10 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <motion.button
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg text-white text-sm font-semibold flex items-center justify-center gap-2 mt-2"
                style={{ background: "linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)" }}
              >
                {loading ? <Loader2 size={15} className="animate-spin" /> : null}
                {loading ? "Creating account…" : "Create account"}
              </motion.button>

              <p className="text-center text-[#4B5563] text-xs">
                Already have an account?{" "}
                <a href="/login" className="text-[#A855F7] hover:underline">
                  Sign in
                </a>
              </p>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}
