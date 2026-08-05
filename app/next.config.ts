import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.7.85"],
  experimental: {
    serverActions: {
      bodySizeLimit: "250mb",
    },
  },
  // Für Docker-Deployment: baut ein minimales, eigenständiges Server-Bundle
  // (nur benötigte node_modules) statt des vollen node_modules-Ordners.
  output: "standalone",
};

export default nextConfig;
