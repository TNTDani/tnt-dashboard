"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Lock, Mail, Eye, EyeOff } from "lucide-react";

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl  = searchParams.get("callbackUrl") || "/";

  const [email,      setEmail]      = useState("");
  const [password,   setPassword]   = useState("");
  const [remember,   setRemember]   = useState(false);
  const [showPwd,    setShowPwd]    = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      email,
      password,
      remember: String(remember),
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password.");
    } else {
      router.push(callbackUrl);
    }
  };

  return (
    <div className="min-h-screen bg-[#060e1d] flex items-center justify-center px-4">
      {/* Background subtle pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-[#7C3AED] opacity-[0.04] blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-[#3b82f6] opacity-[0.03] blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo card */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#7C3AED] mb-5">
            <svg width="28" height="28" viewBox="0 0 34 34" fill="none">
              <circle cx="17" cy="17" r="15.5" stroke="white" strokeWidth="1.5" />
              <path d="M17 4 L19.5 17 L17 14.5 L14.5 17 Z" fill="white" />
            </svg>
          </div>
          <h1 className="text-white text-2xl font-bold tracking-tight">TrueNorth Talent</h1>
          <p className="text-[#4a6fa5] text-sm mt-1">Internal Recruitment Dashboard</p>
        </div>

        {/* Form card */}
        <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-2xl p-8">
          <h2 className="text-white font-semibold text-lg mb-6">Sign in</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-[#94a3b8] text-xs font-medium mb-1.5 uppercase tracking-wider">
                Email
              </label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a6fa5]" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg pl-9 pr-3 py-2.5 text-white text-sm placeholder-[#4a6080] focus:outline-none focus:border-[#7C3AED] transition-colors"
                  placeholder="dani@truenorthtalent.nl"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-[#94a3b8] text-xs font-medium mb-1.5 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a6fa5]" />
                <input
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg pl-9 pr-10 py-2.5 text-white text-sm placeholder-[#4a6080] focus:outline-none focus:border-[#7C3AED] transition-colors"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4a6fa5] hover:text-[#94a3b8] transition-colors"
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
                className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                  remember
                    ? "bg-[#7C3AED] border-[#7C3AED]"
                    : "bg-transparent border-[#1e3a5f] hover:border-[#4a6fa5]"
                }`}
              >
                {remember && (
                  <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                    <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
              <span className="text-[#94a3b8] text-sm">
                Remember me
                <span className="text-[#4a6fa5] ml-1">
                  ({remember ? "7 days" : "24 hours"})
                </span>
              </span>
            </div>

            {/* Error message */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#7C3AED] hover:bg-[#6d28d9] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <><Loader2 size={16} className="animate-spin" /> Signing in…</>
              ) : (
                "Sign in"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-[#2a4f7a] text-xs mt-6">
          TrueNorth Talent · Internal use only
        </p>
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
