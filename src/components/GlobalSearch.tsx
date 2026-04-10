"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
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

  // Load data lazily when search opens
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
        setOpen(o => !o);
        if (!open) loadData();
      }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, loadData]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setResults([]);
      setHighlighted(0);
    }
  }, [open]);

  // Filter
  useEffect(() => {
    if (!allData || !query.trim()) { setResults([]); return; }
    const q = query.toLowerCase();
    const out: Result[] = [];

    allData.candidates
      .filter(c => `${c.firstName} ${c.lastName} ${c.jobTitle} ${c.branch}`.toLowerCase().includes(q))
      .slice(0, 4)
      .forEach(c => out.push({
        type: "candidate",
        id: c.id,
        name: `${c.firstName} ${c.lastName}`,
        sub: c.jobTitle || c.branch,
        href: `/candidates/${c.id}`,
      }));

    allData.vacancies
      .filter(v => `${v.title} ${v.company}`.toLowerCase().includes(q))
      .slice(0, 4)
      .forEach(v => out.push({
        type: "vacancy",
        id: v.id,
        name: v.title,
        sub: v.company,
        href: "/vacancies",
      }));

    allData.clients
      .filter(c => `${c.companyName} ${c.contactName} ${c.sector}`.toLowerCase().includes(q))
      .slice(0, 4)
      .forEach(c => out.push({
        type: "client",
        id: c.id,
        name: c.companyName,
        sub: c.contactName,
        href: `/clients/${c.id}`,
      }));

    setResults(out);
    setHighlighted(0);
  }, [query, allData]);

  const navigate = useCallback((href: string) => {
    router.push(href);
    setOpen(false);
  }, [router]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlighted(h => Math.min(h + 1, results.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)); }
    if (e.key === "Enter" && results[highlighted]) navigate(results[highlighted].href);
  };

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
    candidate: "text-[#7C3AED]",
    vacancy: "text-[#3b82f6]",
    client: "text-[#10b981]",
  };

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); loadData(); }}
        className="flex items-center gap-2 bg-[#112244] border border-[#1e3a5f] hover:border-[#2a4a7f] rounded-lg px-3 py-2 text-[#4a6fa5] hover:text-[#94a3b8] text-sm transition-all w-64"
      >
        <Search size={14} />
        <span className="flex-1 text-left">Search everything...</span>
        <span className="flex items-center gap-0.5 text-[10px] text-[#1e3a5f] bg-[#0d1f3c] border border-[#1e3a5f] px-1.5 py-0.5 rounded">
          <Command size={9} />K
        </span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-24 px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />

      {/* Panel */}
      <div className="relative w-full max-w-xl bg-[#0d1f3c] border border-[#1e3a5f] rounded-2xl shadow-2xl overflow-hidden">
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#1e3a5f]">
          <Search size={16} className="text-[#7C3AED] flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search candidates, vacancies, clients..."
            className="flex-1 bg-transparent text-white placeholder-[#4a6080] text-sm focus:outline-none"
          />
          <button onClick={() => setOpen(false)} className="text-[#4a6080] hover:text-white transition-colors">
            <X size={14} />
          </button>
        </div>

        {/* Results */}
        {results.length > 0 ? (
          <div className="max-h-96 overflow-y-auto py-2">
            {results.map((r, i) => {
              const Icon = ICON[r.type];
              return (
                <button
                  key={`${r.type}-${r.id}`}
                  onClick={() => navigate(r.href)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    i === highlighted ? "bg-[#1e3a5f]" : "hover:bg-[#112244]"
                  }`}
                >
                  <div className="w-7 h-7 rounded-lg bg-[#112244] flex items-center justify-center flex-shrink-0">
                    <Icon size={13} className={TYPE_COLOR[r.type]} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-sm font-medium truncate">{r.name}</p>
                    <p className="text-[#4a6080] text-xs truncate">{r.sub}</p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#112244] ${TYPE_COLOR[r.type]} flex-shrink-0`}>
                    {TYPE_LABEL[r.type]}
                  </span>
                </button>
              );
            })}
          </div>
        ) : query.trim() ? (
          <div className="py-10 text-center">
            <p className="text-[#4a6080] text-sm">No results for &ldquo;{query}&rdquo;</p>
          </div>
        ) : (
          <div className="py-6 px-4">
            <p className="text-[#4a6080] text-xs uppercase tracking-widest font-semibold mb-3">Search across</p>
            <div className="flex gap-3">
              {(["candidate", "vacancy", "client"] as const).map(t => {
                const Icon = ICON[t];
                return (
                  <div key={t} className="flex items-center gap-2 text-[#94a3b8] text-xs">
                    <Icon size={12} className={TYPE_COLOR[t]} />
                    {TYPE_LABEL[t]}s
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {results.length > 0 && (
          <div className="px-4 py-2 border-t border-[#1e3a5f] flex items-center gap-3 text-[10px] text-[#4a6080]">
            <span>↑↓ navigate</span>
            <span>↵ open</span>
            <span>esc close</span>
          </div>
        )}
      </div>
    </div>
  );
}
