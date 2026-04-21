"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: "#ffffff",
            border: "1px solid rgba(20,33,26,0.1)",
            borderRadius: 10,
            color: "#0f1711",
            fontSize: 13,
            fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
            boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
          },
        }}
      />
    </SessionProvider>
  );
}
