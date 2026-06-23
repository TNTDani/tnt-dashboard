"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { RecentItem } from "@/lib/types";
import { useSidebar } from "@/lib/sidebar-context";
import { signOut, useSession } from "next-auth/react";
import { OrchardLogo } from "@/components/OrchardLogo";
import {
  LayoutDashboard, FileText, Users, Briefcase, UserCircle,
  Building2, Calculator, Mail, ListChecks, Trophy, Inbox,
  BarChart2, LogOut, Radar, Clock, CalendarDays, ChevronLeft,
  Zap, ChevronDown, Shield, Target, CreditCard,
} from "lucide-react";

// ── Nav groups — workflow-oriented ────────────────────────────────────────────

const NAV_GROUPS = [
  {
    key: "pipeline",
    label: "Pipeline",
    items: [
      { href: "/", icon: LayoutDashboard, label: "Dashboard", exact: true },
      { href: "/today", icon: Clock, label: "Today", exact: true },
      { href: "/pipeline", icon: Users, label: "Pipeline", exact: true },
      { href: "/calendar", icon: CalendarDays, label: "Agenda", exact: true },
    ],
  },
  {
    key: "people",
    label: "People",
    items: [
      { href: "/candidates", icon: UserCircle, label: "Candidates", exact: false },
      { href: "/accounts", icon: Target, label: "Accounts", exact: false },
      { href: "/vacancies", icon: Briefcase, label: "Vacancies", exact: true },
    ],
  },
  {
    key: "outreach",
    label: "Outreach",
    items: [
      { href: "/email", icon: Mail, label: "Email", exact: false, badgeKey: "followUps" as const },
      { href: "/shortlist", icon: ListChecks, label: "Shortlist", exact: true },
      { href: "/placements", icon: Trophy, label: "Placements", exact: true },
    ],
  },
  {
    key: "intelligence",
    label: "Intelligence",
    collapsible: true,
    items: [
      { href: "/cv-processor", icon: FileText, label: "CV Processor", exact: true },
      { href: "/sourcing", icon: Zap, label: "Sourcing", exact: true },
      { href: "/reports", icon: BarChart2, label: "Reports", exact: false },
      { href: "/vacancy-monitor", icon: Radar, label: "Vacancy Monitor", exact: true },
      { href: "/fee-calculator", icon: Calculator, label: "Fee Calculator", exact: false },
      { href: "/tickets", icon: Inbox, label: "Tickets", exact: false },
      { href: "/credits", icon: CreditCard, label: "Credits", exact: true },
    ],
  },
];

type NavItem = {
  href: string;
  icon: React.ElementType;
  label: string;
  exact: boolean;
  badgeKey?: "followUps";
};

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}


// ── NavLink ────────────────────────────────────────────────────────────────────

interface NavLinkProps {
  href: string;
  icon: React.ElementType;
  label: string;
  exact: boolean;
  badge?: number;
  collapsed: boolean;
  onNavigate?: () => void;
}

function NavLink({ href, icon: Icon, label, exact, badge, collapsed, onNavigate }: NavLinkProps) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(href + "/");

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`relative group flex items-center transition-colors duration-150 rounded-lg
        ${collapsed ? "justify-center h-10 w-10 mx-auto" : "gap-3 px-3 py-2 w-full"}
      `}
      style={{
        color: active ? "#2D4A2D" : "#5a6a60",
        background: active ? "rgba(45,74,45,0.06)" : undefined,
      }}
      onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLAnchorElement).style.background = "rgba(20,33,26,0.04)"; }}
      onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLAnchorElement).style.background = ""; }}
    >
      {active && !collapsed && (
        <motion.div
          layoutId="sidebar-active-border"
          className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full"
          style={{ background: "#2D4A2D" }}
          transition={{ type: "spring", stiffness: 500, damping: 40 }}
        />
      )}
      <Icon size={15} className="relative z-10 flex-shrink-0" />
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.span
            key="label"
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="flex-1 text-sm truncate relative z-10"
            style={{ fontWeight: active ? 500 : 400 }}
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {!collapsed && badge !== undefined && badge > 0 && (
          <motion.span
            key="badge"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            className="relative z-10 min-w-[18px] h-[18px] px-1 rounded-full bg-[#EF4444] text-white text-[10px] font-bold flex items-center justify-center"
          >
            {badge > 99 ? "99+" : badge}
          </motion.span>
        )}
      </AnimatePresence>
      {collapsed && badge !== undefined && badge > 0 && (
        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#EF4444]" />
      )}
      {collapsed && (
        <span
          className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap bg-white opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-[200]"
          style={{ color: "#2D4A2D", boxShadow: "0 2px 8px rgba(0,0,0,0.1)", border: "1px solid rgba(20,33,26,0.08)" }}
        >
          {label}
          {badge !== undefined && badge > 0 && <span className="ml-1.5 text-[#EF4444] font-bold">{badge}</span>}
        </span>
      )}
    </Link>
  );
}

// ── NavGroup ──────────────────────────────────────────────────────────────────

function NavGroup({
  group,
  followUpCount,
  collapsed,
  onNavigate,
  defaultOpen = true,
}: {
  group: typeof NAV_GROUPS[number];
  followUpCount: number;
  collapsed: boolean;
  onNavigate?: () => void;
  defaultOpen?: boolean;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(defaultOpen);

  // Auto-open if an item in this group is active
  const hasActive = group.items.some(item =>
    item.exact ? path === item.href : path === item.href || path.startsWith(item.href + "/")
  );
  useEffect(() => { if (hasActive) setOpen(true); }, [hasActive]);

  const canCollapse = group.collapsible && !collapsed;

  return (
    <div className="mb-3">
      {/* Group label */}
      <AnimatePresence initial={false}>
        {!collapsed ? (
          <motion.div
            key="label"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className={`flex items-center justify-between px-3 mb-1 ${canCollapse ? "cursor-pointer" : ""}`}
            onClick={canCollapse ? () => setOpen(v => !v) : undefined}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "#8a9a90" }}>
              {group.label}
            </p>
            {canCollapse && (
              <motion.div animate={{ rotate: open ? 0 : -90 }} transition={{ duration: 0.15 }}>
                <ChevronDown size={10} style={{ color: "#8a9a90" }} />
              </motion.div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="divider"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mx-3 mb-1.5 h-px"
            style={{ background: "rgba(20,33,26,0.08)" }}
          />
        )}
      </AnimatePresence>

      {/* Items */}
      <AnimatePresence initial={false}>
        {(open || collapsed || hasActive) && (
          <motion.div
            key="items"
            initial={canCollapse ? { opacity: 0, height: 0 } : false}
            animate={{ opacity: 1, height: "auto" }}
            exit={canCollapse ? { opacity: 0, height: 0 } : undefined}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden space-y-0.5"
          >
            {group.items.map(item => (
              <NavLink
                key={item.href}
                href={item.href}
                icon={item.icon}
                label={item.label}
                exact={item.exact}
                badge={"badgeKey" in item && item.badgeKey === "followUps" ? followUpCount : undefined}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Today strip ───────────────────────────────────────────────────────────────

function TodayItem({ followUpCount, collapsed, onNavigate }: { followUpCount: number; collapsed: boolean; onNavigate?: () => void }) {
  const path = usePathname();
  const active = path === "/email";

  if (followUpCount === 0) return null;

  return (
    <AnimatePresence initial={false}>
      {!collapsed && (
        <motion.div
          key="today"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className="px-3 mb-4"
        >
          <Link
            href="/email"
            onClick={onNavigate}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all group"
            style={{
              background: "rgba(239,68,68,0.06)",
              border: "1px solid rgba(239,68,68,0.12)",
              color: "#dc2626",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(239,68,68,0.10)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(239,68,68,0.06)"; }}
          >
            <motion.span
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="w-1.5 h-1.5 rounded-full bg-[#EF4444] flex-shrink-0"
            />
            <span className="flex-1 truncate">
              {followUpCount} follow-up{followUpCount !== 1 ? "s" : ""} due
            </span>
            <span style={{ color: "rgba(220,38,38,0.5)" }}>→</span>
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── SidebarContent ─────────────────────────────────────────────────────────────

const RECENT_ICON: Record<RecentItem["type"], React.ElementType> = {
  candidate: UserCircle, vacancy: Briefcase, client: Building2,
};

function SidebarContent({
  collapsed,
  toggle,
  onNavigate,
}: {
  collapsed: boolean;
  toggle: () => void;
  onNavigate?: () => void;
}) {
  const { data: session } = useSession();
  const [followUpCount, setFollowUpCount] = useState(0);
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);

  useEffect(() => {
    setRecentItems(storage.getRecentItems().slice(0, 4));
  }, []);

  useEffect(() => {
    if (!session) return;
    fetch('/api/credits/balance')
      .then((r) => r.json())
      .then((d) => setCreditBalance(d.balance ?? 0))
      .catch(() => {});
  }, [session]);

  useEffect(() => {
    const recalc = () => {
      db.getFollowUps().then((followUps) => {
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        const due = followUps.filter((f) => {
          if (f.status === "done") return false;
          const d = f.status === "snoozed" && f.snoozedUntil ? f.snoozedUntil : f.dueDate;
          return new Date(d) <= today;
        });
        setFollowUpCount(due.length);
      });
    };
    recalc();
    const interval = setInterval(recalc, 30_000);
    return () => clearInterval(interval);
  }, []);

  const userName = session?.user?.name || session?.user?.email || "User";
  const transition = { duration: 0.22, ease: [0.4, 0, 0.2, 1] as const };

  return (
    <div className="flex flex-col h-full" style={{ background: "#ffffff" }}>
      {/* Logo */}
      <div className="flex items-center h-14 px-4 flex-shrink-0" style={{ borderBottom: "1px solid rgba(20,33,26,0.07)" }}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-shrink-0">
            <OrchardLogo size={28} />
          </div>
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.div key="wordmark" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.15 }} className="min-w-0">
                <p className="text-lg leading-none tracking-tight" style={{ fontFamily: "var(--font-nunito), Nunito, sans-serif", fontWeight: 700, color: "#0f1711" }}>
                  Orchard
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto overflow-x-hidden">
        {/* Today alert */}
        <TodayItem followUpCount={followUpCount} collapsed={collapsed} onNavigate={onNavigate} />

        {/* Nav groups */}
        <div className={collapsed ? "px-2" : "px-3"}>
          {NAV_GROUPS.map((group, i) => (
            <NavGroup
              key={group.key}
              group={group}
              followUpCount={followUpCount}
              collapsed={collapsed}
              onNavigate={onNavigate}
              defaultOpen={group.key !== "intelligence"}
            />
          ))}
        </div>

        {/* Workspace group — owners and admins only */}
        {(session?.user?.role === "owner" || session?.user?.role === "admin") && (
          <div className={collapsed ? "px-2 mt-1" : "px-3 mt-1"}>
            <div className="mb-3">
              <AnimatePresence initial={false}>
                {!collapsed ? (
                  <motion.p
                    key="workspace-label"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="text-[10px] font-semibold uppercase tracking-[0.12em] px-3 mb-1"
                    style={{ color: "#8a9a90" }}
                  >
                    Workspace
                  </motion.p>
                ) : (
                  <motion.div
                    key="workspace-divider"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="mx-3 mb-1.5 h-px"
                    style={{ background: "rgba(20,33,26,0.08)" }}
                  />
                )}
              </AnimatePresence>
              <NavLink
                href="/team"
                icon={Shield}
                label="Team"
                exact={true}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            </div>
          </div>
        )}

        {/* Recent items */}
        <AnimatePresence initial={false}>
          {!collapsed && recentItems.length > 0 && (
            <motion.div
              key="recent"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="px-3 mt-1"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] px-3 mb-1.5" style={{ color: "#8a9a90" }}>
                Recent
              </p>
              <div className="space-y-0.5">
                {recentItems.map((item) => {
                  const Icon = RECENT_ICON[item.type];
                  return (
                    <Link
                      key={`${item.type}-${item.id}`}
                      href={item.href}
                      onClick={onNavigate}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all group"
                      style={{ color: "#8a9a90" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(20,33,26,0.04)"; (e.currentTarget as HTMLAnchorElement).style.color = "#2D4A2D"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = ""; (e.currentTarget as HTMLAnchorElement).style.color = "#8a9a90"; }}
                    >
                      <Icon size={12} className="flex-shrink-0" />
                      <span className="truncate flex-1">{item.name}</span>
                      <Clock size={10} className="opacity-0 group-hover:opacity-40 flex-shrink-0 transition-opacity" />
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Footer */}
      <div className="flex-shrink-0 p-3 space-y-1" style={{ borderTop: "1px solid rgba(20,33,26,0.07)" }}>
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div key="user" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="flex items-center gap-2.5 px-3 py-2 mb-1">
              <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold" style={{ background: "rgba(45,74,45,0.12)", color: "#2D4A2D" }}>
                {getInitials(userName)}
              </div>
              <span className="text-xs font-medium truncate" style={{ color: "#2a3a30" }}>{userName}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Collapse toggle */}
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={toggle}
          className={`hidden md:flex w-full items-center rounded-lg py-2 text-xs transition-colors ${collapsed ? "justify-center px-0" : "gap-3 px-3"}`}
          style={{ color: "#8a9a90" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(20,33,26,0.04)"; (e.currentTarget as HTMLButtonElement).style.color = "#2a3a30"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = ""; (e.currentTarget as HTMLButtonElement).style.color = "#8a9a90"; }}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <motion.div animate={{ rotate: collapsed ? 180 : 0 }} transition={transition} className="flex-shrink-0">
            <ChevronLeft size={15} />
          </motion.div>
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.span key="label" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="flex-1 text-left">
                Collapse
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>

        {/* Sign out */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => signOut({ callbackUrl: "/login" })}
          className={`w-full group flex items-center rounded-lg py-2 text-xs transition-colors ${collapsed ? "justify-center px-0" : "gap-3 px-3"}`}
          style={{ color: "#8a9a90" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#EF4444"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#8a9a90"; }}
          title="Sign out"
        >
          <LogOut size={14} className="flex-shrink-0" />
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.span key="label" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>Sign out</motion.span>
            )}
          </AnimatePresence>
          {collapsed && (
            <span className="pointer-events-none absolute left-full ml-3 px-2.5 py-1.5 rounded-lg text-xs text-[#EF4444] whitespace-nowrap bg-white opacity-0 group-hover:opacity-100 transition-opacity z-[200]" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08)", border: "1px solid rgba(239,68,68,0.15)" }}>
              Sign out
            </span>
          )}
        </motion.button>

        <AnimatePresence initial={false}>
          {!collapsed && creditBalance !== null && (
            <motion.div key="credits" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
              <Link
                href="/credits"
                className="flex items-center justify-between px-3 py-1.5 rounded-lg transition-colors"
                style={{ background: "rgba(45,74,45,0.05)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(45,74,45,0.10)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(45,74,45,0.05)"; }}
              >
                <span className="flex items-center gap-1.5 text-xs" style={{ color: "#5a6a60" }}>
                  <CreditCard size={11} />
                  Credits
                </span>
                <span className="text-xs font-semibold tabular-nums" style={{ color: "#2D4A2D" }}>
                  {creditBalance.toLocaleString()}
                </span>
              </Link>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.p key="version" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="text-[10px] tracking-widest uppercase px-3 pt-1" style={{ color: "#8a9a90" }}>
              Orchard · v3
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────

export default function Sidebar() {
  const { collapsed, toggle, mobileOpen, setMobileOpen } = useSidebar();

  const EXPANDED_W = 220;
  const COLLAPSED_W = 64;
  const transition = { duration: 0.22, ease: [0.4, 0, 0.2, 1] as const };

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <motion.aside
        animate={{ width: collapsed ? COLLAPSED_W : EXPANDED_W }}
        transition={transition}
        className="hidden md:flex fixed left-0 top-0 h-screen flex-col z-40 overflow-hidden"
        style={{ borderRight: "1px solid rgba(20,33,26,0.08)" }}
      >
        <SidebarContent collapsed={collapsed} toggle={toggle} />
      </motion.aside>

      {/* ── Mobile: backdrop + slide-in overlay ── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden fixed inset-0 z-40 bg-black/50"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              key="mobile-sidebar"
              initial={{ x: -EXPANDED_W }}
              animate={{ x: 0 }}
              exit={{ x: -EXPANDED_W }}
              transition={{ type: "spring", stiffness: 300, damping: 35 }}
              className="md:hidden fixed left-0 top-0 h-screen z-50 overflow-hidden"
              style={{ width: EXPANDED_W, borderRight: "1px solid rgba(20,33,26,0.08)" }}
            >
              <SidebarContent collapsed={false} toggle={toggle} onNavigate={() => setMobileOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
