"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { db } from "@/lib/db";
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
} from "lucide-react";

const RECRUITMENT_NAV = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard", exact: true },
  { href: "/candidates", icon: UserCircle, label: "Candidates", exact: false },
  { href: "/clients", icon: Building2, label: "Clients", exact: false },
  { href: "/email", icon: Mail, label: "Email", exact: false, badgeKey: "followUps" as const },
  { href: "/pipeline", icon: Users, label: "Pipeline", exact: true },
  { href: "/shortlist",   icon: ListChecks, label: "Shortlist",   exact: true },
  { href: "/placements",  icon: Trophy,     label: "Placements",  exact: true },
  { href: "/vacancies",   icon: Briefcase,  label: "Vacancies",   exact: true },
  { href: "/tickets",     icon: Inbox,      label: "Tickets",     exact: false },
];

const TOOLS_NAV = [
  { href: "/cv-processor",       icon: FileText,   label: "CV Processor",      exact: true  },
  { href: "/screening",          icon: Zap,        label: "AI Screening",      exact: true  },
  { href: "/fee-calculator",     icon: Calculator, label: "Fee Calculator",    exact: false },
  { href: "/sourcing",           icon: Search,     label: "Source Candidates", exact: true  },
  { href: "/vacancy-monitor",    icon: Radar,      label: "Vacancy Monitor",   exact: true  },
  { href: "/reports",            icon: BarChart2,  label: "Reports",           exact: false },
];

const LS_KEY_RECRUITMENT = "tnt_sidebar_recruitment_order";
const LS_KEY_TOOLS = "tnt_sidebar_tools_order";

type NavItem = typeof RECRUITMENT_NAV[number];

function reorder<T extends { href: string }>(items: T[], savedOrder: string[]): T[] {
  if (!savedOrder.length) return items;
  const sorted = [...items].sort((a, b) => {
    const ai = savedOrder.indexOf(a.href);
    const bi = savedOrder.indexOf(b.href);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
  return sorted;
}

function NavLink({
  href,
  icon: Icon,
  label,
  exact,
  badge,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  exact: boolean;
  badge?: number;
}) {
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
      <span className="flex-1">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#ef4444] text-white text-[10px] font-bold leading-none">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}

function SortableNavItem({
  item,
  badge,
}: {
  item: NavItem;
  badge?: number;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.href });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: "relative" as const,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="group flex items-center gap-1">
      {/* Drag handle — visible on group hover */}
      <button
        className="flex-shrink-0 w-4 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing text-[#4a6fa5] hover:text-[#7C3AED] transition-opacity"
        {...attributes}
        {...listeners}
        tabIndex={-1}
        aria-label="Drag to reorder"
      >
        <GripVertical size={12} />
      </button>
      <div className="flex-1 min-w-0">
        <NavLink
          href={item.href}
          icon={item.icon}
          label={item.label}
          exact={item.exact}
          badge={badge}
        />
      </div>
    </div>
  );
}

export default function Sidebar() {
  const [followUpCount, setFollowUpCount] = useState(0);
  const [recruitmentItems, setRecruitmentItems] = useState<NavItem[]>(RECRUITMENT_NAV);
  const [toolsItems, setToolsItems] = useState<NavItem[]>(TOOLS_NAV);

  // Load saved order from localStorage
  useEffect(() => {
    try {
      const savedRec = localStorage.getItem(LS_KEY_RECRUITMENT);
      if (savedRec) setRecruitmentItems(reorder(RECRUITMENT_NAV, JSON.parse(savedRec)));
    } catch { /* ignore */ }
    try {
      const savedTools = localStorage.getItem(LS_KEY_TOOLS);
      if (savedTools) setToolsItems(reorder(TOOLS_NAV, JSON.parse(savedTools)));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const recalc = () => {
      db.getFollowUps().then(followUps => {
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        const due = followUps.filter(f => {
          if (f.status === 'done') return false;
          const effectiveDate = f.status === 'snoozed' && f.snoozedUntil ? f.snoozedUntil : f.dueDate;
          return new Date(effectiveDate) <= today;
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
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleRecruitmentDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = recruitmentItems.findIndex(i => i.href === active.id);
    const newIndex = recruitmentItems.findIndex(i => i.href === over.id);
    const updated = arrayMove(recruitmentItems, oldIndex, newIndex);
    setRecruitmentItems(updated);
    localStorage.setItem(LS_KEY_RECRUITMENT, JSON.stringify(updated.map(i => i.href)));
  };

  const handleToolsDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = toolsItems.findIndex(i => i.href === active.id);
    const newIndex = toolsItems.findIndex(i => i.href === over.id);
    const updated = arrayMove(toolsItems, oldIndex, newIndex);
    setToolsItems(updated);
    localStorage.setItem(LS_KEY_TOOLS, JSON.stringify(updated.map(i => i.href)));
  };

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
            <p className="text-white font-bold text-sm leading-none">TrueNorth</p>
            <p className="text-[#7C3AED] text-[10px] font-semibold tracking-widest uppercase">Talent</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {/* Recruitment section */}
        <p className="text-[#4a6fa5] text-[10px] font-semibold uppercase tracking-widest px-3 mb-2">Recruitment</p>
        <div className="space-y-0.5 mb-5">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleRecruitmentDragEnd}
          >
            <SortableContext
              items={recruitmentItems.map(i => i.href)}
              strategy={verticalListSortingStrategy}
            >
              {recruitmentItems.map(item => (
                <SortableNavItem
                  key={item.href}
                  item={item}
                  badge={item.badgeKey === 'followUps' ? followUpCount : undefined}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>

        {/* Tools section */}
        <p className="text-[#4a6fa5] text-[10px] font-semibold uppercase tracking-widest px-3 mb-2">Tools</p>
        <div className="space-y-0.5">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleToolsDragEnd}
          >
            <SortableContext
              items={toolsItems.map(i => i.href)}
              strategy={verticalListSortingStrategy}
            >
              {toolsItems.map(item => (
                <SortableNavItem key={item.href} item={item} />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      </nav>

      <div className="px-4 py-4 border-t border-[#1e3a5f]">
        <p className="text-[#94a3b8] text-[10px] tracking-widest uppercase">Internal Tool · v2.0</p>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="mt-2.5 flex items-center gap-2 text-[#4a6fa5] hover:text-[#ef4444] text-xs transition-colors w-full"
        >
          <LogOut size={12} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
