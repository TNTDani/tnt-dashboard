"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Users,
  Briefcase,
  Zap,
  UserCircle,
  Building2,
  Calculator,
  Mail,
  ListChecks,
} from "lucide-react";

const RECRUITMENT_NAV = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard", exact: true },
  { href: "/candidates", icon: UserCircle, label: "Candidates", exact: false },
  { href: "/clients", icon: Building2, label: "Clients", exact: false },
  { href: "/email", icon: Mail, label: "Email", exact: false },
  { href: "/pipeline", icon: Users, label: "Pipeline", exact: true },
  { href: "/shortlist", icon: ListChecks, label: "Shortlist", exact: true },
  { href: "/vacancies", icon: Briefcase, label: "Vacancies", exact: true },
];

const TOOLS_NAV = [
  { href: "/cv-processor", icon: FileText, label: "CV Processor", exact: true },
  { href: "/screening", icon: Zap, label: "AI Screening", exact: true },
  { href: "/fee-calculator", icon: Calculator, label: "Fee Calculator", exact: false },
];

function NavItem({ href, icon: Icon, label, exact }: { href: string; icon: React.ElementType; label: string; exact: boolean }) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
        active
          ? "bg-[#7C3AED] text-white"
          : "text-[#94a3b8] hover:text-white hover:bg-[#1e3a5f]"
      }`}
    >
      <Icon size={16} />
      {label}
    </Link>
  );
}

export default function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-[#0d1f3c] border-r border-[#1e3a5f] flex flex-col z-40">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-[#1e3a5f]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-[#7C3AED] flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 34 34" fill="none">
              <circle cx="17" cy="17" r="15.5" stroke="white" strokeWidth="1.5" />
              <path d="M17 4 L19.5 17 L17 14.5 L14.5 17 Z" fill="white" />
            </svg>
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-none">True North</p>
            <p className="text-[#7C3AED] text-[10px] font-semibold tracking-widest uppercase">Talent</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {/* Recruitment section */}
        <p className="text-[#4a6fa5] text-[10px] font-semibold uppercase tracking-widest px-3 mb-2">Recruitment</p>
        <div className="space-y-0.5 mb-5">
          {RECRUITMENT_NAV.map(item => (
            <NavItem key={item.href} {...item} />
          ))}
        </div>

        {/* Tools section */}
        <p className="text-[#4a6fa5] text-[10px] font-semibold uppercase tracking-widest px-3 mb-2">Tools</p>
        <div className="space-y-0.5">
          {TOOLS_NAV.map(item => (
            <NavItem key={item.href} {...item} />
          ))}
        </div>
      </nav>

      <div className="px-4 py-4 border-t border-[#1e3a5f]">
        <p className="text-[#94a3b8] text-[10px] tracking-widest uppercase">Internal Tool</p>
        <p className="text-[#94a3b8] text-[10px] mt-0.5">v2.0 — Phase 2</p>
      </div>
    </aside>
  );
}
