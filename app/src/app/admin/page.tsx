import Link from "next/link";
import { AppShell } from "@/components/AppShell";

type AdminItem = {
  title: string;
  description: string;
  href: string;
};

type AdminSection = {
  title: string;
  description: string;
  items: AdminItem[];
};

const adminSections: AdminSection[] = [
  {
    title: "Unternehmen",
    description:
      "Zentrale Firmenangaben für Formulare, PDF-Ausgaben und Außenkommunikation.",
    items: [
      {
        title: "Firmeninfos",
        description:
          "Logo, Anschrift, Kontakt, Website, Social Media und rechtliche Angaben zentral pflegen.",
        href: "/admin/company-info",
      },
      {
        title: "Datensicherung & Reset",
        description:
          "Datenbank-Backup herunterladen und das Dashboard kontrolliert für einen sauberen Neustart leeren.",
        href: "/admin/backup-reset",
      },
    ],
  },
  {
    title: "Mitarbeiter",
    description:
      "Arbeitszeiten, Berufsgruppen, Kolonnen und mitarbeiterbezogene Zusatzdaten.",
    items: [
      {
        title: "Kolonnen",
        description:
          "Kolonnen aus Mitarbeitern anhand Berufsgruppen erstellen, Standardpersonen und spätere Gerätezuordnungen verwalten.",
        href: "/admin/crews",
      },
      {
        title: "Arbeitszeit",
        description:
          "Sommer-/Winter-Arbeitszeiten und Standard-Arbeitszeit für LKW- und Kolonnen-Zeitstrahlen verwalten.",
        href: "/admin/working-time",
      },
    ],
  },
  {
    title: "Fuhrpark & LKW",
    description: "Fahrer, Fahrzeuge und feste Fahrer-Fahrzeug-Zuordnungen.",
    items: [
      {
        title: "Fahrer",
        description:
          "LKW-Fahrer verwalten. Wird zusätzlich automatisch über Mitarbeiter mit Berufsgruppe LKW Fahrer*in gepflegt.",
        href: "/admin/drivers",
      },
      {
        title: "Fahrzeuge",
        description:
          "Fahrzeuge, Kennzeichen, Fahrzeugtypen, Kategorien und Sonderfahrzeuge verwalten.",
        href: "/admin/vehicles",
      },
      {
        title: "Fahrer-Fahrzeug-Zuordnung",
        description:
          "Stammfahrzeuge, freie Fahrzeuge und feste Fahrer-Fahrzeug-Kombinationen verwalten.",
        href: "/admin/driver-vehicles",
      },
    ],
  },
  {
    title: "Inventar",
    description:
      "Kategorien und Grunddaten für Inventar, Lagerobjekte und spätere Etiketten.",
    items: [
      {
        title: "Inventarkategorien",
        description:
          "Kategorien für Geräte, Maschinen, Werkzeuge, Lagerartikel und Containerobjekte pflegen.",
        href: "/admin/inventory-categories",
      },
    ],
  },
  {
    title: "Material & Sorten",
    description: "Materialien, Asphalt- und Betonsorten verwalten.",
    items: [
      {
        title: "Materialliste",
        description:
          "Materialien mit Materialnummer, Kategorie, Einheit und Bemerkung verwalten.",
        href: "/admin/materials",
      },
      {
        title: "Asphaltsorten",
        description:
          "Asphaltsorten mit Sortennummer, Einheit, Kategorie und Mischanlage verwalten.",
        href: "/admin/asphalt-types",
      },
      {
        title: "Anspritzmittel",
        description:
          "Haftkleber und Anspritzmittel getrennt von normalen Materialien und Asphaltsorten verwalten.",
        href: "/admin/tack-coat-types",
      },
      {
        title: "Betonsorten",
        description:
          "Betonsorten mit Festigkeitsklasse, Expositionsklasse, Körnung, Konsistenz und Einheit verwalten.",
        href: "/admin/concrete-types",
      },
    ],
  },
  {
    title: "Auswahllisten",
    description: "Zentrale Dropdown-Werte und Grundoptionen.",
    items: [
      {
        title: "Auswahllisten",
        description:
          "Dropdown-Werte für Mitarbeiter, Fahrzeuge, Material, Asphalt, Beton und Kolonnen verwalten.",
        href: "/admin/options",
      },
    ],
  },
];

export default function AdminPage() {
  return (
    <AppShell
      title="Admin"
      description="Zentrale Verwaltung für Stammdaten, Mitarbeiter, Kolonnen, Fuhrpark, Material und Auswahllisten."
    >
      <div className="space-y-8">
        {adminSections.map((section) => (
          <section
            key={section.title}
            className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
          >
            <div className="mb-5">
              <h2 className="text-2xl font-bold text-gray-900">
                {section.title}
              </h2>
              <p className="mt-1 text-sm leading-6 text-gray-600">
                {section.description}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-2xl border border-gray-200 bg-gray-50 p-5 transition hover:-translate-y-1 hover:bg-white hover:shadow-md"
                >
                  <div className="text-lg font-semibold text-gray-900">
                    {item.title}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-gray-600">
                    {item.description}
                  </p>
                  <div className="mt-4 text-sm font-semibold text-gray-900">
                    Öffnen →
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </AppShell>
  );
}
