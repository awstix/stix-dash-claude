import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { requireAdmin } from "@/lib/auth-access";

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
        title: "Portalbenutzer",
        description:
          "Benutzerkonten anlegen, mit Mitarbeiterakten verbinden und Administratorrollen vergeben.",
        href: "/admin/users",
      },
      {
        title: "Nutzerrollen",
        description:
          "Rechte je Rolle festlegen: Lesen, Erstellen, Bearbeiten, Löschen und Projekt-Scope für jeden Menüpunkt.",
        href: "/admin/permissions",
      },
      {
        title: "Kolonnen",
        description:
          "Kolonnen aus Mitarbeitern anhand Berufsgruppen erstellen, Standardpersonen und spätere Gerätezuordnungen verwalten.",
        href: "/admin/crews",
      },
      {
        title: "Zeiterfassung",
        description:
          "Standard für automatische Stundenfreigabe und Erinnerungsmails an die Bauleitung bei offenen Freigaben.",
        href: "/admin/time-tracking",
      },
      {
        title: "Arbeitszeit",
        description:
          "Planzeiten (Tages-Bausteine) und Jahreskalender verwalten.",
        href: "/admin/working-time",
      },
      {
        title: "Tätigkeiten für Zeiterfassung",
        description:
          "Katalog der Tätigkeiten, die Poliere/Mitarbeiter bei einer Kolonnen-Buchung auswählen (z. B. Arbeiten).",
        href: "/admin/working-time/taetigkeiten",
      },
      {
        title: "E-Mail-Versand",
        description:
          "SMTP-Zugangsdaten für Einladungs- und Passwort-E-Mails an neue Portalnutzer einrichten und testen.",
        href: "/admin/email-settings",
      },
    ],
  },
  {
    title: "Fuhrpark & LKW",
    description:
      "Fahrer und feste Fahrer-Fahrzeug-Zuordnungen. Fahrzeuge und Geräte werden zentral im Inventar gepflegt.",
    items: [
      {
        title: "Fahrer",
        description:
          "LKW-Fahrer verwalten. Wird zusätzlich automatisch über Mitarbeiter mit Berufsgruppe LKW Fahrer*in gepflegt.",
        href: "/admin/drivers",
      },
      {
        title: "Fahrer-Fahrzeug-Zuordnung",
        description:
          "Feste Fahrzeuge, freie Fahrzeuge und Fahrer-Fahrzeug-Kombinationen verwalten.",
        href: "/admin/driver-vehicles",
      },
    ],
  },
  {
    title: "Inventar",
    description:
      "Zentrale Inventargrundlage für Material, Asphalt, Anspritzmittel, Fahrzeuge, Maschinen, Lagerobjekte und Etiketten.",
    items: [
      {
        title: "Inventarkategorien",
        description:
          "Kategorien für Geräte, Maschinen, Werkzeuge, Lagerartikel und Containerobjekte pflegen.",
        href: "/admin/inventory-categories",
      },
      {
        title: "Inventarverantwortliche (persönlich)",
        description:
          "Personen auswählen, die persönliches Inventar ausgeben, zurücknehmen und quittieren dürfen.",
        href: "/admin/personal-inventory-managers",
      },
      {
        title: "Inventar importieren",
        description:
          "Materialien, Fahrzeuge, Sonderfahrzeuge, Maschinen und Lagerobjekte über eine zentrale Vorlage importieren.",
        href: "/inventory/imports",
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
          "Dropdown-Werte für Mitarbeiter, Arbeitsbereiche, Kolonnen und allgemeine Eingabefelder verwalten.",
        href: "/admin/options",
      },
    ],
  },
];

export default async function AdminPage() {
  await requireAdmin();
  return (
    <AppShell
      title="Admin"
      description="Zentrale Verwaltung für Unternehmen, Mitarbeiter, Kolonnen, Inventar und Auswahllisten."
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
