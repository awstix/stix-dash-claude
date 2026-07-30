export type DashboardWidgetDefinition = {
  category: string;
  description: string;
  href: string;
  key: string;
  subcategory: string;
  title: string;
};

export const dashboardWidgets = [
  { key: "projects", category: "Projekte", subcategory: "Übersicht", title: "Projekte", description: "Projektübersicht und Projektakten", href: "/projects" },
  { key: "project-photos", category: "Projekte", subcategory: "Fotos", title: "Projektfotos", description: "Neueste Fotos aus den freigegebenen Baustellen", href: "/projects/fotos" },
  { key: "project-map", category: "Projekte", subcategory: "Karte", title: "Projektkarte", description: "Zugeordnete Baustellen auf der Karte", href: "/projects" },
  { key: "daily-reports", category: "Projekte", subcategory: "Bautagesberichte", title: "Bautagesberichte", description: "Bautagesberichte erfassen und exportieren", href: "/projects/bautagesberichte" },

  { key: "crew-dispatch", category: "Disposition", subcategory: "Kolonnen", title: "Kolonnendisposition", description: "Kolonnen- und Wochenplanung", href: "/crew-dispatch" },
  { key: "project-crews-today", category: "Disposition", subcategory: "Baustellen heute", title: "Kolonnen auf Baustellen", description: "Heute eingeplante Kolonnen je Baustelle", href: "/crew-dispatch" },
  { key: "project-machines-today", category: "Disposition", subcategory: "Baustellen heute", title: "Maschinen auf Baustellen", description: "Heute zugeordnete Maschinen je Baustelle", href: "/equipment-dispatch" },
  { key: "project-trucks-today", category: "Disposition", subcategory: "Baustellen heute", title: "LKW auf Baustellen", description: "Heute eingeplante LKW je Baustelle", href: "/truck-dispatch" },
  { key: "project-materials-today", category: "Disposition", subcategory: "Baustellen heute", title: "Materiallieferungen auf Baustellen", description: "Heute geplante Materialien und Mengen je Baustelle", href: "/truck-dispatch" },
  { key: "asphalt-week", category: "Disposition", subcategory: "Asphalt", title: "Wochenzusammenfassung Asphalt", description: "Wochenmenge und Kolonnen auf einen Blick", href: "/asphalt-dispatch" },
  { key: "truck-dispatch", category: "Disposition", subcategory: "LKW", title: "LKW-Einteilung", description: "Kurz- und Langstreckenplanung", href: "/truck-dispatch" },
  { key: "absent-today", category: "Disposition", subcategory: "Mitarbeiter", title: "Heute abwesend", description: "Urlaub, Krank und Zeitausgleich", href: "/employee-dispatch" },
  { key: "vacation-today", category: "Disposition", subcategory: "Mitarbeiter", title: "Urlaub heute", description: "Genehmigte Urlaubsabwesenheiten", href: "/employee-dispatch?type=urlaub" },
  { key: "sick-today", category: "Disposition", subcategory: "Mitarbeiter", title: "Krank heute", description: "Aktuell krankgemeldete Mitarbeiter", href: "/employee-dispatch?type=krank" },
  { key: "checked-in", category: "Disposition", subcategory: "Mitarbeiterstatus", title: "Angemeldet", description: "Heute angemeldete Mitarbeiter", href: "/employee-dispatch" },
  { key: "checked-out", category: "Disposition", subcategory: "Mitarbeiterstatus", title: "Feierabend", description: "Heute abgemeldete Mitarbeiter", href: "/employee-dispatch" },
  { key: "not-checked-in", category: "Disposition", subcategory: "Mitarbeiterstatus", title: "Nicht angemeldet", description: "Heute noch nicht angemeldete Mitarbeiter", href: "/employee-dispatch" },

  { key: "employees", category: "Mitarbeiter", subcategory: "Akten", title: "Mitarbeiterakten", description: "Personalakten und Nachweise", href: "/employees/certificates" },
  { key: "leave-requests", category: "Mitarbeiter", subcategory: "Anträge", title: "Urlaubsanträge", description: "Urlaub und Zeitkonto beantragen", href: "/leave-requests" },
  { key: "leave-pending", category: "Mitarbeiter", subcategory: "Anträge", title: "Offene Anträge", description: "Urlaub und Zeitkonto zur Freigabe", href: "/leave-requests" },
  { key: "qualifications-due", category: "Mitarbeiter", subcategory: "Qualifikationen", title: "Fällige Berechtigungen", description: "Führerscheine und Qualifikationen bis 30 Tage", href: "/admin/employee-qualifications" },
  { key: "time-account", category: "Mitarbeiter", subcategory: "Zeitkonto", title: "Mein Zeitkonto", description: "Zeitguthaben und beantragter Zeitausgleich", href: "/leave-requests" },

  { key: "inventory", category: "Inventar", subcategory: "Übersicht", title: "Inventar", description: "Inventar- und Lagerverwaltung", href: "/inventory" },
  { key: "scanner", category: "Inventar", subcategory: "Scanner", title: "Inventarscanner", description: "QR- und Barcodes erfassen", href: "/inventory/scanner" },
  { key: "initial-tests", category: "Inventar", subcategory: "Prüfungen", title: "Erstprüfungen", description: "Gültigkeiten und Prüfungs-PDFs", href: "/inventory/initial-tests" },

  { key: "safety", category: "Arbeitssicherheit", subcategory: "Übersicht", title: "Arbeitssicherheit", description: "GBU, Unterweisungen und Beauftragungen", href: "/safety" },
  { key: "hazards", category: "Arbeitssicherheit", subcategory: "Gefahrstoffe", title: "Gefahrstoffe", description: "Gefahrstoffkataster und Dokumente", href: "/safety/hazardous-substances" },

  { key: "workshop", category: "Werkstatt", subcategory: "Aufträge", title: "Werkstatt", description: "Aufträge und Werkstattformulare", href: "/workshop" },
  { key: "orders", category: "Bestellungen", subcategory: "Übersicht", title: "Bestellungen", description: "Mischgut, Beton und Fremd-LKW", href: "/orders" },
  { key: "controlling", category: "Controlling", subcategory: "Leistungen", title: "Controlling", description: "Leistungen und Verrechnungssätze", href: "/controlling/performance" },
] satisfies readonly DashboardWidgetDefinition[];

export const defaultDashboardWidgetKeys = [
  "projects",
  "crew-dispatch",
  "employees",
  "inventory",
  "safety",
] as const;
