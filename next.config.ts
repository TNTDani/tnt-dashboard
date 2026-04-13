import type { NextConfig } from "next";
import path from "path";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  // Disable in development — Turbopack doesn't support webpack plugins
  disable: process.env.NODE_ENV === "development",
  fallbacks: {
    document: "/offline",
  },
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching: [
      {
        // Cache Supabase API reads for offline fallback
        urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*/i,
        handler: "NetworkFirst",
        options: {
          cacheName: "supabase-cache",
          expiration: { maxEntries: 200, maxAgeSeconds: 24 * 60 * 60 },
          networkTimeoutSeconds: 10,
        },
      },
      {
        // Cache static Next.js assets aggressively
        urlPattern: /^\/_next\/static\/.*/i,
        handler: "CacheFirst",
        options: {
          cacheName: "next-static",
          expiration: { maxEntries: 256, maxAgeSeconds: 365 * 24 * 60 * 60 },
        },
      },
      {
        // Cache Next.js image optimizer
        urlPattern: /^\/_next\/image\?.*/i,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "next-image",
          expiration: { maxEntries: 64, maxAgeSeconds: 30 * 24 * 60 * 60 },
        },
      },
    ],
  },
});

const nextConfig: NextConfig = {
  serverExternalPackages: ["mammoth", "docx", "googleapis"],
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default withPWA(nextConfig);
