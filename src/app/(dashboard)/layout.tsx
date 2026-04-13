"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import Sidebar from "@/components/Sidebar";
import GlobalSearch from "@/components/GlobalSearch";
import { SidebarProvider, useSidebar } from "@/lib/sidebar-context";
import { initDb } from "@/lib/db";

const EXPANDED_W = 240;
const COLLAPSED_W = 64;
const SPRING = { duration: 0.22, ease: [0.4, 0, 0.2, 1] as const };

// Map pathname to readable page title
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
  const { collapsed } = useSidebar();
  const { data: session } = useSession();
  const w = collapsed ? COLLAPSED_W : EXPANDED_W;
  const pageTitle = usePageTitle();

  useEffect(() => {
    if (session?.user?.agencyId) {
      initDb(session.user.agencyId);
    }
  }, [session?.user?.agencyId]);

  return (
    <>
      <Sidebar />

      {/* Top bar */}
      <motion.header
        animate={{ left: w }}
        transition={SPRING}
        className="fixed top-0 right-0 h-14 z-30 flex items-center justify-between px-6"
        style={{
          background: "#F7F7F5",
          borderBottom: "1px solid rgba(45,74,45,0.08)",
        }}
      >
        {/* Page title */}
        <h1
          className="text-[22px] font-medium leading-none"
          style={{ color: "#2D4A2D" }}
        >
          {pageTitle}
        </h1>

        {/* Right side */}
        <GlobalSearch />
      </motion.header>

      {/* Main content */}
      <motion.main
        animate={{ marginLeft: w }}
        transition={SPRING}
        className="pt-14 min-h-screen"
        style={{ background: "#EDEDEB" }}
      >
        <div className="p-8">{children}</div>
      </motion.main>
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
