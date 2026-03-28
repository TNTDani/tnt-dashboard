import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  serverExternalPackages: ["mammoth", "docx"],
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
