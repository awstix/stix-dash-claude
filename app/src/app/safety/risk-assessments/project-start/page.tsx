import Link from "next/link";

import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ProjectStartChecklistPage() {
  const checklists = await prisma.projectStartChecklist.findMany({
    include: { project: true, participants: true },
    orderBy: [{ checklistDate: "desc" }, { createdAt: "desc" }],
  });
  return (
    <AppShell title="Projektstart-Checklisten" description="A-30-30-001 projektbezogen ausfüllen, unterschreiben und als PDF ablegen.">
      <div className="mb-6 flex flex-wrap justify-between gap-3">
        <Link className="rounded-xl border border-gray-300 bg-white px-4 py-2 font-bold text-black" href="/safety/risk-assessments">← Gefährdungsbeurteilungen</Link>
        <Link className="rounded-xl bg-gray-950 px-5 py-3 font-bold text-white" href="/safety/risk-assessments/project-start/new">+ Neue Projektstart-Checkliste</Link>
      </div>
      <section className="overflow-hidden rounded-2xl border border-gray-300 bg-white">
        <table className="min-w-full text-left text-sm text-black">
          <thead className="bg-gray-200"><tr><th className="p-3">Projekt</th><th className="p-3">Datum</th><th className="p-3">Status</th><th className="p-3">Unterschriften</th><th className="p-3">Aktionen</th></tr></thead>
          <tbody>
            {checklists.map((item) => <tr className="border-t border-gray-200" key={item.id}>
              <td className="p-3 font-bold">{item.project.projectNumber} · {item.project.name}</td>
              <td className="p-3">{item.checklistDate.toLocaleDateString("de-DE")}</td>
              <td className="p-3">{item.status === "COMPLETED" ? "Abgeschlossen" : "Entwurf"}</td>
              <td className="p-3">{item.participants.filter((p) => p.signatureDataUrl).length}/{item.participants.length}</td>
              <td className="p-3"><div className="flex gap-2"><Link className="rounded-lg border border-gray-300 px-3 py-2 font-bold" href={`/safety/risk-assessments/project-start/${item.id}`}>Öffnen</Link><a className="rounded-lg border border-gray-300 px-3 py-2 font-bold" href={`/safety/risk-assessments/project-start/${item.id}/pdf`}>PDF</a></div></td>
            </tr>)}
            {!checklists.length ? <tr><td className="p-8 text-center text-gray-600" colSpan={5}>Noch keine Projektstart-Checkliste gespeichert.</td></tr> : null}
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}
