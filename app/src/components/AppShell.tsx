import Link from "next/link";
import { GlobalFormFeedback } from "./GlobalFormFeedback";

const primaryNavigation = [
  { name: "Dashboard", href: "/dashboard" },
];

const projectNavigation = [
  { name: "Bautagesberichte", href: "/projects/bautagesberichte" },
  { name: "Dokumente", href: "/projects/dokumente" },
  { name: "Formulare", href: "/projects/formulare" },
  { name: "Fotos", href: "/projects/fotos" },
  { name: "Leistung", href: "/projects/performance" },
  { name: "Notizen", href: "/projects/notizen" },
  { name: "Projektübersicht", href: "/projects" },
].sort((a, b) => a.name.localeCompare(b.name, "de-DE"));

const secondaryNavigation = [
  { name: "Bestellung", href: "/orders" },
  { name: "Werkstatt", href: "/workshop" },
  { name: "Admin", href: "/admin" },
].sort((a, b) => a.name.localeCompare(b.name, "de-DE"));

const dispositionNavigation = [
  { name: "Asphaltdisposition", href: "/asphalt-dispatch" },
  { name: "Gerätedisposition", href: "/equipment-dispatch" },
  { name: "Kolonneneinteilung", href: "/crew-dispatch" },
  { name: "LKW-Einteilung", href: "/truck-dispatch" },
  { name: "LKW-Einteilung Kurzstrecke", href: "/truck-dispatch/short-haul" },
  { name: "LKW-Einteilung Langstrecke", href: "/truck-dispatch/long-haul" },
  { name: "Mitarbeiterdisposition", href: "/employee-dispatch" },
  { name: "Sonderfahrzeuge", href: "/special-vehicle-dispatch" },
].sort((a, b) => a.name.localeCompare(b.name, "de-DE"));

export function AppShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-gray-100">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-8 py-4">
          <Link href="/" className="text-xl font-bold text-gray-900">
            Dashboard Stix
          </Link>

          <nav className="flex flex-wrap gap-2 text-sm font-medium text-gray-600">
            {primaryNavigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-2 hover:bg-gray-100 hover:text-gray-900"
              >
                {item.name}
              </Link>
            ))}

            <details className="group relative">
              <summary className="cursor-pointer list-none rounded-lg px-3 py-2 hover:bg-gray-100 hover:text-gray-900 marker:content-none [&::-webkit-details-marker]:hidden">
                Projekte
              </summary>

              <div className="absolute left-0 top-10 z-50 min-w-[240px] rounded-xl border border-gray-200 bg-white p-2 shadow-xl">
                {projectNavigation.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="block rounded-lg px-3 py-2 text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                  >
                    {item.name}
                  </Link>
                ))}
              </div>
            </details>

            <details className="group relative">
              <summary className="cursor-pointer list-none rounded-lg px-3 py-2 hover:bg-gray-100 hover:text-gray-900 marker:content-none [&::-webkit-details-marker]:hidden">
                Disposition
              </summary>

              <div className="absolute left-0 top-10 z-50 min-w-[260px] rounded-xl border border-gray-200 bg-white p-2 shadow-xl">
                {dispositionNavigation.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="block rounded-lg px-3 py-2 text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                  >
                    {item.name}
                  </Link>
                ))}
              </div>
            </details>

            {secondaryNavigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-2 hover:bg-gray-100 hover:text-gray-900"
              >
                {item.name}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
          {description ? (
            <p className="mt-2 text-gray-600">{description}</p>
          ) : null}
        </div>

        {children}
      </section>
      <GlobalFormFeedback />
    </main>
  );
}
