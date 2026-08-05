import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const montserrat = localFont({
  display: "swap",
  src: "../../public/fonts/Montserrat-Variable.ttf",
  variable: "--font-montserrat",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Dashboard Stix",
  description: "Zentrale Projekt- und Dispositionsverwaltung",
};

// Komplette App ist login-/datenbankabhängig und darf beim Bauen nie
// statisch vorgerendert werden (dabei existiert noch keine Datenbank-
// Verbindung, z. B. im Docker-Build) – erzwingt dynamisches Rendering für
// jede Seite.
export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className={`${montserrat.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
