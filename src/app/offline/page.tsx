"use client";

export default function OfflinePage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
      style={{ background: "#EDEDEB" }}
    >
      {/* Orchard icon */}
      <svg width="56" height="42" viewBox="0 0 48 36" fill="none" className="mb-6 opacity-40">
        <rect x="3"  y="2"  width="8" height="8" rx="2" fill="#2D4A2D"/>
        <rect x="20" y="2"  width="8" height="8" rx="2" fill="#2D4A2D"/>
        <rect x="37" y="2"  width="8" height="8" rx="2" fill="#2D4A2D"/>
        <rect x="20" y="14" width="8" height="8" rx="2" fill="#2D4A2D"/>
        <rect x="3"  y="26" width="8" height="8" rx="2" fill="#2D4A2D"/>
        <rect x="20" y="26" width="8" height="8" rx="2" fill="#2D4A2D"/>
        <rect x="37" y="26" width="8" height="8" rx="2" fill="#2D4A2D"/>
        <line x1="7"  y1="10" x2="24" y2="14" stroke="#2D4A2D" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="24" y1="10" x2="24" y2="14" stroke="#2D4A2D" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="41" y1="10" x2="24" y2="14" stroke="#2D4A2D" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="24" y1="22" x2="7"  y2="26" stroke="#2D4A2D" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="24" y1="22" x2="24" y2="26" stroke="#2D4A2D" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="24" y1="22" x2="41" y2="26" stroke="#2D4A2D" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>

      <h1 className="text-[22px] font-medium mb-2" style={{ color: "#2D4A2D" }}>
        You&apos;re offline
      </h1>
      <p className="text-sm mb-8 max-w-xs" style={{ color: "#6B7280" }}>
        Orchard needs a connection to load your pipeline. Check your network and try again.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="px-5 py-2.5 rounded-md text-sm font-semibold text-white transition-colors"
        style={{ background: "#2D4A2D" }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#3D6B3D"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#2D4A2D"; }}
      >
        Try again
      </button>
    </div>
  );
}
