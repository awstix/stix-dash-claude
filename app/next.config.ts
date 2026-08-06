import type { NextConfig } from "next";

const supabaseHostname = process.env.SUPABASE_URL
  ? new URL(process.env.SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.7.85"],
  experimental: {
    serverActions: {
      bodySizeLimit: "250mb",
    },
  },
  images: {
    remotePatterns: supabaseHostname
      ? [
          {
            protocol: "https",
            hostname: supabaseHostname,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
  },
  // Für Docker-Deployment: baut ein minimales, eigenständiges Server-Bundle
  // (nur benötigte node_modules) statt des vollen node_modules-Ordners.
  output: "standalone",
};

export default nextConfig;
