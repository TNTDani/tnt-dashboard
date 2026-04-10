"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { RecentItem } from "@/lib/types";
import { useSidebar } from "@/lib/sidebar-context";
import { signOut } from "next-auth/react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
  Trophy,
  Inbox,
  Search,
  BarChart2,
  LogOut,
  Radar,
  GripVertical,
  Clock,
  CalendarDays,
  ChevronLeft,
} from "lucide-react";

// ── Nav definitions ───────────────────────────────────────────────────────────

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
  { href: "/screening", icon: Zap, label: "AI Screening", exact: true },
  { href: "/fee-calculator", icon: Calculator, label: "Fee Calculator", exact: false },
  { href: "/sourcing", icon: Search, label: "Source Candidates", exact: true },
  { href: "/vacancy-monitor", icon: Radar, label: "Vacancy Monitor", exact: true },
  { href: "/reports", icon: BarChart2, label: "Reports", exact: false },
];

const LS_KEY_RECRUITMENT = "tnt_sidebar_recruitment_order";
const LS_KEY_TOOLS = "tnt_sidebar_tools_order";

type NavItem = (typeof RECRUITMENT_NAV)[number];

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// ── NavLink ───────────────────────────────────────────────────────────────────

interface NavLinkProps {
  href: string;
  icon: React.ElementType;
  label: string;
  exact: boolean;
  badge?: number;
  collapsed: boolean;
}

function NavLink({ href, icon: Icon, label, exact, badge, collapsed }: NavLinkProps) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={`relative group flex items-center transition-colors duration-150 rounded-lg
        ${collapsed ? "justify-center h-10 w-10 mx-auto" : "gap-3 px-3 py-2.5 w-full"}
        ${active ? "text-[#F5F5F5]" : "text-[#A0A0A0] hover:text-[#F5F5F5]"}
      `}
    >
      {/* Active background pill — slides between items via layoutId */}
      {active && (
        <motion.div
          layoutId="sidebar-active-bg"
          className="absolute inset-0 rounded-lg"
          style={{ background: "rgba(124,58,237,0.12)" }}
          transition={{ type: "spring", stiffness: 500, damping: 40 }}
        />
      )}

      {/* Left border accent (expanded only) */}
      {active && !collapsed && (
        <motion.div
          layoutId="sidebar-active-border"
          className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full bg-[#7C3AED]"
          transition={{ type: "spring", stiffness: 500, damping: 40 }}
        />
      )}

      {/* Icon */}
      <Icon
        size={15}
        className={`relative z-10 flex-shrink-0 transition-colors ${
          active ? "text-[#A855F7]" : "group-hover:text-[#F5F5F5]"
        }`}
      />

      {/* Label */}
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

      {/* Badge (expanded) */}
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

      {/* Badge dot (collapsed) */}
      {collapsed && badge !== undefined && badge > 0 && (
        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#EF4444]" />
      )}

      {/* Tooltip (collapsed mode) */}
      {collapsed && (
        <span
          className="
            pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3
            px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#F5F5F5] whitespace-nowrap
            bg-[#162032] border shadow-xl shadow-black/40
            opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-[200]
          "
          style={{ borderColor: "rgba(124,58,237,0.2)" }}
        >
          {label}
          {badge !== undefined && badge > 0 && (
            <span className="ml-1.5 text-[#EF4444] font-bold">{badge}</span>
          )}
        </span>
      )}
    </Link>
  );
}

// ── SortableNavItem ───────────────────────────────────────────────────────────

function SortableNavItem({
  item,
  badge,
  collapsed,
}: {
  item: NavItem;
  badge?: number;
  collapsed: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.href,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: "relative" as const,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="group flex items-center gap-1">
      {/* Drag handle — only in expanded mode */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.button
            key="handle"
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 16 }}
            exit={{ opacity: 0, width: 0 }}
            className="flex-shrink-0 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing text-[#4B5563] hover:text-[#7C3AED] transition-opacity"
            {...attributes}
            {...listeners}
            tabIndex={-1}
            aria-label="Drag to reorder"
          >
            <GripVertical size={12} />
          </motion.button>
        )}
      </AnimatePresence>
      <div className="flex-1 min-w-0">
        <NavLink
          href={item.href}
          icon={item.icon}
          label={item.label}
          exact={item.exact}
          badge={badge}
          collapsed={collapsed}
        />
      </div>
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionLabel({ label, collapsed }: { label: string; collapsed: boolean }) {
  return (
    <AnimatePresence initial={false}>
      {!collapsed ? (
        <motion.p
          key="label"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="text-[#4B5563] text-[10px] font-semibold uppercase tracking-[0.08em] px-3 mb-1.5"
        >
          {label}
        </motion.p>
      ) : (
        <motion.div
          key="divider"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="mx-3 mb-1.5 h-px"
          style={{ background: "rgba(124,58,237,0.12)" }}
        />
      )}
    </AnimatePresence>
  );
}

// ── Recent icon map ───────────────────────────────────────────────────────────

const RECENT_ICON: Record<RecentItem["type"], React.ElementType> = {
  candidate: UserCircle,
  vacancy: Briefcase,
  client: Building2,
};

// ── Main Sidebar ──────────────────────────────────────────────────────────────

export default function Sidebar() {
  const { collapsed, toggle } = useSidebar();
  const [followUpCount, setFollowUpCount] = useState(0);
  const [recruitmentItems, setRecruitmentItems] = useState<NavItem[]>(RECRUITMENT_NAV);
  const [toolsItems, setToolsItems] = useState<NavItem[]>(TOOLS_NAV);
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);

  const EXPANDED_W = 240;
  const COLLAPSED_W = 64;
  const transition = { duration: 0.22, ease: [0.4, 0, 0.2, 1] as const };

  // Restore saved order + recent items
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

  // Follow-up badge
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

  // DnD sensors
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

  return (
    <motion.aside
      animate={{ width: collapsed ? COLLAPSED_W : EXPANDED_W }}
      transition={transition}
      className="fixed left-0 top-0 h-screen flex flex-col z-40 overflow-hidden"
      style={{
        background: "#111e2d",
        borderRight: "1px solid rgba(124,58,237,0.12)",
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center h-14 px-4 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(124,58,237,0.12)" }}
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Icon mark */}
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{
              background: "linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)",
              boxShadow: "0 0 12px rgba(124,58,237,0.4)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 34 34" fill="none">
              <circle cx="17" cy="17" r="15.5" stroke="white" strokeWidth="1.5" />
              <path d="M17 4 L19.5 17 L17 14.5 L14.5 17 Z" fill="white" />
            </svg>
          </div>

          {/* Wordmark */}
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.div
                key="wordmark"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.15 }}
                className="min-w-0"
              >
                <p className="text-[#F5F5F5] font-bold text-sm leading-none">TrueNorth</p>
                <p
                  className="text-[10px] font-semibold tracking-[0.15em] uppercase mt-0.5"
                  style={{ color: "#A855F7" }}
                >
                  Talent
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
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleRecruitmentDragEnd}
          >
            <SortableContext
              items={recruitmentItems.map((i) => i.href)}
              strategy={verticalListSortingStrategy}
            >
              {recruitmentItems.map((item) => (
                <SortableNavItem
                  key={item.href}
                  item={item}
                  badge={item.badgeKey === "followUps" ? followUpCount : undefined}
                  collapsed={collapsed}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>

        {/* Recent items — hidden when collapsed */}
        <AnimatePresence initial={false}>
          {!collapsed && recentItems.length > 0 && (
            <motion.div
              key="recent"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="px-3 mb-5"
            >
              <p className="text-[#4B5563] text-[10px] font-semibold uppercase tracking-[0.08em] px-3 mb-1.5">
                Recent
              </p>
              <div className="space-y-0.5">
                {recentItems.map((item) => {
                  const Icon = RECENT_ICON[item.type];
                  return (
                    <Link
                      key={`${item.type}-${item.id}`}
                      href={item.href}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-[#4B5563] hover:text-[#F5F5F5] hover:bg-[rgba(124,58,237,0.06)] transition-all group"
                    >
                      <Icon size={12} className="flex-shrink-0" />
                      <span className="truncate flex-1">{item.name}</span>
                      <Clock
                        size={10}
                        className="opacity-0 group-hover:opacity-40 flex-shrink-0 transition-opacity"
                      />
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tools */}
        <div className={`${collapsed ? "px-2" : "px-3"} space-y-0.5`}>
          <SectionLabel label="Tools" collapsed={collapsed} />
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleToolsDragEnd}
          >
            <SortableContext
              items={toolsItems.map((i) => i.href)}
              strategy={verticalListSortingStrategy}
            >
              {toolsItems.map((item) => (
                <SortableNavItem key={item.href} item={item} collapsed={collapsed} />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      </nav>

      {/* Footer */}
      <div
        className="flex-shrink-0 p-3 space-y-1"
        style={{ borderTop: "1px solid rgba(124,58,237,0.12)" }}
      >
        {/* Collapse toggle */}
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={toggle}
          className={`w-full flex items-center rounded-lg py-2.5 text-[#A0A0A0] hover:text-[#F5F5F5] hover:bg-[rgba(124,58,237,0.08)] transition-colors text-xs
            ${collapsed ? "justify-center px-0" : "gap-3 px-3"}
          `}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <motion.div
            animate={{ rotate: collapsed ? 180 : 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            className="flex-shrink-0"
          >
            <ChevronLeft size={15} />
          </motion.div>
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.span
                key="label"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex-1 text-left font-medium"
              >
                Collapse
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>

        {/* Sign out */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => signOut({ callbackUrl: "/login" })}
          className={`w-full group flex items-center rounded-lg py-2.5 text-[#4B5563] hover:text-[#EF4444] transition-colors text-xs
            ${collapsed ? "justify-center px-0" : "gap-3 px-3"}
          `}
          title="Sign out"
        >
          <LogOut size={14} className="flex-shrink-0" />
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.span
                key="label"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                Sign out
              </motion.span>
            )}
          </AnimatePresence>

          {/* Tooltip */}
          {collapsed && (
            <span
              className="pointer-events-none absolute left-full ml-3 px-2.5 py-1.5 rounded-lg text-xs text-[#EF4444] whitespace-nowrap bg-[#162032] border opacity-0 group-hover:opacity-100 transition-opacity z-[200]"
              style={{ borderColor: "rgba(239,68,68,0.2)" }}
            >
              Sign out
            </span>
          )}
        </motion.button>

        {/* Version — expanded only */}
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.p
              key="version"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="text-[#4B5563] text-[10px] tracking-widest uppercase px-3 pt-1"
            >
              Internal Tool · v2.0
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </motion.aside>
  );
}
