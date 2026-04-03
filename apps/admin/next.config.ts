import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Reason: The admin app has mongoose in its own node_modules AND the root
  // also has mongoose. Turbopack bundles them as two separate module instances,
  // causing "ClientSession must be from the same MongoClient" when production
  // code (sessions on root's mongoose) mixes with admin models (admin's mongoose).
  // Externalizing mongoose forces ALL imports to resolve to a single runtime copy.
  serverExternalPackages: ["mongoose"],
  typescript: {
    ignoreBuildErrors: true,
  },
  productionBrowserSourceMaps: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
