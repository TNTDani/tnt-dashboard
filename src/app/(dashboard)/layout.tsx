"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import Sidebar from "@/components/Sidebar";
import GlobalSearch from "@/components/GlobalSearch";
import { SidebarProvider, useSidebar } from "@/lib/sidebar-context";
import { initDb } from "@/lib/db";

const EXPANDED_W = 240;
const COLLAPSED_W = 64;
const SPRING = { duration: 0.22, ease: [0.4, 0, 0.2, 1] as const };

function LayoutInner({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();
  const { data: session } = useSession();
  const w = collapsed ? COLLAPSED_W : EXPANDED_W;

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
        className="fixed top-0 right-0 h-14 z-30 flex items-center px-6"
        style={{
          background: "rgba(13,27,42,0.85)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(124,58,237,0.12)",
        }}
      >
        <GlobalSearch />
      </motion.header>

      {/* Main content */}
      <motion.main
        animate={{ marginLeft: w }}
        transition={SPRING}
        className="pt-14 min-h-screen"
        style={{ background: "#0d1b2a" }}
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
