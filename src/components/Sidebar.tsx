"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { RecentItem } from "@/lib/types";
import { useSidebar } from "@/lib/sidebar-context";
import { signOut, useSession } from "next-auth/react";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  LayoutDashboard, FileText, Users, Briefcase, UserCircle,
  Building2, Calculator, Mail, ListChecks, Trophy, Inbox, Search,
  BarChart2, LogOut, Radar, GripVertical, Clock, CalendarDays, ChevronLeft,
} from "lucide-react";

const RECRUITMENT_NAV = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard", exact: true },
  { href: "/calendar", icon: CalendarDays, label: "Calendar", exact: true },
  { href: "/candidates", icon: UserCircle, label: "Candidates", exact: false },
  { href: "/clients", icon: Building2, label: "Clients", exact: false },
  { href: "/email", icon: Mail, label: "Email", exact: false, badgeKey: "followUps" as const },
  { href: "/pipeline", icon: Users, label: "Pipeline", exact: true },
  { href: "/shortlist", icon: ListChecks, label: "Shortlist", exact: true },
  { href: "/placements", icon: Trophy, label: "Placements", exact: true },
  { href: "/vacancies", icon: Briefcase, label: "Vacancies", exact: true },
  { href: "/tickets", icon: Inbox, label: "Tickets", exact: false },
];

const TOOLS_NAV = [
  { href: "/cv-processor", icon: FileText, label: "CV Processor", exact: true },
  { href: "/fee-calculator", icon: Calculator, label: "Fee Calculator", exact: false },
  { href: "/sourcing", icon: Search, label: "Source Candidates", exact: true },
  { href: "/vacancy-monitor", icon: Radar, label: "Vacancy Monitor", exact: true },
  { href: "/reports", icon: BarChart2, label: "Reports", exact: false },
];

const LS_KEY_RECRUITMENT = "tnt_sidebar_recruitment_order";
const LS_KEY_TOOLS = "tnt_sidebar_tools_order";
type NavItem = (typeof RECRUITMENT_NAV)[number];

function reorder<T extends { href: string }>(items: T[], savedOrder: string[]): T[] {
  if (!savedOrder.length) return items;
  return [...items].sort((a, b) => {
    const ai = savedOrder.indexOf(a.href);
    const bi = savedOrder.indexOf(b.href);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

export function OrchardIcon({ size = 28, color = "white" }: { size?: number; color?: string }) {
  const w = Math.round((size / 36) * 48);
  return (
    <svg width={w} height={size} viewBox="0 0 48 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3"  y="2"  width="8" height="8" rx="2" fill={color} />
      <rect x="20" y="2"  width="8" height="8" rx="2" fill={color} />
      <rect x="37" y="2"  width="8" height="8" rx="2" fill={color} />
      <rect x="20" y="14" width="8" height="8" rx="2" fill={color} />
      <rect x="3"  y="26" width="8" height="8" rx="2" fill={color} />
      <rect x="20" y="26" width="8" height="8" rx="2" fill={color} />
      <rect x="37" y="26" width="8" height="8" rx="2" fill={color} />
      <line x1="7"  y1="10" x2="24" y2="14" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="24" y1="10" x2="24" y2="14" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="41" y1="10" x2="24" y2="14" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="24" y1="22" x2="7"  y2="26" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="24" y1="22" x2="24" y2="26" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="24" y1="22" x2="41" y2="26" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

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
        ${collapsed ? "justify-center h-10 w-10 mx-auto" : "gap-3 px-3 py-2.5 w-full"}
      `}
      style={{
        color: active ? "#FFFFFF" : "rgba(255,255,255,0.65)",
        background: active ? "rgba(255,255,255,0.15)" : undefined,
      }}
      onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.08)"; }}
      onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLAnchorElement).style.background = ""; }}
    >
      {active && !collapsed && (
        <motion.div
          layoutId="sidebar-active-border"
          className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full"
          style={{ background: "#6DC88A" }}
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
            className="flex-1 text-sm font-medium truncate relative z-10"
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
          className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#2D4A2D] whitespace-nowrap bg-white opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-[200]"
          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.12)", border: "1px solid rgba(45,74,45,0.12)" }}
        >
          {label}
          {badge !== undefined && badge > 0 && <span className="ml-1.5 text-[#EF4444] font-bold">{badge}</span>}
        </span>
      )}
    </Link>
  );
}

function SortableNavItem({ item, badge, collapsed, onNavigate }: { item: NavItem; badge?: number; collapsed: boolean; onNavigate?: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.href });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1, position: "relative" as const, zIndex: isDragging ? 10 : undefined };
  return (
    <div ref={setNodeRef} style={style} className="group flex items-center gap-1">
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.button
            key="handle"
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 16 }}
            exit={{ opacity: 0, width: 0 }}
            className="flex-shrink-0 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity"
            style={{ color: "rgba(255,255,255,0.3)" }}
            {...attributes}
            {...listeners}
            tabIndex={-1}
          >
            <GripVertical size={12} />
          </motion.button>
        )}
      </AnimatePresence>
      <div className="flex-1 min-w-0">
        <NavLink href={item.href} icon={item.icon} label={item.label} exact={item.exact} badge={badge} collapsed={collapsed} onNavigate={onNavigate} />
      </div>
    </div>
  );
}

function SectionLabel({ label, collapsed }: { label: string; collapsed: boolean }) {
  return (
    <AnimatePresence initial={false}>
      {!collapsed ? (
        <motion.p key="label" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="text-[10px] font-semibold uppercase tracking-[0.1em] px-3 mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>
          {label}
        </motion.p>
      ) : (
        <motion.div key="divider" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mx-3 mb-1.5 h-px" style={{ background: "rgba(255,255,255,0.12)" }} />
      )}
    </AnimatePresence>
  );
}

const RECENT_ICON: Record<RecentItem["type"], React.ElementType> = {
  candidate: UserCircle, vacancy: Briefcase, client: Building2,
};

// ── SidebarContent — used for both desktop and mobile overlay ─────────────────

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
  const [recruitmentItems, setRecruitmentItems] = useState<NavItem[]>(RECRUITMENT_NAV);
  const [toolsItems, setToolsItems] = useState<NavItem[]>(TOOLS_NAV);
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);

  useEffect(() => {
    try {
      const r = localStorage.getItem(LS_KEY_RECRUITMENT);
      if (r) setRecruitmentItems(reorder(RECRUITMENT_NAV, JSON.parse(r)));
    } catch {}
    try {
      const t = localStorage.getItem(LS_KEY_TOOLS);
      if (t) setToolsItems(reorder(TOOLS_NAV, JSON.parse(t)));
    } catch {}
    setRecentItems(storage.getRecentItems().slice(0, 5));
  }, []);

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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleRecruitmentDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oi = recruitmentItems.findIndex((i) => i.href === active.id);
    const ni = recruitmentItems.findIndex((i) => i.href === over.id);
    const updated = arrayMove(recruitmentItems, oi, ni);
    setRecruitmentItems(updated);
    localStorage.setItem(LS_KEY_RECRUITMENT, JSON.stringify(updated.map((i) => i.href)));
  };

  const handleToolsDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oi = toolsItems.findIndex((i) => i.href === active.id);
    const ni = toolsItems.findIndex((i) => i.href === over.id);
    const updated = arrayMove(toolsItems, oi, ni);
    setToolsItems(updated);
    localStorage.setItem(LS_KEY_TOOLS, JSON.stringify(updated.map((i) => i.href)));
  };

  const userName = session?.user?.name || session?.user?.email || "User";
  const transition = { duration: 0.22, ease: [0.4, 0, 0.2, 1] as const };

  return (
    <div className="flex flex-col h-full" style={{ background: "#1D2B1F" }}>
      {/* Logo */}
      <div className="flex items-center h-14 px-4 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-shrink-0">
            <OrchardIcon size={28} color="white" />
          </div>
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.div key="wordmark" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.15 }} className="min-w-0">
                <p className="text-white text-lg leading-none tracking-tight" style={{ fontFamily: "var(--font-nunito), Nunito, sans-serif", fontWeight: 700 }}>
                  Orchard
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto overflow-x-hidden">
        <div className={`${collapsed ? "px-2" : "px-3"} space-y-0.5 mb-5`}>
          <SectionLabel label="Recruitment" collapsed={collapsed} />
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleRecruitmentDragEnd}>
            <SortableContext items={recruitmentItems.map((i) => i.href)} strategy={verticalListSortingStrategy}>
              {recruitmentItems.map((item) => (
                <SortableNavItem key={item.href} item={item} badge={item.badgeKey === "followUps" ? followUpCount : undefined} collapsed={collapsed} onNavigate={onNavigate} />
              ))}
            </SortableContext>
          </DndContext>
        </div>

        <AnimatePresence initial={false}>
          {!collapsed && recentItems.length > 0 && (
            <motion.div key="recent" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="px-3 mb-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] px-3 mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>Recent</p>
              <div className="space-y-0.5">
                {recentItems.map((item) => {
                  const Icon = RECENT_ICON[item.type];
                  return (
                    <Link key={`${item.type}-${item.id}`} href={item.href} onClick={onNavigate} className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all group" style={{ color: "rgba(255,255,255,0.5)" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLAnchorElement).style.color = "white"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = ""; (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.5)"; }}
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

        <div className={`${collapsed ? "px-2" : "px-3"} space-y-0.5`}>
          <SectionLabel label="Tools" collapsed={collapsed} />
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleToolsDragEnd}>
            <SortableContext items={toolsItems.map((i) => i.href)} strategy={verticalListSortingStrategy}>
              {toolsItems.map((item) => (
                <SortableNavItem key={item.href} item={item} collapsed={collapsed} onNavigate={onNavigate} />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      </nav>

      {/* Footer */}
      <div className="flex-shrink-0 p-3 space-y-1" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div key="user" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="flex items-center gap-2.5 px-3 py-2 mb-1">
              <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-white" style={{ background: "rgba(255,255,255,0.2)" }}>
                {getInitials(userName)}
              </div>
              <span className="text-xs font-medium truncate" style={{ color: "rgba(255,255,255,0.8)" }}>{userName}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Collapse toggle — desktop only */}
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={toggle}
          className={`hidden md:flex w-full items-center rounded-lg py-2.5 text-xs transition-colors ${collapsed ? "justify-center px-0" : "gap-3 px-3"}`}
          style={{ color: "rgba(255,255,255,0.5)" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLButtonElement).style.color = "white"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = ""; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.5)"; }}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <motion.div animate={{ rotate: collapsed ? 180 : 0 }} transition={transition} className="flex-shrink-0">
            <ChevronLeft size={15} />
          </motion.div>
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.span key="label" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="flex-1 text-left font-medium">
                Collapse
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>

        {/* Sign out */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => signOut({ callbackUrl: "/login" })}
          className={`w-full group flex items-center rounded-lg py-2.5 text-xs transition-colors ${collapsed ? "justify-center px-0" : "gap-3 px-3"}`}
          style={{ color: "rgba(255,255,255,0.5)" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#EF4444"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.5)"; }}
          title="Sign out"
        >
          <LogOut size={14} className="flex-shrink-0" />
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.span key="label" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>Sign out</motion.span>
            )}
          </AnimatePresence>
          {collapsed && (
            <span className="pointer-events-none absolute left-full ml-3 px-2.5 py-1.5 rounded-lg text-xs text-[#EF4444] whitespace-nowrap bg-white opacity-0 group-hover:opacity-100 transition-opacity z-[200]" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.12)", border: "1px solid rgba(239,68,68,0.15)" }}>
              Sign out
            </span>
          )}
        </motion.button>

        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.p key="version" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="text-[10px] tracking-widest uppercase px-3 pt-1" style={{ color: "rgba(255,255,255,0.25)" }}>
              Orchard · v2.0
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

  const EXPANDED_W = 240;
  const COLLAPSED_W = 64;
  const transition = { duration: 0.22, ease: [0.4, 0, 0.2, 1] as const };

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <motion.aside
        animate={{ width: collapsed ? COLLAPSED_W : EXPANDED_W }}
        transition={transition}
        className="hidden md:flex fixed left-0 top-0 h-screen flex-col z-40 overflow-hidden"
        style={{ borderRight: "1px solid rgba(0,0,0,0.08)" }}
      >
        <SidebarContent collapsed={collapsed} toggle={toggle} />
      </motion.aside>

      {/* ── Mobile: backdrop + slide-in overlay ── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden fixed inset-0 z-40 bg-black/50"
              onClick={() => setMobileOpen(false)}
            />

            {/* Slide-in panel */}
            <motion.aside
              key="mobile-sidebar"
              initial={{ x: -EXPANDED_W }}
              animate={{ x: 0 }}
              exit={{ x: -EXPANDED_W }}
              transition={{ type: "spring", stiffness: 300, damping: 35 }}
              className="md:hidden fixed left-0 top-0 h-screen z-50 overflow-hidden"
              style={{ width: EXPANDED_W, borderRight: "1px solid rgba(0,0,0,0.08)" }}
            >
              <SidebarContent collapsed={false} toggle={toggle} onNavigate={() => setMobileOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
