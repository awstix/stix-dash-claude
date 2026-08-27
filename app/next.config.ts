import type { NextConfig } from "next";

const supabaseHostname = process.env.SUPABASE_URL
  ? new URL(process.env.SUPABASE_URL).hostname
  : undefined;

const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  // https://tile.openstreetmap.org: Kartenkacheln im Baustellen-Kartenausschnitt
  // (ProjectMap.tsx, dailyReport-Kartenbild).
  `img-src 'self' blob: data: https://tile.openstreetmap.org${supabaseHostname ? ` https://${supabaseHostname}` : ""}`,
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  // https://www.openstreetmap.org: eingebettete Kartenvorschau (ProjectPhotoGallery,
  // Inventar-Standort).
  "frame-src 'self' https://www.openstreetmap.org",
  // https://nominatim.openstreetmap.org: Adresssuche/Geocoding, clientseitig
  // aus ProjectMapEditor.tsx aufgerufen.
  "connect-src 'self' https://nominatim.openstreetmap.org",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.7.85"],
  experimental: {
    serverActions: {
      bodySizeLimit: "250mb",
    },
  },
  // Sicherheits-Header für die gesamte App (internes Datenportal, keine
  // öffentlich eingebetteten Inhalte) - statische CSP ohne Nonce, weil die
  // Codebasis keine dangerouslySetInnerHTML/innerHTML/eval-Stellen hat, die
  // ein nonce-basiertes CSP absichern müsste; ein Nonce würde außerdem jede
  // Seite in dynamisches Rendering zwingen.
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "Content-Security-Policy", value: contentSecurityPolicy },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=()",
        },
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ],
    },
  ],
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
