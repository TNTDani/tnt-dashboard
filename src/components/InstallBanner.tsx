"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download } from "lucide-react";

const LS_KEY = "orchard_install_dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Don't show if already dismissed or already installed (standalone mode)
    if (
      localStorage.getItem(LS_KEY) ||
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone
    ) {
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show banner after 30 seconds
      setTimeout(() => setVisible(true), 30_000);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      localStorage.setItem(LS_KEY, "1");
    }
    setVisible(false);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    localStorage.setItem(LS_KEY, "1");
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed bottom-4 left-4 right-4 z-[998] md:left-auto md:right-4 md:w-80 rounded-xl p-4 flex items-center gap-3"
          style={{
            background: "#FFFFFF",
            boxShadow: "0 4px 24px rgba(45,74,45,0.18)",
            border: "1px solid rgba(45,74,45,0.12)",
          }}
        >
          {/* Icon */}
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "#2D4A2D" }}
          >
            <svg width="22" height="17" viewBox="0 0 48 36" fill="none">
              <rect x="3"  y="2"  width="8" height="8" rx="2" fill="white"/>
              <rect x="20" y="2"  width="8" height="8" rx="2" fill="white"/>
              <rect x="37" y="2"  width="8" height="8" rx="2" fill="white"/>
              <rect x="20" y="14" width="8" height="8" rx="2" fill="white"/>
              <rect x="3"  y="26" width="8" height="8" rx="2" fill="white"/>
              <rect x="20" y="26" width="8" height="8" rx="2" fill="white"/>
              <rect x="37" y="26" width="8" height="8" rx="2" fill="white"/>
              <line x1="7" y1="10" x2="24" y2="14" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="24" y1="10" x2="24" y2="14" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="41" y1="10" x2="24" y2="14" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="24" y1="22" x2="7" y2="26" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="24" y1="22" x2="24" y2="26" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="24" y1="22" x2="41" y2="26" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: "#2D4A2D" }}>
              Add Orchard to your home screen
            </p>
            <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>
              Install for faster access
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={handleInstall}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-white transition-colors"
              style={{ background: "#2D4A2D" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#3D6B3D"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#2D4A2D"; }}
            >
              <Download size={11} />
              Install
            </motion.button>
            <button
              onClick={handleDismiss}
              className="p-1.5 rounded-md transition-colors"
              style={{ color: "#6B7280" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#2D4A2D"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#6B7280"; }}
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
