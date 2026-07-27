import Link from "next/link";
import { AppShell } from "@/components/AppShell";

export default function RiskAssessmentsPage() {
  return (
    <AppShell title="Gefährdungsbeurteilungen" description="Projektbezogene Beurteilungen am Rechner oder Tablet ausfüllen, unterschreiben und als PDF speichern.">
      <div className="grid gap-5 md:grid-cols-2">
        <Link className="rounded-3xl border border-gray-300 bg-white p-6 shadow-sm hover:border-gray-500" href="/safety/risk-assessments/project-start">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Als Erstes ausfüllen</p>
          <h2 className="mt-2 text-xl font-bold text-black">Projektstart – Tiefbau / Asphaltbau</h2>
          <p className="mt-2 text-sm leading-6 text-gray-700">A-30-30-001 mit Projektangaben, Tätigkeiten, 31 LMRA-Prüfpunkten und Mitarbeiterunterschriften.</p>
          <span className="mt-5 inline-flex rounded-xl bg-gray-950 px-4 py-2 font-bold text-white">Checklisten öffnen →</span>
        </Link>
        <Link className="rounded-3xl border border-gray-300 bg-white p-6 shadow-sm hover:border-gray-500" href="/safety/risk-assessments/templates">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Weitere Vorlagen</p>
          <h2 className="mt-2 text-xl font-bold text-black">Gefährdungsbeurteilungen verwalten</h2>
          <p className="mt-2 text-sm leading-6 text-gray-700">Weitere allgemeine Vorlagen anlegen und Unterweisungen starten.</p>
        </Link>
      </div>
    </AppShell>
  );
}
