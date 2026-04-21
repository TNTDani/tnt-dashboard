"use client";

import { VacancyStage, VACANCY_STAGES, StageLogEntry } from "@/lib/types";
import { Check } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

interface Props {
  stage: VacancyStage;
  stageLog?: StageLogEntry[];
  compact?: boolean;
  onStageChange?: (stage: VacancyStage, log: StageLogEntry[]) => void;
}

const stageIndex = (s: VacancyStage) => VACANCY_STAGES.findIndex(v => v.id === s);

export default function VacancyStageBar({ stage, stageLog = [], compact = false, onStageChange }: Props) {
  const currentIdx = stageIndex(stage);

  const handleClick = (s: VacancyStage) => {
    if (!onStageChange) return;
    const entry: StageLogEntry = {
      id: uuidv4(),
      stage: s,
      changedAt: new Date().toISOString(),
    };
    onStageChange(s, [...stageLog, entry]);
  };

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {VACANCY_STAGES.map((s, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          return (
            <div
              key={s.id}
              title={s.label}
              className={`h-1.5 rounded-full flex-1 transition-all ${
                active ? "bg-[#2D4A2D]" : done ? "bg-[#2D4A2D]/50" : "bg-[rgba(45,74,45,0.15)]"
              }`}
            />
          );
        })}
        <span className="text-[10px] text-[#8a9a90] ml-1.5 whitespace-nowrap">
          {VACANCY_STAGES[currentIdx]?.label}
        </span>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-1">
        {VACANCY_STAGES.map((s, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          const clickable = !!onStageChange;

          return (
            <div key={s.id} className="flex-1 flex flex-col items-center gap-1.5">
              {/* Connector line + circle row */}
              <div className="w-full flex items-center">
                {/* Left line */}
                {i > 0 && (
                  <div className={`h-0.5 flex-1 ${done || active ? "bg-[#2D4A2D]" : "bg-[rgba(45,74,45,0.15)]"}`} />
                )}
                {/* Circle */}
                <button
                  onClick={() => clickable && handleClick(s.id)}
                  disabled={!clickable}
                  title={clickable ? `Move to ${s.label}` : s.label}
                  className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all border-2 ${
                    active
                      ? "bg-[#2D4A2D] border-[#2D4A2D] text-white"
                      : done
                      ? "bg-[#2D4A2D]/30 border-[#2D4A2D]/60 text-[#2D4A2D]"
                      : "bg-[#FFFFFF] border-[rgba(45,74,45,0.15)] text-[#6B7280]"
                  } ${clickable ? "cursor-pointer hover:scale-110" : "cursor-default"}`}
                >
                  {done ? (
                    <Check size={10} strokeWidth={3} />
                  ) : (
                    <span className="text-[9px] font-bold">{i + 1}</span>
                  )}
                </button>
                {/* Right line */}
                {i < VACANCY_STAGES.length - 1 && (
                  <div className={`h-0.5 flex-1 ${done ? "bg-[#2D4A2D]" : "bg-[rgba(45,74,45,0.15)]"}`} />
                )}
              </div>
              {/* Label */}
              <span className={`text-[9px] font-medium text-center leading-tight ${
                active ? "text-[#2D4A2D]" : done ? "text-[#2D4A2D]/70" : "text-[#6B7280]"
              }`}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Last stage change log */}
      {stageLog.length > 0 && (
        <p className="text-[10px] text-[#8a9a90] mt-2 text-right">
          Moved to {VACANCY_STAGES.find(s => s.id === stageLog[stageLog.length - 1].stage)?.label} ·{" "}
          {new Date(stageLog[stageLog.length - 1].changedAt).toLocaleDateString("en-GB", {
            day: "numeric", month: "short",
          })}
        </p>
      )}
    </div>
  );
}
