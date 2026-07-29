import { AppHeader } from "./AppHeader";
import { GlobalFormFeedback } from "./GlobalFormFeedback";

const primaryNavigation = [
  { name: "Dashboard", href: "/dashboard" },
];

const projectNavigation = [
  { name: "Bautagesberichte", href: "/projects/bautagesberichte" },
  { name: "Dokumente", href: "/projects/dokumente" },
  { name: "Formularbuilder", href: "/form-builder?scope=PROJECT" },
  { name: "Formulare", href: "/projects/formulare" },
  { name: "Fotos", href: "/projects/fotos" },
  { name: "Leistung", href: "/projects/performance" },
  { name: "Notizen", href: "/projects/notizen" },
  { name: "Projektübersicht", href: "/projects" },
].sort((a, b) => a.name.localeCompare(b.name, "de-DE"));

const secondaryNavigation = [
  { name: "Bestellung", href: "/orders" },
  { name: "Admin", href: "/admin" },
].sort((a, b) => a.name.localeCompare(b.name, "de-DE"));

const workshopNavigation = [
  { name: "Formularbuilder", href: "/form-builder?scope=WORKSHOP" },
  { name: "Formularvorlagen", href: "/workshop/forms" },
  { name: "Werkstattübersicht", href: "/workshop" },
].sort((a, b) => a.name.localeCompare(b.name, "de-DE"));

const dispositionNavigation = [
  { name: "Asphaltdisposition", href: "/asphalt-dispatch" },
  { name: "Feiertage & arbeitsfreie Tage", href: "/disposition/holidays" },
  { name: "Gerätedisposition", href: "/equipment-dispatch" },
  { name: "Planung", href: "/crew-dispatch" },
  { name: "LKW-Einteilung", href: "/truck-dispatch" },
  { name: "LKW-Einteilung Kurzstrecke", href: "/truck-dispatch/short-haul" },
  { name: "LKW-Einteilung Langstrecke", href: "/truck-dispatch/long-haul" },
  { name: "Mitarbeiterdisposition", href: "/employee-dispatch" },
  { name: "Sonderfahrzeuge", href: "/special-vehicle-dispatch" },
].sort((a, b) => a.name.localeCompare(b.name, "de-DE"));

const inventoryNavigation = [
  { name: "Erstprüfungen", href: "/inventory/initial-tests" },
  { name: "Inventarverwaltung", href: "/inventory" },
  { name: "Objekt anlegen", href: "/inventory/new" },
  { name: "Inventar importieren", href: "/inventory/imports" },
  { name: "Lagerverwaltung", href: "/inventory/storage" },
  { name: "Standortmeldungen", href: "/inventory/location-alerts" },
  { name: "Etikettenvorlagen", href: "/inventory/labels" },
  { name: "Scanner", href: "/inventory/scanner" },
].sort((a, b) => a.name.localeCompare(b.name, "de-DE"));

const controllingNavigation = [
  { name: "Leistungsmeldung", href: "/controlling/performance" },
  { name: "Verrechnungssätze", href: "/controlling/rates" },
].sort((a, b) => a.name.localeCompare(b.name, "de-DE"));

const safetyNavigation = [
  { name: "Beauftragungen", href: "/safety/commissions" },
  { name: "Betriebsunterweisungen", href: "/safety/operating-instructions" },
  { name: "Formularbuilder", href: "/form-builder?scope=SAFETY" },
  { name: "Formularvorlagen", href: "/safety/forms" },
  { name: "Gefahrstoffe", href: "/safety/hazardous-substances" },
  { name: "Gefährdungsbeurteilungen", href: "/safety/risk-assessments" },
  { name: "Unfallmeldungen", href: "/safety/accidents" },
].sort((a, b) => a.name.localeCompare(b.name, "de-DE"));

const employeeNavigation = [
  { name: "Führerscheinkontrolle", href: "/employees/driver-licenses" },
  { name: "Mitarbeiterakte", href: "/employees/certificates" },
  { name: "Mitarbeiterverwaltung", href: "/employees" },
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
        controllingNavigation={controllingNavigation}
        dispositionNavigation={dispositionNavigation}
        employeeNavigation={employeeNavigation}
        inventoryNavigation={inventoryNavigation}
        primaryNavigation={primaryNavigation}
        projectNavigation={projectNavigation}
        safetyNavigation={safetyNavigation}
        secondaryNavigation={secondaryNavigation}
        workshopNavigation={workshopNavigation}
      />

      <section className="w-full px-4 py-8 sm:px-6 lg:px-8 2xl:px-10">
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
