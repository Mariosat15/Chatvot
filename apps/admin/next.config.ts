import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Allow imports from parent directories (shared packages)
  transpilePackages: ["@packages/database", "@packages/services", "@packages/shared"],
  
  // Turbopack configuration (Next.js 16+ default)
  turbopack: {
    resolveAlias: {
      "@packages": path.resolve(__dirname, "../../packages"),
      "@database": path.resolve(__dirname, "../../database"),
      "@lib": path.resolve(__dirname, "../../lib"),
      "@components": path.resolve(__dirname, "../../components"),
    },
  },

  // Environment variables
  env: {
    ADMIN_APP: "true",
  },
};

export default nextConfig;

