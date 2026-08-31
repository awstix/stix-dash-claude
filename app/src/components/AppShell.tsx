import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppHeader } from "./AppHeader";
import { GlobalFormFeedback } from "./GlobalFormFeedback";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { portalFeatureByPath } from "@/lib/portal-features";
import { getVisibleFeatureKeysForUser } from "@/lib/portal-permissions";
import { portalRoleLabels } from "@/lib/portal-roles";

type NavigationItem = { href: string; name: string };

/** Blendet Menüpunkte aus, für die die aktuelle Rollen-Kombination laut
 * Rechte-Matrix kein "Lesen" hat. Einträge ohne Katalog-Eintrag (z. B. Tippfehler
 * im Pfad) bleiben sicherheitshalber sichtbar, statt versehentlich zu verschwinden. */
function filterNavigationByVisibility(items: NavigationItem[], visibleFeatureKeys: Set<string> | "all") {
  if (visibleFeatureKeys === "all") return items;
  return items.filter((item) => {
    const feature = portalFeatureByPath.get(item.href);
    return !feature || visibleFeatureKeys.has(feature.featureKey);
  });
}

const primaryNavigation = [
  { name: "Dashboard", href: "/dashboard" },
];

const projectNavigation = [
  { name: "Bautagesberichte", href: "/projects/bautagesberichte" },
  { name: "Bedarf", href: "/projects/bedarf" },
  { name: "Dokumente", href: "/projects/dokumente" },
  { name: "Formulare", href: "/projects/formulare" },
  { name: "Fotos", href: "/projects/fotos" },
  { name: "Leistung", href: "/projects/performance" },
  { name: "Notizen", href: "/projects/notizen" },
  { name: "Projekte importieren", href: "/projects/imports" },
  { name: "Projektübersicht", href: "/projects" },
].sort((a, b) => a.name.localeCompare(b.name, "de-DE"));

const secondaryNavigation = [
  { name: "Bestellung", href: "/orders" },
  { name: "Admin", href: "/admin" },
].sort((a, b) => a.name.localeCompare(b.name, "de-DE"));

const workshopNavigation = [
  { name: "Formularvorlagen", href: "/workshop/forms" },
  { name: "Werkstattübersicht", href: "/workshop" },
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
  { name: "Aufträge", href: "/controlling/auftraege" },
  { name: "Ausstehende Schlussrechnungen", href: "/controlling/ausstehende-schlussrechnungen" },
  { name: "Bauleiterliste", href: "/controlling/bauleiterliste" },
  { name: "Beendete Baustellen", href: "/controlling/beendete-baustellen" },
  { name: "Leistungsmeldung", href: "/controlling/performance" },
  { name: "Verrechnungssätze", href: "/controlling/rates" },
].sort((a, b) => a.name.localeCompare(b.name, "de-DE"));

const safetyNavigation = [
  { name: "Beauftragungen", href: "/safety/commissions" },
  { name: "Betriebsunterweisungen", href: "/safety/operating-instructions" },
  { name: "Formularvorlagen", href: "/safety/forms" },
  { name: "Gefahrstoffe", href: "/safety/hazardous-substances" },
  { name: "Gefährdungsbeurteilungen", href: "/safety/risk-assessments" },
  { name: "Unfallmeldungen", href: "/safety/accidents" },
].sort((a, b) => a.name.localeCompare(b.name, "de-DE"));

const employeeNavigation = [
  { name: "Personal-Übersicht", href: "/personal" },
  { name: "Kolonnen-Zeiterfassung", href: "/crew-timekeeping" },
  { name: "Stundenkontrolle", href: "/crew-timekeeping/freigabe" },
  { name: "Personalzeiten", href: "/personal/zeiten" },
  { name: "Abwesenheiten", href: "/personal/abwesenheiten" },
  { name: "Zeitkonten", href: "/personal/konten" },
  { name: "Monatskalender", href: "/personal/monatskalender" },
  { name: "Jahreskalender", href: "/personal/jahreskalender" },
  { name: "Skills", href: "/personal/skills" },
  { name: "Arbeitszeit", href: "/admin/working-time" },
  { name: "Feiertage & arbeitsfreie Tage", href: "/disposition/holidays" },
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
  const visibleFeatureKeys = await getVisibleFeatureKeysForUser(session.user.role);
  const visibleSecondaryNavigation = filterNavigationByVisibility(
    secondaryNavigation.filter((item) => item.href !== "/admin"),
    visibleFeatureKeys,
  );
  const currentUserRoleLabel = (await portalRoleLabels(session.user.role)).join(" / ");
  const [unreadNotificationCount, unreadChangelogCount] = await Promise.all([
    admin ? prisma.notification.count({ where: { read: false } }) : 0,
    prisma.changelogEntry.count({
      where: { reads: { none: { userId: session.user.id } } },
    }),
  ]);

  return (
    <main className="min-h-screen bg-gray-100">
      <AppHeader
        companyLogoUrl={company?.logoPublicUrl ?? null}
        companyName={company?.companyName ?? "Stix"}
        currentUserName={session.user.name}
        currentUserRoleLabel={currentUserRoleLabel}
        controllingNavigation={filterNavigationByVisibility(controllingNavigation, visibleFeatureKeys)}
        dispositionNavigation={filterNavigationByVisibility(dispositionNavigation, visibleFeatureKeys)}
        employeeNavigation={filterNavigationByVisibility(employeeNavigation, visibleFeatureKeys)}
        inventoryNavigation={filterNavigationByVisibility(inventoryNavigation, visibleFeatureKeys)}
        primaryNavigation={primaryNavigation}
        projectNavigation={filterNavigationByVisibility(projectNavigation, visibleFeatureKeys)}
        safetyNavigation={filterNavigationByVisibility(safetyNavigation, visibleFeatureKeys)}
        secondaryNavigation={visibleSecondaryNavigation}
        showAdminLink={admin}
        unreadChangelogCount={unreadChangelogCount}
        unreadNotificationCount={unreadNotificationCount}
        workshopNavigation={filterNavigationByVisibility(workshopNavigation, visibleFeatureKeys)}
      />

      <section className="w-full px-4 py-8 sm:px-6 lg:px-8 2xl:px-10">
        <div className="mb-8">
          <h1 className="break-words text-3xl font-bold text-gray-900">{title}</h1>
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
