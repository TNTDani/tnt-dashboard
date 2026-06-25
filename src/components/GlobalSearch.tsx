"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { db } from "@/lib/db";
import { accountsDb } from "@/lib/accountsDb";
import { CandidateProfile, Vacancy } from "@/lib/types";
import type { Account } from "@/lib/accountTypes";
import { Search, UserCircle, Briefcase, Building2, X, Command, Plus, Mail, Sparkles, Radar } from "lucide-react";

interface Result {
  type: "candidate" | "vacancy" | "client";
  id: string;
  name: string;
  sub: string;
  href: string;
}

const ICON: Record<Result["type"], React.ElementType> = {
  candidate: UserCircle,
  vacancy: Briefcase,
  client: Building2,
};

const TYPE_LABEL: Record<Result["type"], string> = {
  candidate: "Candidate",
  vacancy: "Vacancy",
  client: "Client",
};

const TYPE_COLOR: Record<Result["type"], string> = {
  candidate: "text-[#3D6B3D]",
  vacancy: "text-blue-400",
  client: "text-[#4CAF50]",
};

const TYPE_BG: Record<Result["type"], string> = {
  candidate: "bg-[rgba(45,74,45,0.15)]",
  vacancy: "bg-blue-500/10",
  client: "bg-[#4CAF50]/10",
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

interface GlobalSearchProps {
  autoFocus?: boolean;
  onClose?: () => void;
}

const QUICK_ACTIONS = [
  { label: "New candidate",       icon: Plus,       href: "/candidates?new=1",      shortcut: "C" },
  { label: "New vacancy",         icon: Plus,       href: "/vacancies?new=1",        shortcut: "V" },
  { label: "Send email",          icon: Mail,       href: "/email",                  shortcut: "E" },
  { label: "Run AI screening",    icon: Sparkles,   href: "/screening",              shortcut: "S" },
  { label: "Source candidates",   icon: Sparkles,   href: "/sourcing",               shortcut: "A" },
  { label: "Vacancy monitor",     icon: Radar,      href: "/vacancy-monitor",        shortcut: "M" },
];

export default function GlobalSearch({ autoFocus = false, onClose }: GlobalSearchProps = {}) {
  const router = useRouter();
  const [open, setOpen] = useState(autoFocus);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [highlighted, setHighlighted] = useState(0);
  const [allData, setAllData] = useState<{
    candidates: CandidateProfile[];
    vacancies: Vacancy[];
    accounts: Account[];
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    if (allData) return;
    const [candidates, vacancies, accounts] = await Promise.all([
      db.getCandidateProfiles(),
      db.getVacancies(),
      accountsDb.getAccounts(),
    ]);
    setAllData({ candidates, vacancies, accounts });
  }, [allData]);

  // Cmd+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        if (!open) loadData();
      }
      if (e.key === "Escape") { setOpen(false); onClose?.(); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, loadData]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 60);
      setQuery("");
      setResults([]);
      setHighlighted(0);
    }
  }, [open]);

  // Filter
  useEffect(() => {
    if (!allData || !query.trim()) {
      setResults([]);
      return;
    }
    const q = query.toLowerCase();
    const out: Result[] = [];

    allData.candidates
      .filter((c) => `${c.firstName} ${c.lastName} ${c.jobTitle} ${c.branch}`.toLowerCase().includes(q))
      .slice(0, 4)
      .forEach((c) =>
        out.push({
          type: "candidate",
          id: c.id,
          name: `${c.firstName} ${c.lastName}`,
          sub: c.jobTitle || c.branch,
          href: `/candidates/${c.id}`,
        })
      );

    allData.vacancies
      .filter((v) => `${v.title} ${v.company}`.toLowerCase().includes(q))
      .slice(0, 3)
      .forEach((v) =>
        out.push({ type: "vacancy", id: v.id, name: v.title, sub: v.company, href: "/vacancies" })
      );

    allData.accounts
      .filter((a) => `${a.companyName} ${a.sector ?? ''}`.toLowerCase().includes(q))
      .slice(0, 3)
      .forEach((a) =>
        out.push({
          type: "client",
          id: a.id,
          name: a.companyName,
          sub: a.sector ?? '',
          href: `/accounts/${a.id}`,
        })
      );

    setResults(out);
    setHighlighted(0);
  }, [query, allData]);

  const navigate = useCallback(
    (href: string) => {
      router.push(href);
      setOpen(false);
      onClose?.();
    },
    [router, onClose]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, results.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    }
    if (e.key === "Enter" && results[highlighted]) navigate(results[highlighted].href);
  };

  // When used inline on mobile (autoFocus), render a bare input instead of a trigger button
  if (autoFocus) {
    return (
      <div className="flex items-center gap-2 rounded-lg px-3 py-2 w-full" style={{ background: "#FFFFFF", border: "1px solid rgba(45,74,45,0.2)" }}>
        <Search size={14} className="text-[#3D6B3D] flex-shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); loadData(); }}
          onKeyDown={handleKeyDown}
          placeholder="Search candidates, vacancies, clients..."
          className="flex-1 bg-transparent text-[#2D4A2D] placeholder-[#6B7280] text-sm focus:outline-none"
          autoFocus
        />
        {results.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-50" style={{ background: "#FFFFFF", border: "1px solid rgba(45,74,45,0.15)", boxShadow: "0 4px 16px rgba(0,0,0,0.1)" }}>
            {results.map((r, i) => {
              const Icon = ICON[r.type];
              return (
                <button key={`${r.type}-${r.id}`} onClick={() => navigate(r.href)} className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors" style={{ background: i === highlighted ? "rgba(45,74,45,0.06)" : undefined }}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${TYPE_BG[r.type]} ${TYPE_COLOR[r.type]}`}>
                    {r.type === "candidate" ? getInitials(r.name) : <Icon size={12} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[#2D4A2D] text-sm font-medium truncate">{r.name}</p>
                    <p className="text-[#6B7280] text-xs truncate">{r.sub}</p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${TYPE_BG[r.type]} ${TYPE_COLOR[r.type]}`}>{TYPE_LABEL[r.type]}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {/* Trigger button */}
      <motion.button
        whileHover={{ borderColor: "rgba(20,33,26,0.2)" }}
        whileTap={{ scale: 0.98 }}
        onClick={() => {
          setOpen(true);
          loadData();
        }}
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors w-64"
        style={{
          background: "#fafafa",
          border: "1px solid rgba(20,33,26,0.1)",
          color: "#8a9a90",
        }}
      >
        <Search size={13} style={{ color: "#5a6a60", flexShrink: 0 }} />
        <span className="flex-1 text-left text-[13px]">Search or jump to…</span>
        <span
          className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded font-mono"
          style={{
            background: "#ffffff",
            border: "1px solid rgba(20,33,26,0.1)",
            color: "#8a9a90",
          }}
        >
          <Command size={9} />K
        </span>
      </motion.button>

      {/* Modal */}
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[300] flex items-start justify-center pt-20 px-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, y: -12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
              className="relative w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl shadow-black/60"
              style={{
                background: "#FFFFFF",
                border: "1px solid rgba(45,74,45,0.2)",
              }}
            >
              {/* Input */}
              <div
                className="flex items-center gap-3 px-4 py-3.5"
                style={{ borderBottom: "1px solid rgba(45,74,45,0.12)" }}
              >
                <Search size={16} className="text-[#2D4A2D] flex-shrink-0" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search candidates, vacancies, clients..."
                  className="flex-1 bg-transparent text-[#2D4A2D] placeholder-[#6B7280] text-sm focus:outline-none"
                />
                <button
                  onClick={() => setOpen(false)}
                  className="text-[#6B7280] hover:text-[#2D4A2D] transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Results */}
              <AnimatePresence mode="wait">
                {results.length > 0 ? (
                  <motion.div
                    key="results"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="max-h-96 overflow-y-auto py-2"
                  >
                    {results.map((r, i) => {
                      const Icon = ICON[r.type];
                      const isHighlighted = i === highlighted;
                      return (
                        <motion.button
                          key={`${r.type}-${r.id}`}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.04 }}
                          onClick={() => navigate(r.href)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                          style={{
                            background: isHighlighted ? "rgba(45,74,45,0.1)" : undefined,
                          }}
                          onMouseEnter={() => setHighlighted(i)}
                        >
                          {/* Avatar circle */}
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${TYPE_BG[r.type]} ${TYPE_COLOR[r.type]}`}
                          >
                            {r.type === "candidate" ? (
                              getInitials(r.name)
                            ) : (
                              <Icon size={13} />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[#2D4A2D] text-sm font-medium truncate">{r.name}</p>
                            <p className="text-[#6B7280] text-xs truncate">{r.sub}</p>
                          </div>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${TYPE_BG[r.type]} ${TYPE_COLOR[r.type]}`}
                          >
                            {TYPE_LABEL[r.type]}
                          </span>
                        </motion.button>
                      );
                    })}
                  </motion.div>
                ) : query.trim() ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="py-12 text-center"
                  >
                    <p className="text-[#6B7280] text-sm">No results for &ldquo;{query}&rdquo;</p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="hint"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="py-3 px-2"
                  >
                    <p className="text-[#8a9a90] text-[10px] uppercase tracking-[1.2px] font-semibold px-2 mb-2">
                      Quick actions
                    </p>
                    <div className="space-y-0.5">
                      {QUICK_ACTIONS.map((action, i) => {
                        const Icon = action.icon;
                        return (
                          <motion.button
                            key={action.label}
                            initial={{ opacity: 0, x: -6 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.03 }}
                            onClick={() => navigate(action.href)}
                            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors"
                            style={{ color: "#2a3a30" }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(45,74,45,0.06)"; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = ""; }}
                          >
                            <div style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(45,74,45,0.07)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <Icon size={13} color="#2D4A2D" />
                            </div>
                            <span className="flex-1 text-sm">{action.label}</span>
                            <span style={{ fontSize: 10, color: "#8a9a90", background: "rgba(20,33,26,0.05)", border: "1px solid rgba(20,33,26,0.1)", borderRadius: 4, padding: "1px 5px", fontFamily: "monospace" }}>
                              {action.shortcut}
                            </span>
                          </motion.button>
                        );
                      })}
                    </div>
                    <div style={{ borderTop: "1px solid rgba(20,33,26,0.07)", margin: "10px 8px 0", paddingTop: 10 }}>
                      <p className="text-[#8a9a90] text-[10px] uppercase tracking-[1.2px] font-semibold mb-2">
                        Search
                      </p>
                      <div className="flex gap-4 px-1">
                        {(["candidate", "vacancy", "client"] as const).map((t) => {
                          const Icon = ICON[t];
                          return (
                            <div key={t} className={`flex items-center gap-1.5 text-xs ${TYPE_COLOR[t]}`}>
                              <Icon size={11} />
                              <span className="text-[#8a9a90]">{TYPE_LABEL[t]}s</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Keyboard hint */}
              {results.length > 0 && (
                <div
                  className="px-4 py-2 flex items-center gap-4 text-[10px] text-[#6B7280]"
                  style={{ borderTop: "1px solid rgba(45,74,45,0.12)" }}
                >
                  <span>↑↓ navigate</span>
                  <span>↵ open</span>
                  <span>esc close</span>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
