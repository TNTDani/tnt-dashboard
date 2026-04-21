"use client";

import { motion, AnimatePresence } from "motion/react";

export interface ActivityEvent {
  id: string;
  icon?: string;
  text: string;
  timestamp: string;
  type?: "email" | "stage" | "screening" | "scorecard" | "note" | "created" | "general";
}

interface ActivityFeedProps {
  events: ActivityEvent[];
  maxItems?: number;
  showHeader?: boolean;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  if (hours < 48) return "yesterday";
  return `${Math.floor(hours / 24)}d ago`;
}

const TYPE_ICON: Record<string, string> = {
  email: "✉", stage: "→", screening: "✦", scorecard: "★", note: "✎", created: "+", general: "·",
};

const TYPE_COLOR: Record<string, string> = {
  email: "#2D4A2D", stage: "#2D4A2D", screening: "#5a6a60",
  scorecard: "#8a9a90", note: "#5a6a60", created: "#2D4A2D", general: "#8a9a90",
};

export default function ActivityFeed({ events, maxItems = 8, showHeader = true }: ActivityFeedProps) {
  const displayed = events.slice(0, maxItems);

  return (
    <div>
      {showHeader && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
          <motion.span
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{ width: 6, height: 6, borderRadius: "50%", background: "#2D4A2D", display: "inline-block", flexShrink: 0 }}
          />
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "1.5px", textTransform: "uppercase", color: "#5a6a60" }}>
            Live Activity
          </span>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column" }}>
        <AnimatePresence initial={false}>
          {displayed.length === 0 ? (
            <div style={{ padding: "16px 0", textAlign: "center" }}>
              <p style={{ fontSize: 12, color: "#8a9a90" }}>No activity yet</p>
            </div>
          ) : (
            displayed.map((event, i) => {
              const typeKey = event.type ?? "general";
              const icon = event.icon ?? TYPE_ICON[typeKey] ?? "·";
              const color = TYPE_COLOR[typeKey] ?? "#8a9a90";

              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.2, delay: i * 0.04 }}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: "8px 0",
                    borderBottom: i < displayed.length - 1 ? "1px solid rgba(20,33,26,0.05)" : "none",
                  }}
                >
                  <div style={{ width: 22, height: 22, borderRadius: 6, background: "rgba(45,74,45,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color, flexShrink: 0, marginTop: 1, fontWeight: 600 }}>
                    {icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, color: "#2a3a30", lineHeight: 1.4 }}>{event.text}</p>
                  </div>
                  <span style={{ fontSize: 10, color: "#8a9a90", flexShrink: 0, marginTop: 2 }}>
                    {relativeTime(event.timestamp)}
                  </span>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
