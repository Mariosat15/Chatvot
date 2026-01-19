import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true
  },
  productionBrowserSourceMaps: false,
  serverExternalPackages: ['inngest'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  // Enable instrumentation for cache pre-warming on server startup
  experimental: {
    instrumentationHook: true,
  },
};

export default nextConfig;
