"use client";

import { Command } from "lucide-react";

export interface Crumb {
  label: string;
  href?: string;
}

interface WindowChromeProps {
  breadcrumbs: Crumb[];
  onCmdK?: () => void;
  children: React.ReactNode;
  className?: string;
}

export default function WindowChrome({ breadcrumbs, onCmdK, children, className = "" }: WindowChromeProps) {
  return (
    <div
      className={className}
      style={{
        background: "#ffffff",
        border: "1px solid rgba(20,33,26,0.08)",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      {/* Chrome header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          background: "linear-gradient(to bottom, #ffffff, #fafafa)",
          borderBottom: "1px solid rgba(20,33,26,0.06)",
        }}
      >
        {/* Left: Traffic dots + breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Traffic dots */}
          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff5f56" }} />
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ffbd2e" }} />
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#27c93f" }} />
          </div>

          {/* Separator */}
          <div style={{ width: 1, height: 14, background: "rgba(20,33,26,0.1)" }} />

          {/* Breadcrumb */}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {breadcrumbs.map((crumb, i) => (
              <span key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {i > 0 && (
                  <span style={{ fontSize: 11, color: "rgba(20,33,26,0.25)" }}>·</span>
                )}
                <span
                  style={{
                    fontSize: 11,
                    color: i === breadcrumbs.length - 1 ? "#2a3a30" : "#8a9a90",
                    fontWeight: i === breadcrumbs.length - 1 ? 500 : 400,
                  }}
                >
                  {crumb.label}
                </span>
              </span>
            ))}
          </div>
        </div>

        {/* Right: ⌘K indicator */}
        {onCmdK && (
          <button
            onClick={onCmdK}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "3px 8px",
              borderRadius: 6,
              background: "rgba(20,33,26,0.04)",
              border: "1px solid rgba(20,33,26,0.08)",
              cursor: "pointer",
              color: "#8a9a90",
            }}
          >
            <Command size={10} />
            <span style={{ fontSize: 10, fontWeight: 500 }}>K</span>
          </button>
        )}
      </div>

      {/* Content */}
      <div>{children}</div>
    </div>
  );
}
