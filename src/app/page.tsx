"use client";

import { useEffect, useState } from "react";
import { storage } from "@/lib/storage";
import { Candidate, Vacancy } from "@/lib/types";
import { Users, Briefcase, TrendingUp, CheckCircle, FileText, Zap } from "lucide-react";
import Link from "next/link";

const STATUS_COLORS: Record<string, string> = {
  sourced: "bg-[#94a3b8]",
  screened: "bg-[#3b82f6]",
  shortlisted: "bg-[#f59e0b]",
  interviewed: "bg-[#7C3AED]",
  placed: "bg-[#10b981]",
};

export default function Dashboard() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);

  useEffect(() => {
    setCandidates(storage.getCandidates());
    setVacancies(storage.getVacancies());
  }, []);

  const placed = candidates.filter(c => c.status === "placed").length;
  const openVacancies = vacancies.filter(v => v.status === "open").length;
  const activeInPipeline = candidates.filter(c => c.status !== "placed").length;

  const stats = [
    { label: "Total Candidates", value: candidates.length, icon: Users, color: "text-[#7C3AED]", bg: "bg-[#7C3AED20]" },
    { label: "Open Vacancies", value: openVacancies, icon: Briefcase, color: "text-[#3b82f6]", bg: "bg-[#3b82f620]" },
    { label: "Active in Pipeline", value: activeInPipeline, icon: TrendingUp, color: "text-[#f59e0b]", bg: "bg-[#f59e0b20]" },
    { label: "Placements Made", value: placed, icon: CheckCircle, color: "text-[#10b981]", bg: "bg-[#10b98120]" },
  ];

  const recentCandidates = [...candidates]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-[#94a3b8] mt-1">True North Talent — Internal Overview</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[#94a3b8] text-sm">{s.label}</span>
              <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center`}>
                <s.icon size={16} className={s.color} />
              </div>
            </div>
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Recent Candidates */}
        <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold">Recent Candidates</h2>
            <Link href="/pipeline" className="text-[#7C3AED] text-sm hover:text-[#6d28d9]">View all →</Link>
          </div>
          {recentCandidates.length === 0 ? (
            <div className="text-center py-8">
              <Users size={32} className="text-[#1e3a5f] mx-auto mb-2" />
              <p className="text-[#94a3b8] text-sm">No candidates yet</p>
              <Link href="/cv-processor" className="text-[#7C3AED] text-sm mt-1 inline-block">Process your first CV →</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentCandidates.map((c) => {
                const vacancy = vacancies.find(v => v.id === c.vacancyId);
                return (
                  <div key={c.id} className="flex items-center justify-between py-2 border-b border-[#1e3a5f] last:border-0">
                    <div>
                      <p className="text-white text-sm font-medium">{c.firstName}</p>
                      <p className="text-[#94a3b8] text-xs">{c.currentRole}{vacancy ? ` · ${vacancy.title}` : ""}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full text-white uppercase ${STATUS_COLORS[c.status]}`}>
                      {c.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl p-5">
          <h2 className="text-white font-semibold mb-4">Quick Actions</h2>
          <div className="space-y-3">
            {[
              { href: "/cv-processor", icon: FileText, label: "Process a CV", sub: "Upload and reformat with AI", color: "text-[#7C3AED]", bg: "bg-[#7C3AED20]" },
              { href: "/screening", icon: Zap, label: "Screen a Candidate", sub: "Score against a vacancy", color: "text-[#f59e0b]", bg: "bg-[#f59e0b20]" },
              { href: "/vacancies", icon: Briefcase, label: "Add a Vacancy", sub: "Post a new open role", color: "text-[#3b82f6]", bg: "bg-[#3b82f620]" },
              { href: "/pipeline", icon: Users, label: "View Pipeline", sub: "Track all candidates", color: "text-[#10b981]", bg: "bg-[#10b98120]" },
            ].map((a) => (
              <Link key={a.href} href={a.href}
                className="flex items-center gap-3 p-3 rounded-lg border border-[#1e3a5f] hover:border-[#7C3AED] hover:bg-[#7C3AED08] transition-all duration-200 group">
                <div className={`w-8 h-8 rounded-lg ${a.bg} flex items-center justify-center flex-shrink-0`}>
                  <a.icon size={16} className={a.color} />
                </div>
                <div>
                  <p className="text-white text-sm font-medium group-hover:text-[#7C3AED] transition-colors">{a.label}</p>
                  <p className="text-[#94a3b8] text-xs">{a.sub}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
