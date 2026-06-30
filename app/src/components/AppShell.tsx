import { AppHeader } from "./AppHeader";
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
  { name: "Planung", href: "/crew-dispatch" },
  { name: "LKW-Einteilung", href: "/truck-dispatch" },
  { name: "LKW-Einteilung Kurzstrecke", href: "/truck-dispatch/short-haul" },
  { name: "LKW-Einteilung Langstrecke", href: "/truck-dispatch/long-haul" },
  { name: "Mitarbeiterdisposition", href: "/employee-dispatch" },
  { name: "Sonderfahrzeuge", href: "/special-vehicle-dispatch" },
].sort((a, b) => a.name.localeCompare(b.name, "de-DE"));

const inventoryNavigation = [
  { name: "Inventarverwaltung", href: "/inventory" },
  { name: "Objekt anlegen", href: "/inventory/new" },
  { name: "Lagerverwaltung", href: "/inventory/storage" },
  { name: "Etikettenvorlagen", href: "/inventory/labels" },
  { name: "Scanner", href: "/inventory/scanner" },
].sort((a, b) => a.name.localeCompare(b.name, "de-DE"));

const employeeNavigation = [
  { name: "Führerscheinkontrolle", href: "/employees/driver-licenses" },
  { name: "Mitarbeiterverwaltung", href: "/employees" },
  { name: "Mitarbeiterzertifikate", href: "/employees/certificates" },
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
      <AppHeader
        dispositionNavigation={dispositionNavigation}
        employeeNavigation={employeeNavigation}
        inventoryNavigation={inventoryNavigation}
        primaryNavigation={primaryNavigation}
        projectNavigation={projectNavigation}
        secondaryNavigation={secondaryNavigation}
      />

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
