import Link from "next/link";

import { ActionIcon } from "@/components/ActionIcon";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";

import { restoreSafetyInstructionRecord } from "../../actions";
import { PermanentDeleteButton } from "./PermanentDeleteButton";

export default async function CommissionArchivePage() {
  const records = await prisma.safetyInstructionRecord.findMany({
    include: {
      project: { select: { name: true, projectNumber: true } },
      template: { select: { title: true } },
    },
    orderBy: { archivedAt: "desc" },
    where: { archivedAt: { not: null }, template: { type: "COMMISSION" } },
  });
  return (
    <AppShell description="Archivierte Beauftragungen wiederherstellen oder administrativ endgültig löschen." title="Archiv · Beauftragungen">
      <div className="mb-5">
        <Link className="rounded-xl bg-gray-950 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-gray-800" href="/safety/commissions">← Beauftragungen</Link>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-gray-300 bg-white">
        <table className="w-full min-w-[850px] text-left text-sm text-black">
          <thead className="bg-gray-200"><tr><th className="p-3">Aktionen</th><th className="p-3">Beauftragung</th><th className="p-3">Datum</th><th className="p-3">Projekt</th><th className="p-3">Archiviert</th></tr></thead>
          <tbody>
            {records.map((record) => (
              <tr className="border-t border-gray-200" key={record.id}>
                <td className="p-3"><div className="flex gap-2">
                  <form action={restoreSafetyInstructionRecord}>
                    <input name="recordId" type="hidden" value={record.id} />
                    <button className="rounded-lg border border-gray-300 p-2" title="Wiederherstellen"><ActionIcon name="save" /></button>
                  </form>
                  <PermanentDeleteButton recordId={record.id} />
                </div></td>
                <td className="p-3 font-semibold">{record.template.title}</td>
                <td className="p-3">{record.instructionDate.toLocaleDateString("de-DE")}</td>
                <td className="p-3">{record.project ? `${record.project.projectNumber} · ${record.project.name}` : "–"}</td>
                <td className="p-3">{record.archivedAt?.toLocaleString("de-DE")}</td>
              </tr>
            ))}
            {!records.length ? <tr><td className="p-6 text-center text-gray-600" colSpan={5}>Das Archiv ist leer.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
