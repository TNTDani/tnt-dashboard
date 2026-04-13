"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { db } from "@/lib/db";
import { CandidateProfile, Vacancy, Client } from "@/lib/types";
import { Search, UserCircle, Briefcase, Building2, X, Command } from "lucide-react";

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

export default function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [highlighted, setHighlighted] = useState(0);
  const [allData, setAllData] = useState<{
    candidates: CandidateProfile[];
    vacancies: Vacancy[];
    clients: Client[];
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    if (allData) return;
    const [candidates, vacancies, clients] = await Promise.all([
      db.getCandidateProfiles(),
      db.getVacancies(),
      db.getClients(),
    ]);
    setAllData({ candidates, vacancies, clients });
  }, [allData]);

  // Cmd+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        if (!open) loadData();
      }
      if (e.key === "Escape") setOpen(false);
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

    allData.clients
      .filter((c) => `${c.companyName} ${c.contactName} ${c.sector}`.toLowerCase().includes(q))
      .slice(0, 3)
      .forEach((c) =>
        out.push({
          type: "client",
          id: c.id,
          name: c.companyName,
          sub: c.contactName,
          href: `/clients/${c.id}`,
        })
      );

    setResults(out);
    setHighlighted(0);
  }, [query, allData]);

  const navigate = useCallback(
    (href: string) => {
      router.push(href);
      setOpen(false);
    },
    [router]
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

  return (
    <>
      {/* Trigger button */}
      <motion.button
        whileHover={{ borderColor: "rgba(45,74,45,0.3)" }}
        whileTap={{ scale: 0.98 }}
        onClick={() => {
          setOpen(true);
          loadData();
        }}
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-[#6B7280] hover:text-[#2D4A2D] text-sm transition-colors w-64"
        style={{
          background: "#FFFFFF",
          border: "1px solid rgba(45,74,45,0.15)",
        }}
      >
        <Search size={14} className="text-[#3D6B3D] flex-shrink-0" />
        <span className="flex-1 text-left">Search everything...</span>
        <span
          className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded font-mono"
          style={{
            background: "#EDEDEB",
            border: "1px solid rgba(45,74,45,0.15)",
            color: "#6B7280",
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
                    className="py-6 px-4"
                  >
                    <p className="text-[#6B7280] text-[10px] uppercase tracking-widest font-semibold mb-3">
                      Search across
                    </p>
                    <div className="flex gap-4">
                      {(["candidate", "vacancy", "client"] as const).map((t) => {
                        const Icon = ICON[t];
                        return (
                          <div key={t} className={`flex items-center gap-1.5 text-xs ${TYPE_COLOR[t]}`}>
                            <Icon size={12} />
                            <span className="text-[#6B7280]">{TYPE_LABEL[t]}s</span>
                          </div>
                        );
                      })}
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
