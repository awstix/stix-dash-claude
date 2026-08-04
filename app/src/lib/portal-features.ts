/** Katalog aller Menüpunkte/Kacheln des Portals, gruppiert wie in der
 * Kopfnavigation (AppShell/AppHeader) bzw. auf der Admin-Startseite.
 * Einzige Quelle der Wahrheit für die Rechte-Matrix unter
 * Admin > Mitarbeiter > Nutzerrollen. moduleKey/featureKey sind stabile,
 * sprechende IDs (nicht der Pfad), damit Umbenennungen im Menü die
 * gespeicherten Rechte nicht verwaisen lassen.
 *
 * Bewusst ohne DB-Zugriff (kein `prisma`-Import): diese Datei wird auch von
 * Client Components importiert (z. B. PermissionMatrixEditor). Die
 * DB-gestützte Sichtbarkeitsprüfung lebt separat in portal-permissions.ts. */

export type PortalFeature = {
  key: string;
  label: string;
  path: string;
  group?: string;
};

export type PortalModule = {
  key: string;
  label: string;
  note?: string;
  features: PortalFeature[];
};

export const portalModules: PortalModule[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    features: [{ key: "dashboard", label: "Dashboard", path: "/dashboard" }],
  },
  {
    key: "projekte",
    label: "Projekte",
    features: [
      { key: "projektuebersicht", label: "Projektübersicht", path: "/projects" },
      { key: "bautagesberichte", label: "Bautagesberichte", path: "/projects/bautagesberichte" },
      { key: "bedarf", label: "Bedarf", path: "/projects/bedarf" },
      { key: "dokumente", label: "Dokumente", path: "/projects/dokumente" },
      { key: "fotos", label: "Fotos", path: "/projects/fotos" },
      { key: "notizen", label: "Notizen", path: "/projects/notizen" },
      { key: "formulare", label: "Formulare", path: "/projects/formulare" },
      { key: "formularbuilder", label: "Formularbuilder", path: "/form-builder?scope=PROJECT" },
      { key: "leistung", label: "Leistung", path: "/projects/performance" },
    ],
  },
  {
    key: "disposition",
    label: "Disposition",
    features: [
      { key: "planung", label: "Planung (Kolonnen)", path: "/crew-dispatch" },
      { key: "mitarbeiterdisposition", label: "Mitarbeiterdisposition", path: "/employee-dispatch" },
      { key: "geraetedisposition", label: "Gerätedisposition", path: "/equipment-dispatch" },
      { key: "sonderfahrzeuge", label: "Sonderfahrzeuge", path: "/special-vehicle-dispatch" },
      { key: "asphaltdisposition", label: "Asphaltdisposition", path: "/asphalt-dispatch" },
      { key: "lkw_einteilung", label: "LKW-Einteilung", path: "/truck-dispatch" },
      { key: "lkw_einteilung_kurzstrecke", label: "LKW-Einteilung Kurzstrecke", path: "/truck-dispatch/short-haul" },
      { key: "lkw_einteilung_langstrecke", label: "LKW-Einteilung Langstrecke", path: "/truck-dispatch/long-haul" },
      { key: "kolonnen_zeiterfassung", label: "Kolonnen-Zeiterfassung", path: "/crew-timekeeping" },
    ],
  },
  {
    key: "inventar",
    label: "Inventar",
    features: [
      { key: "inventarverwaltung", label: "Inventarverwaltung", path: "/inventory" },
      { key: "objekt_anlegen", label: "Objekt anlegen", path: "/inventory/new" },
      { key: "inventar_importieren", label: "Inventar importieren", path: "/inventory/imports" },
      { key: "lagerverwaltung", label: "Lagerverwaltung", path: "/inventory/storage" },
      { key: "standortmeldungen", label: "Standortmeldungen", path: "/inventory/location-alerts" },
      { key: "erstpruefungen", label: "Erstprüfungen", path: "/inventory/initial-tests" },
      { key: "etikettenvorlagen", label: "Etikettenvorlagen", path: "/inventory/labels" },
      { key: "scanner", label: "Scanner", path: "/inventory/scanner" },
    ],
  },
  {
    key: "controlling",
    label: "Controlling",
    features: [
      { key: "auftraege", label: "Aufträge", path: "/controlling/auftraege" },
      { key: "leistungsmeldung", label: "Leistungsmeldung", path: "/controlling/performance" },
      { key: "verrechnungssaetze", label: "Verrechnungssätze", path: "/controlling/rates" },
      { key: "bauleiterliste", label: "Bauleiterliste", path: "/controlling/bauleiterliste" },
      { key: "beendete_baustellen", label: "Beendete Baustellen", path: "/controlling/beendete-baustellen" },
      {
        key: "ausstehende_schlussrechnungen",
        label: "Ausstehende Schlussrechnungen",
        path: "/controlling/ausstehende-schlussrechnungen",
      },
    ],
  },
  {
    key: "arbeitssicherheit",
    label: "Arbeitssicherheit",
    features: [
      { key: "gefaehrdungsbeurteilungen", label: "Gefährdungsbeurteilungen", path: "/safety/risk-assessments" },
      { key: "betriebsunterweisungen", label: "Betriebsunterweisungen", path: "/safety/operating-instructions" },
      { key: "unfallmeldungen", label: "Unfallmeldungen", path: "/safety/accidents" },
      { key: "gefahrstoffe", label: "Gefahrstoffe", path: "/safety/hazardous-substances" },
      { key: "beauftragungen", label: "Beauftragungen", path: "/safety/commissions" },
      { key: "formularvorlagen_sicherheit", label: "Formularvorlagen", path: "/safety/forms" },
      { key: "formularbuilder_sicherheit", label: "Formularbuilder", path: "/form-builder?scope=SAFETY" },
    ],
  },
  {
    key: "werkstatt",
    label: "Werkstatt",
    features: [
      { key: "werkstattuebersicht", label: "Werkstattübersicht", path: "/workshop" },
      { key: "formularvorlagen_werkstatt", label: "Formularvorlagen", path: "/workshop/forms" },
      { key: "formularbuilder_werkstatt", label: "Formularbuilder", path: "/form-builder?scope=WORKSHOP" },
    ],
  },
  {
    key: "personal",
    label: "Personal",
    features: [
      { key: "personal_uebersicht", label: "Personal-Übersicht", path: "/personal" },
      { key: "personalzeiten", label: "Personalzeiten", path: "/personal/zeiten" },
      { key: "abwesenheiten", label: "Abwesenheiten", path: "/personal/abwesenheiten" },
      { key: "zeitkonten", label: "Zeitkonten", path: "/personal/konten" },
      { key: "monatskalender", label: "Monatskalender", path: "/personal/monatskalender" },
      { key: "jahreskalender", label: "Jahreskalender", path: "/personal/jahreskalender" },
      { key: "skills", label: "Skills", path: "/personal/skills" },
      { key: "arbeitszeit", label: "Arbeitszeit (Vorlagen & Kalender)", path: "/admin/working-time" },
      { key: "feiertage", label: "Feiertage & arbeitsfreie Tage", path: "/disposition/holidays" },
      { key: "fuehrerscheinkontrolle", label: "Führerscheinkontrolle", path: "/employees/driver-licenses" },
      { key: "mitarbeiterakte", label: "Mitarbeiterakte", path: "/employees/certificates" },
      { key: "mitarbeiterverwaltung", label: "Mitarbeiterverwaltung", path: "/employees" },
      { key: "urlaubsantraege", label: "Urlaubsanträge", path: "/leave-requests" },
    ],
  },
  {
    key: "bestellung",
    label: "Bestellung",
    features: [{ key: "bestellung", label: "Bestellung", path: "/orders" }],
  },
  {
    key: "admin",
    label: "Admin",
    note: "Kacheln der Admin-Startseite, gruppiert wie dort dargestellt.",
    features: [
      { key: "firmeninfos", label: "Firmeninfos", path: "/admin/company-info", group: "Unternehmen" },
      { key: "datensicherung", label: "Datensicherung & Reset", path: "/admin/backup-reset", group: "Unternehmen" },
      { key: "portalbenutzer", label: "Portalbenutzer", path: "/admin/users", group: "Mitarbeiter" },
      { key: "nutzerrollen", label: "Nutzerrollen", path: "/admin/permissions", group: "Mitarbeiter" },
      { key: "kolonnen", label: "Kolonnen", path: "/admin/crews", group: "Mitarbeiter" },
      { key: "zeiterfassung_regeln", label: "Zeiterfassung (Freigabe-Regeln)", path: "/admin/time-tracking", group: "Mitarbeiter" },
      { key: "fahrer", label: "Fahrer", path: "/admin/drivers", group: "Fuhrpark & LKW" },
      { key: "fahrer_fahrzeug", label: "Fahrer-Fahrzeug-Zuordnung", path: "/admin/driver-vehicles", group: "Fuhrpark & LKW" },
      { key: "inventarkategorien", label: "Inventarkategorien", path: "/admin/inventory-categories", group: "Inventar" },
      {
        key: "inventarverantwortliche",
        label: "Inventarverantwortliche (persönlich)",
        path: "/admin/personal-inventory-managers",
        group: "Inventar",
      },
      { key: "auswahllisten", label: "Auswahllisten", path: "/admin/options", group: "Auswahllisten" },
      {
        key: "mitarbeiterqualifikationen",
        label: "Mitarbeiterqualifikationen",
        path: "/admin/employee-qualifications",
        group: "Sonstiges",
      },
    ],
  },
];

export const portalModuleByKey = new Map(portalModules.map((module) => [module.key, module]));

export function findPortalFeature(moduleKey: string, featureKey: string) {
  return portalModuleByKey.get(moduleKey)?.features.find((feature) => feature.key === featureKey);
}

/** Pfad -> Modul/Feature, zum Filtern der Kopfnavigation nach Rechten. Bei
 * mehrfach vorkommenden Pfaden (z. B. Arbeitszeit auch unter Personal) zählt
 * der erste Treffer. */
export const portalFeatureByPath = new Map(
  portalModules.flatMap((portalModule) =>
    portalModule.features.map((feature) => [
      feature.path,
      { featureKey: feature.key, moduleKey: portalModule.key },
    ] as const),
  ),
);
