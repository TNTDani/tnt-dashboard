/**
 * Shared design constants for consistent UI across the app.
 * Motion library: motion/react (import { motion, AnimatePresence } from "motion/react")
 */

// ── Colour tokens ──────────────────────────────────────────────────────────────
export const C = {
  bg:       "#EDEDEB",   // page background
  surface:  "#FFFFFF",   // card / panel surface
  border:   "rgba(45,74,45,0.12)",
  borderHv: "rgba(45,74,45,0.35)",
  primary:  "#2D4A2D",   // headings, icons, primary text
  hover:    "#3D6B3D",   // primary hover
  muted:    "#6B7280",   // secondary text
  faint:    "#94a3b8",   // placeholder / tertiary
  pill:     "#a8e6cf",   // green pill background
  pillText: "#2D4A2D",
  // semantic
  green:    "#4CAF50",
  amber:    "#f59e0b",
  red:      "#ef4444",
  blue:     "#3b82f6",
  purple:   "#8b5cf6",
} as const;

// ── Motion variants ────────────────────────────────────────────────────────────
/** Standard spring used in the sidebar layout */
export const LAYOUT_SPRING = { duration: 0.22, ease: [0.4, 0, 0.2, 1] as const };

/** Card hover / tap — use with whileHover / whileTap on motion.div */
export const CARD_HOVER = {
  whileHover: { y: -4, scale: 1.01, boxShadow: "0 16px 32px rgba(45,74,45,0.12)" },
  whileTap:   { scale: 0.97 },
  transition: { duration: 0.18, ease: [0.34, 1.56, 0.64, 1] as const },
} as const;

/** Row hover — subtle lift for list items */
export const ROW_HOVER = {
  whileHover: { backgroundColor: "rgba(45,74,45,0.03)", x: 2 },
  transition: { duration: 0.15 },
} as const;

/** Panel entrance — slide up from 8px */
export const PANEL_ENTER = {
  initial:  { opacity: 0, y: 8 },
  animate:  { opacity: 1, y: 0 },
  exit:     { opacity: 0, y: 8 },
  transition: { duration: 0.22, ease: [0.4, 0, 0.2, 1] as const },
} as const;

/** Stagger children */
export function stagger(i: number, base = 0.05) {
  return { delay: i * base };
}

// ── Shared CSS class helpers ───────────────────────────────────────────────────

/** Standard card wrapper class (use as className on motion.div) */
export const cardCls =
  "bg-white rounded-2xl border border-[rgba(45,74,45,0.12)] overflow-hidden";

/** Input field */
export const inputCls =
  "w-full bg-white border border-[rgba(45,74,45,0.15)] rounded-xl px-3 py-2.5 " +
  "text-[#2D4A2D] text-sm placeholder-[#9CA3AF] " +
  "focus:outline-none focus:border-[#2D4A2D] transition-colors";

/** Primary button */
export const btnPrimary =
  "inline-flex items-center gap-2 bg-[#2D4A2D] text-white text-sm font-medium " +
  "px-4 py-2 rounded-xl hover:bg-[#3D6B3D] active:scale-95 transition-all";

/** Ghost / outline button */
export const btnGhost =
  "inline-flex items-center gap-2 border border-[rgba(45,74,45,0.2)] text-[#2D4A2D] " +
  "text-sm font-medium px-4 py-2 rounded-xl hover:bg-[rgba(45,74,45,0.05)] " +
  "active:scale-95 transition-all";

/** Section label (UPPERCASE, muted) */
export const sectionLabel =
  "text-[10px] font-semibold tracking-widest uppercase text-[#6B7280]";

/** Tab button — active / inactive */
export function tabCls(active: boolean) {
  return active
    ? "text-[#2D4A2D] font-semibold border-b-2 border-[#2D4A2D] pb-2.5 text-sm transition-colors"
    : "text-[#6B7280] hover:text-[#2D4A2D] pb-2.5 text-sm transition-colors";
}

/** Status pill — pass a colour string */
export function pillCls(color: string) {
  return `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${color}`;
}
