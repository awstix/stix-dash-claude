import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppHeader } from "./AppHeader";
import { GlobalFormFeedback } from "./GlobalFormFeedback";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
  { name: "Kolonnen-Zeiterfassung", href: "/crew-timekeeping" },
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
  { name: "Bauleiterliste", href: "/controlling/bauleiterliste" },
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
  { name: "Personal-Übersicht", href: "/personal" },
  { name: "Personalzeiten", href: "/personal/zeiten" },
  { name: "Abwesenheiten", href: "/personal/abwesenheiten" },
  { name: "Zeitkonten", href: "/personal/konten" },
  { name: "Monatskalender", href: "/personal/monatskalender" },
  { name: "Jahreskalender", href: "/personal/jahreskalender" },
  { name: "Skills", href: "/personal/skills" },
  { name: "Arbeitszeit", href: "/admin/working-time" },
  { name: "Führerscheinkontrolle", href: "/employees/driver-licenses" },
  { name: "Mitarbeiterakte", href: "/employees/certificates" },
  { name: "Mitarbeiterverwaltung", href: "/employees" },
  { name: "Urlaubsanträge", href: "/leave-requests" },
];

export async function AppShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const [session, company] = await Promise.all([
    auth.api.getSession({ headers: await headers() }),
    prisma.companyInfo.findUnique({
      select: {
        companyName: true,
        logoPublicUrl: true,
      },
      where: { id: "default" },
    }),
  ]);
  if (!session) redirect("/login");
  const roles = new Set(
    String(session.user.role ?? "")
      .split(",")
      .map((role) => role.trim()),
  );
  const admin = roles.has("admin");
  const foreman = roles.has("foreman") && !admin;
  const visibleProjectNavigation = foreman
    ? projectNavigation.filter(
        (item) =>
          item.href !== "/projects/performance" &&
          !item.href.startsWith("/form-builder"),
      )
    : projectNavigation;
  const visibleWorkshopNavigation = foreman
    ? workshopNavigation.filter((item) => !item.href.startsWith("/form-builder"))
    : workshopNavigation;
  const visibleSafetyNavigation = foreman
    ? safetyNavigation.filter((item) => !item.href.startsWith("/form-builder"))
    : safetyNavigation;
  const visibleSecondaryNavigation = secondaryNavigation.filter(
    (item) => item.href !== "/admin" || admin,
  );

  return (
    <main className="min-h-screen bg-gray-100">
      <AppHeader
        companyLogoUrl={company?.logoPublicUrl ?? null}
        companyName={company?.companyName ?? "Stix"}
        currentUserName={session.user.name}
        controllingNavigation={controllingNavigation}
        dispositionNavigation={dispositionNavigation}
        employeeNavigation={employeeNavigation}
        inventoryNavigation={inventoryNavigation}
        primaryNavigation={primaryNavigation}
        projectNavigation={visibleProjectNavigation}
        safetyNavigation={visibleSafetyNavigation}
        secondaryNavigation={visibleSecondaryNavigation}
        workshopNavigation={visibleWorkshopNavigation}
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
