"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import Sidebar from "@/components/Sidebar";
import GlobalSearch from "@/components/GlobalSearch";
import OfflineBanner from "@/components/OfflineBanner";
import InstallBanner from "@/components/InstallBanner";
import { SidebarProvider, useSidebar } from "@/lib/sidebar-context";
import { DialerProvider } from "@/lib/dialer-context";
import Dialer from "@/components/Dialer";
import { initDb } from "@/lib/db";
import {
  Menu, Search as SearchIcon, X, Plus, FileText, Zap,
  BarChart2, Mail, Users,
} from "lucide-react";

const EXPANDED_W = 220;
const COLLAPSED_W = 64;
const SPRING = { duration: 0.22, ease: [0.4, 0, 0.2, 1] as const };

// ── Contextual topbar actions per route ───────────────────────────────────────

type TopbarAction = {
  label: string;
  icon: React.ElementType;
  href?: string;
  shortcut?: string;
  primary?: boolean;
};

function useTopbarActions(): TopbarAction[] {
  const path = usePathname();
  if (path === "/candidates" || path.startsWith("/candidates/"))
    return [
      { label: "Add candidate", icon: Plus, href: "/candidates", primary: true },
      { label: "CV Processor", icon: FileText, href: "/cv-processor" },
      { label: "Source", icon: Zap, href: "/sourcing" },
    ];
  if (path === "/vacancies" || path.startsWith("/vacancies/"))
    return [
      { label: "New vacancy", icon: Plus, href: "/vacancies", primary: true },
      { label: "Monitor", icon: Zap, href: "/vacancy-monitor" },
    ];
  if (path === "/clients" || path.startsWith("/clients/"))
    return [
      { label: "New client", icon: Plus, href: "/clients", primary: true },
    ];
  if (path === "/pipeline")
    return [
      { label: "Pipeline", icon: Users, href: "/pipeline" },
    ];
  if (path === "/email" || path.startsWith("/email/"))
    return [
      { label: "Compose", icon: Mail, href: "/email", primary: true },
    ];
  if (path === "/reports")
    return [
      { label: "Reports", icon: BarChart2, href: "/reports" },
    ];
  return [];
}

function usePageTitle() {
  const path = usePathname();
  const map: Record<string, string> = {
    "/": "Dashboard",
    "/calendar": "Agenda",
    "/candidates": "Candidates",
    "/clients": "Clients",
    "/email": "Email",
    "/pipeline": "Pipeline",
    "/shortlist": "Shortlist",
    "/placements": "Placements",
    "/vacancies": "Vacancies",
    "/tickets": "Tickets",
    "/cv-processor": "CV Processor",
    "/screening": "AI Screening",
    "/fee-calculator": "Fee Calculator",
    "/sourcing": "Sourcing",
    "/vacancy-monitor": "Vacancy Monitor",
    "/reports": "Reports",
    "/team": "Team",
  };
  if (map[path]) return map[path];
  const base = "/" + path.split("/")[1];
  return map[base] ?? "Orchard";
}

// ── TopbarAction button ────────────────────────────────────────────────────────

function TopbarActionButton({ action, router }: { action: TopbarAction; router: ReturnType<typeof useRouter> }) {
  const Icon = action.icon;
  if (action.primary) {
    return (
      <motion.button
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => {
          if (action.href) {
            // Signal to the page to open its add modal via URL param
            router.push(action.href + "?add=1");
          }
        }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all"
        style={{ background: "#2D4A2D" }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#3D6B3D"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#2D4A2D"; }}
      >
        <Icon size={12} />
        <span className="hidden sm:inline">{action.label}</span>
      </motion.button>
    );
  }
  return (
    <motion.button
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.97 }}
      onClick={() => { if (action.href) router.push(action.href); }}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
      style={{
        color: "#5a6a60",
        background: "transparent",
        border: "1px solid rgba(20,33,26,0.10)",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.background = "rgba(20,33,26,0.04)";
        (e.currentTarget as HTMLButtonElement).style.color = "#2D4A2D";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.background = "transparent";
        (e.currentTarget as HTMLButtonElement).style.color = "#5a6a60";
      }}
    >
      <Icon size={12} />
      <span className="hidden sm:inline">{action.label}</span>
    </motion.button>
  );
}

// ── Layout inner ───────────────────────────────────────────────────────────────

function LayoutInner({ children }: { children: React.ReactNode }) {
  const { collapsed, mobileOpen, setMobileOpen } = useSidebar();
  const { data: session } = useSession();
  const router = useRouter();
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [isMd, setIsMd] = useState(false);
  const desktopW = collapsed ? COLLAPSED_W : EXPANDED_W;
  const pageTitle = usePageTitle();
  const topbarActions = useTopbarActions();

  useEffect(() => {
    if (session?.user?.agencyId) initDb(session.user.agencyId);
  }, [session?.user?.agencyId]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    setIsMd(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMd(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const sidebarOffset = isMd ? desktopW : 0;

  return (
    <>
      <OfflineBanner />
      <Sidebar />

      {/* ── Top bar ── */}
      <motion.header
        animate={{ left: sidebarOffset }}
        transition={SPRING}
        className="fixed top-0 right-0 z-30 flex items-center justify-between px-4 md:px-6"
        style={{
          height: 56,
          background: "#ffffff",
          borderBottom: "1px solid rgba(20,33,26,0.07)",
        }}
      >
        {/* Left: hamburger + title */}
        <div className="flex items-center gap-3">
          <button
            className="md:hidden p-1.5 -ml-1 rounded-lg transition-colors active:bg-[rgba(45,74,45,0.08)]"
            style={{ color: "#2D4A2D" }}
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle navigation"
          >
            <AnimatePresence mode="wait" initial={false}>
              {mobileOpen ? (
                <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.12 }}>
                  <X size={20} />
                </motion.span>
              ) : (
                <motion.span key="menu" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.12 }}>
                  <Menu size={20} />
                </motion.span>
              )}
            </AnimatePresence>
          </button>

          <h1 className="text-[18px] md:text-[20px] font-medium leading-none" style={{ color: "#0f1711" }}>
            {pageTitle}
          </h1>

          {/* Contextual quick actions — desktop */}
          <AnimatePresence mode="wait">
            {topbarActions.length > 0 && (
              <motion.div
                key={pageTitle}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.18 }}
                className="hidden md:flex items-center gap-1.5 ml-2"
              >
                {topbarActions.map(action => (
                  <TopbarActionButton key={action.label} action={action} router={router} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right: search */}
        <div className="flex items-center gap-2">
          <button
            className="md:hidden p-1.5 rounded-lg transition-colors active:bg-[rgba(45,74,45,0.08)]"
            style={{ color: "#6B7280" }}
            onClick={() => setMobileSearchOpen((v) => !v)}
            aria-label="Search"
          >
            <SearchIcon size={18} />
          </button>
          <div className="hidden md:block">
            <GlobalSearch />
          </div>
        </div>
      </motion.header>

      {/* Mobile search dropdown */}
      <AnimatePresence>
        {mobileSearchOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="md:hidden fixed top-14 left-0 right-0 z-30 px-3 py-2.5"
            style={{ background: "#ffffff", borderBottom: "1px solid rgba(20,33,26,0.07)" }}
          >
            <GlobalSearch autoFocus onClose={() => setMobileSearchOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main content ── */}
      <motion.main
        animate={{ marginLeft: sidebarOffset }}
        transition={SPRING}
        className="pt-14 min-h-screen"
        style={{ background: "#fafafa" }}
      >
        <div className="p-4 md:p-8">{children}</div>
      </motion.main>

      <InstallBanner />
    </>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <DialerProvider>
        <LayoutInner>{children}</LayoutInner>
        <Dialer />
      </DialerProvider>
    </SidebarProvider>
  );
}
