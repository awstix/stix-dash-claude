export const dashboardWidgets = [
  { key: "projects", title: "Projekte", description: "Projektübersicht und Projektakten", href: "/projects" },
  { key: "daily-reports", title: "Bautagesberichte", description: "Bautagesberichte erfassen und exportieren", href: "/projects/bautagesberichte" },
  { key: "crew-dispatch", title: "Disposition", description: "Kolonnen- und Wochenplanung", href: "/crew-dispatch" },
  { key: "truck-dispatch", title: "LKW-Einteilung", description: "Kurz- und Langstreckenplanung", href: "/truck-dispatch" },
  { key: "employees", title: "Mitarbeiterakten", description: "Personalakten und Nachweise", href: "/employees/certificates" },
  { key: "leave-requests", title: "Urlaubsanträge", description: "Urlaub beantragen und Freigaben bearbeiten", href: "/leave-requests" },
  { key: "inventory", title: "Inventar", description: "Inventar- und Lagerverwaltung", href: "/inventory" },
  { key: "scanner", title: "Inventarscanner", description: "QR- und Barcodes erfassen", href: "/inventory/scanner" },
  { key: "initial-tests", title: "Erstprüfungen", description: "Gültigkeiten und Prüfungs-PDFs", href: "/inventory/initial-tests" },
  { key: "safety", title: "Arbeitssicherheit", description: "GBU, Unterweisungen und Beauftragungen", href: "/safety" },
  { key: "hazards", title: "Gefahrstoffe", description: "Gefahrstoffkataster und Dokumente", href: "/safety/hazardous-substances" },
  { key: "workshop", title: "Werkstatt", description: "Aufträge und Werkstattformulare", href: "/workshop" },
  { key: "orders", title: "Bestellungen", description: "Mischgut, Beton und Fremd-LKW", href: "/orders" },
  { key: "controlling", title: "Controlling", description: "Leistungen und Verrechnungssätze", href: "/controlling/performance" },
] as const;

export const defaultDashboardWidgetKeys = [
  "projects",
  "crew-dispatch",
  "employees",
  "inventory",
  "safety",
] as const;
