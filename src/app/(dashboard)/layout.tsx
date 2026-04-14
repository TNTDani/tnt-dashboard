"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import Sidebar from "@/components/Sidebar";
import GlobalSearch from "@/components/GlobalSearch";
import OfflineBanner from "@/components/OfflineBanner";
import InstallBanner from "@/components/InstallBanner";
import { SidebarProvider, useSidebar } from "@/lib/sidebar-context";
import { initDb } from "@/lib/db";
import { Menu, Search as SearchIcon, X } from "lucide-react";

const EXPANDED_W = 240;
const COLLAPSED_W = 64;
const SPRING = { duration: 0.22, ease: [0.4, 0, 0.2, 1] as const };

function usePageTitle() {
  const path = usePathname();
  const map: Record<string, string> = {
    "/": "Dashboard",
    "/calendar": "Calendar",
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
    "/sourcing": "Source Candidates",
    "/vacancy-monitor": "Vacancy Monitor",
    "/reports": "Reports",
  };
  if (map[path]) return map[path];
  const base = "/" + path.split("/")[1];
  return map[base] ?? "Orchard";
}

function LayoutInner({ children }: { children: React.ReactNode }) {
  const { collapsed, mobileOpen, setMobileOpen } = useSidebar();
  const { data: session } = useSession();
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [isMd, setIsMd] = useState(false);
  const desktopW = collapsed ? COLLAPSED_W : EXPANDED_W;
  const pageTitle = usePageTitle();

  useEffect(() => {
    if (session?.user?.agencyId) initDb(session.user.agencyId);
  }, [session?.user?.agencyId]);

  // Track if we're on desktop for sidebar offset
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
          background: "#F7F7F5",
          borderBottom: "1px solid rgba(45,74,45,0.08)",
        }}
      >
        <div className="flex items-center gap-3">
          {/* Hamburger — mobile only */}
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

          <h1 className="text-[18px] md:text-[22px] font-medium leading-none" style={{ color: "#2D4A2D" }}>
            {pageTitle}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Mobile search icon */}
          <button
            className="md:hidden p-1.5 rounded-lg transition-colors active:bg-[rgba(45,74,45,0.08)]"
            style={{ color: "#6B7280" }}
            onClick={() => setMobileSearchOpen((v) => !v)}
            aria-label="Search"
          >
            <SearchIcon size={18} />
          </button>
          {/* Desktop search */}
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
            style={{ background: "#F7F7F5", borderBottom: "1px solid rgba(45,74,45,0.08)" }}
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
        style={{ background: "#EDEDEB" }}
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
      <LayoutInner>{children}</LayoutInner>
    </SidebarProvider>
  );
}
