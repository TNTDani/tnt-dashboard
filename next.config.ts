import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  serverExternalPackages: ["mammoth", "docx", "googleapis"],
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
