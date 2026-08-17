import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { portalFeatureByPath } from "@/lib/portal-features";
import { getVisibleFeatureKeysForUser } from "@/lib/portal-permissions";

const publicPrefixes = [
  "/api/auth",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/setup",
  "/_next",
  "/favicon.ico",
  "/fonts",
];

export async function proxy(request: NextRequest) {
  if (
    publicPrefixes.some(
      (prefix) =>
        request.nextUrl.pathname === prefix ||
        request.nextUrl.pathname.startsWith(`${prefix}/`),
    )
  ) {
    return NextResponse.next();
  }

  const session = await auth.api.getSession({
    headers: request.headers,
  });
  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set(
      "next",
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
    return NextResponse.redirect(loginUrl);
  }

  // Sperrt Seiten, für die die Rollen-Rechte-Matrix (Admin > Nutzerrollen) kein
  // "Lesen" vorsieht – nicht nur das Menü ausblenden, sondern den direkten Aufruf
  // per Link/URL selbst verhindern. Läuft nur für im Katalog erfasste Pfade
  // (portal-features.ts) und fällt bei jedem Fehler bewusst offen (Zugriff
  // erlauben), damit ein Bug hier nie die ganze App aussperrt.
  try {
    const pathWithQuery = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    const feature = portalFeatureByPath.get(pathWithQuery) ?? portalFeatureByPath.get(request.nextUrl.pathname);

    if (feature) {
      const visibleFeatureKeys = await getVisibleFeatureKeysForUser(session.user.role);
      if (visibleFeatureKeys !== "all" && !visibleFeatureKeys.has(feature.featureKey)) {
        const deniedUrl = new URL("/dashboard", request.url);
        deniedUrl.searchParams.set("access", "denied");
        return NextResponse.redirect(deniedUrl);
      }
    }
  } catch (error) {
    console.error("Rechte-Prüfung im Proxy fehlgeschlagen, Zugriff bleibt erlaubt:", error);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\.[\\w]+$).*)", "/"],
};
