"use client";

import { motion } from "motion/react";

const STAGES = [
  { key: "sourced",     label: "Sourced"   },
  { key: "screened",    label: "Screened"  },
  { key: "submitted",   label: "Submitted" },
  { key: "interview",   label: "Interview" },
  { key: "placed",      label: "Placed"    },
];

interface PipelineRailProps {
  activeStage?: string;
  onStageClick?: (stage: string) => void;
  compact?: boolean;
}

export default function PipelineRail({ activeStage = "sourced", onStageClick, compact = false }: PipelineRailProps) {
  const activeIdx = STAGES.findIndex(s => s.key === activeStage);

  return (
    <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
      {STAGES.map((stage, i) => {
        const isCompleted = i < activeIdx;
        const isActive    = i === activeIdx;

        return (
          <div key={stage.key} style={{ display: "flex", alignItems: "center", flex: 1 }}>
            {/* Stage dot + label */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                position: "relative",
                cursor: onStageClick ? "pointer" : "default",
              }}
              onClick={() => onStageClick?.(stage.key)}
            >
              {/* Dot */}
              <div
                style={{
                  width: compact ? 8 : 12,
                  height: compact ? 8 : 12,
                  borderRadius: "50%",
                  background: isCompleted ? "#2D4A2D" : "transparent",
                  border: isCompleted
                    ? "none"
                    : isActive
                    ? "2px solid #2D4A2D"
                    : "2px solid rgba(20,33,26,0.15)",
                  position: "relative",
                  flexShrink: 0,
                  transition: "all 0.3s ease",
                  zIndex: 1,
                }}
              >
                {isActive && (
                  <motion.div
                    animate={{ scale: [1, 1.7, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                    style={{
                      position: "absolute",
                      inset: -4,
                      borderRadius: "50%",
                      background: "rgba(45,74,45,0.15)",
                    }}
                  />
                )}
              </div>

              {/* Label */}
              {!compact && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? "#2D4A2D" : isCompleted ? "#5a6a60" : "#8a9a90",
                    letterSpacing: "0.3px",
                    whiteSpace: "nowrap",
                    transition: "color 0.2s",
                    textAlign: "center",
                    lineHeight: 1.2,
                  }}
                >
                  {stage.label}
                </span>
              )}
            </div>

            {/* Connector rail (not after last) */}
            {i < STAGES.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 2,
                  marginTop: compact ? 0 : -18,
                  background: "rgba(20,33,26,0.08)",
                  position: "relative",
                  overflow: "hidden",
                  marginLeft: 2,
                  marginRight: 2,
                }}
              >
                {i < activeIdx && (
                  <motion.div
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 0.5, delay: i * 0.1, ease: "easeOut" }}
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      height: "100%",
                      background: "#2D4A2D",
                      borderRadius: 1,
                    }}
                  />
                )}
                {i === activeIdx && (
                  <motion.div
                    initial={{ width: "0%" }}
                    animate={{ width: "45%" }}
                    transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      height: "100%",
                      background: "rgba(45,74,45,0.35)",
                      borderRadius: 1,
                    }}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
