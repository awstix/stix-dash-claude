import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { requireSession } from "@/lib/auth-access";

type PersonalItem = {
  title: string;
  description: string;
  href: string;
  status?: "coming-soon";
};

type PersonalSection = {
  title: string;
  description: string;
  items: PersonalItem[];
};

const personalSections: PersonalSection[] = [
  {
    title: "Personalzeiten",
    description: "Erfasste Arbeitszeiten und Salden aller Mitarbeiter.",
    items: [
      {
        title: "Personalzeiten",
        description:
          "Alle erfassten Arbeitszeiten projektübergreifend, mit Filter nach Person, Baustelle und Zeitraum.",
        href: "/personal/zeiten",
      },
      {
        title: "Zeitkonten",
        description: "Arbeitszeit- und Urlaubskonto-Salden je Mitarbeiter.",
        href: "/personal/konten",
      },
      {
        title: "Monatskalender",
        description: "Soll-/Ist-Zeit, Pausen und Urlaub je Mitarbeiter und Tag.",
        href: "/personal/monatskalender",
      },
      {
        title: "Jahreskalender",
        description: "Jahresübersicht über Anwesenheit und Abwesenheit.",
        href: "/personal/jahreskalender",
      },
      {
        title: "Arbeitszeit",
        description: "Sommer-/Winter-Arbeitszeiten und Standard-Arbeitszeit verwalten.",
        href: "/admin/working-time",
      },
    ],
  },
  {
    title: "Abwesenheiten & Anträge",
    description: "Urlaub, Krankheit und sonstige Anträge.",
    items: [
      {
        title: "Abwesenheiten",
        description: "Alle Abwesenheiten (Urlaub, Krank, Schule, Innung u.a.) im Überblick.",
        href: "/personal/abwesenheiten",
      },
      {
        title: "Urlaubsanträge",
        description: "Urlaubs- und Abwesenheitsanträge stellen und freigeben.",
        href: "/leave-requests",
      },
    ],
  },
  {
    title: "Mitarbeiterverwaltung",
    description: "Stammdaten, Qualifikationen und Führerscheine.",
    items: [
      {
        title: "Mitarbeiterverwaltung",
        description: "Mitarbeiterstammdaten pflegen.",
        href: "/employees",
      },
      {
        title: "Mitarbeiterakte",
        description: "Qualifikationen, Unterweisungen und Dokumente je Mitarbeiter.",
        href: "/employees/certificates",
      },
      {
        title: "Führerscheinkontrolle",
        description: "Ablauf- und Kontrollfristen der Führerscheine im Blick behalten.",
        href: "/employees/driver-licenses",
      },
      {
        title: "Skills",
        description: "Schulungen und Qualifikationen aller Mitarbeiter im Überblick.",
        href: "/personal/skills",
      },
    ],
  },
  {
    title: "Sonstiges",
    description: "Zulagen, Formulare und Lohnexporte.",
    items: [
      {
        title: "Zulagen",
        description: "Zulagen je Mitarbeiter und Baustelle erfassen.",
        href: "/personal/zulagen",
        status: "coming-soon",
      },
      {
        title: "Exporte",
        description: "Lohnexporte für externe Lohnsoftware.",
        href: "/personal/exporte",
        status: "coming-soon",
      },
    ],
  },
];

export default async function PersonalPage() {
  await requireSession();

  return (
    <AppShell
      title="Personal"
      description="Zentraler Bereich für Zeiten, Abwesenheiten, Mitarbeiterverwaltung und alles rund um Personalthemen."
    >
      <div className="space-y-8">
        {personalSections.map((section) => (
          <section
            key={section.title}
            className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
          >
            <div className="mb-5">
              <h2 className="text-2xl font-bold text-gray-900">{section.title}</h2>
              <p className="mt-1 text-sm leading-6 text-gray-600">{section.description}</p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {section.items.map((item) =>
                item.status === "coming-soon" ? (
                  <div
                    key={item.href}
                    className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-5 opacity-70"
                  >
                    <div className="flex items-center gap-2">
                      <div className="text-lg font-semibold text-gray-700">{item.title}</div>
                      <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-600">
                        folgt
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-gray-500">{item.description}</p>
                  </div>
                ) : (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-2xl border border-gray-200 bg-gray-50 p-5 transition hover:-translate-y-1 hover:bg-white hover:shadow-md"
                  >
                    <div className="text-lg font-semibold text-gray-900">{item.title}</div>
                    <p className="mt-2 text-sm leading-6 text-gray-600">{item.description}</p>
                    <div className="mt-4 text-sm font-semibold text-gray-900">Öffnen →</div>
                  </Link>
                ),
              )}
            </div>
          </section>
        ))}
      </div>
    </AppShell>
  );
}
