import Link from "next/link";

import { AppShell } from "@/components/AppShell";

const safetyCards = [
  {
    href: "/safety/accidents",
    title: "Unfallmeldungen",
    description:
      "Unfälle sofort erfassen, Fotos per Handy aufnehmen und den Meldeprozess nachvollziehbar dokumentieren.",
    meta: "Sofortmeldung · Fotos · Prozess",
  },
  {
    href: "/safety/risk-assessments",
    title: "Gefährdungsbeurteilungen",
    description:
      "Projekt- und mitarbeiterbezogene Unterweisungen aus Gefährdungsbeurteilungen durchführen und unterschreiben lassen.",
    meta: "Projekt · Mitarbeiter · Unterschriften",
  },
  {
    href: "/safety/operating-instructions",
    title: "Betriebsunterweisungen",
    description:
      "Betriebsanweisungen als Unterweisung öffnen, Bereiche abhaken und Teilnehmer digital unterschreiben lassen.",
    meta: "Vorlagen · Unterweisung · Nachweis",
  },
  {
    href: "/safety/commissions",
    title: "Beauftragungen",
    description:
      "Beauftragungen für Tätigkeiten, Maschinen oder Verantwortungsbereiche dokumentieren und von Mitarbeitern bestätigen lassen.",
    meta: "Beauftragung · Mitarbeiter · Unterschrift",
  },
  {
    href: "/safety/hazardous-substances",
    title: "Gefahrstoffe",
    description:
      "Gefahrstoffkataster pflegen und die passenden Sicherheitsdatenblätter direkt am Stoff hinterlegen.",
    meta: "Kataster · Sicherheitsdatenblätter",
  },
];

export default function SafetyPage() {
  return (
    <AppShell
      title="Arbeitssicherheit"
      description="Zentrale Übersicht für Unfallmeldungen, Gefährdungsbeurteilungen und Betriebsunterweisungen."
    >
      <div className="grid gap-4 lg:grid-cols-3">
        {safetyCards.map((card) => (
          <Link
            className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-yellow-300 hover:shadow-md"
            href={card.href}
            key={card.href}
          >
            <p className="text-xs font-bold uppercase tracking-wide text-yellow-700">
              {card.meta}
            </p>
            <h2 className="mt-3 text-2xl font-bold text-gray-950">
              {card.title}
            </h2>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              {card.description}
            </p>
            <span className="mt-6 inline-flex rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white">
              Öffnen →
            </span>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
