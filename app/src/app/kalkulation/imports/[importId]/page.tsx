import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { getAiSettings, isAiConfigured } from "@/lib/kalkulation-ai-settings";
import { confirmMatch, createPositionFromLineItem, manualMatch, rejectMatch, runMatching } from "../actions";

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Offen", className: "bg-gray-100 text-gray-700" },
  SUGGESTED: { label: "Vorschlag", className: "bg-blue-100 text-blue-800" },
  NEEDS_REVIEW: { label: "Prüfen", className: "bg-amber-100 text-amber-900" },
  CONFIRMED: { label: "Bestätigt", className: "bg-green-100 text-green-800" },
  REJECTED: { label: "Abgelehnt", className: "bg-red-100 text-red-800" },
  NO_MATCH: { label: "Kein Treffer", className: "bg-gray-100 text-gray-600" },
};

function formatCents(cents: number | null) {
  if (cents == null) return "–";
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);
}

export default async function KalkulationImportReviewPage({
  params,
}: {
  params: Promise<{ importId: string }>;
}) {
  const { importId } = await params;

  const [lvImport, lineItems, positions, aiSettings] = await Promise.all([
    prisma.kalkulationLvImport.findUnique({ where: { id: importId } }),
    prisma.kalkulationLvLineItem.findMany({
      where: { lvImportId: importId },
      include: { matchedPosition: true },
      orderBy: { rowNumber: "asc" },
    }),
    prisma.kalkulationPosition.findMany({
      where: { isActive: true },
      orderBy: { title: "asc" },
    }),
    getAiSettings(),
  ]);

  if (!lvImport) notFound();

  const aiConfigured = isAiConfigured(aiSettings);
  const projectLabel = [lvImport.projectNumber, lvImport.tenderTitle].filter(Boolean).join(" – ");

  return (
    <AppShell
      description={projectLabel ? `${lvImport.fileName} · ${projectLabel}` : lvImport.fileName}
      title="LV-Abgleich"
    >
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          href="/kalkulation/imports"
        >
          ← Alle Imports
        </Link>

        <form action={runMatching}>
          <input name="importId" type="hidden" value={importId} />
          <button
            className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!aiConfigured}
            title={aiConfigured ? undefined : "KI-Anbieter zuerst unter Admin > KI-Einstellungen einrichten"}
            type="submit"
          >
            KI-Abgleich starten
          </button>
        </form>

        {!aiConfigured ? (
          <span className="text-sm text-amber-800">
            KI nicht konfiguriert -{" "}
            <Link className="underline" href="/admin/kalkulation-ai-settings">
              einrichten
            </Link>
          </span>
        ) : null}
      </div>

      <section className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="p-3">OZ</th>
              <th className="p-3">Kurztext</th>
              <th className="p-3">Langtext</th>
              <th className="p-3">LV-Menge</th>
              <th className="p-3">Mengeneinheit</th>
              <th className="p-3">EP</th>
              <th className="p-3">Vorschlag</th>
              <th className="p-3">Status</th>
              <th className="p-3">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item) => {
              if (item.entryType === "TITLE") {
                return (
                  <tr key={item.id}>
                    <td className="bg-gray-900 p-3 font-bold text-white" colSpan={9}>
                      {item.rawText}
                    </td>
                  </tr>
                );
              }

              if (item.entryType === "REMARK") {
                return (
                  <tr key={item.id}>
                    <td className="whitespace-pre-line bg-amber-50 p-3 text-sm italic text-amber-950" colSpan={9}>
                      <span className="font-bold not-italic">Vorbemerkung: </span>
                      {item.rawText}
                    </td>
                  </tr>
                );
              }

              const status = STATUS_LABELS[item.matchStatus] ?? STATUS_LABELS.PENDING;
              return (
                <tr className="border-t border-gray-100 align-top" key={item.id}>
                  <td className="p-3 text-gray-500">{item.positionNumber ?? "–"}</td>
                  <td className="p-3 max-w-xs font-semibold text-gray-900">{item.shortText ?? "–"}</td>
                  <td className="p-3 max-w-sm text-gray-700">{item.rawText}</td>
                  <td className="p-3 whitespace-nowrap">{item.quantity ?? "–"}</td>
                  <td className="p-3 whitespace-nowrap">{item.unit ?? "–"}</td>
                  <td className="p-3 whitespace-nowrap">{formatCents(item.unitPriceCents)}</td>
                  <td className="p-3">
                    {item.matchedPosition ? (
                      <div>
                        <div className="font-semibold text-gray-900">{item.matchedPosition.title}</div>
                        {item.matchConfidence != null ? (
                          <div className="text-xs text-gray-500">
                            Konfidenz {Math.round(item.matchConfidence * 100)}%
                          </div>
                        ) : null}
                        {item.matchReasoning ? (
                          <div className="text-xs text-gray-500">{item.matchReasoning}</div>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-gray-400">–</span>
                    )}
                  </td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${status.className}`}>
                      {status.label}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-col gap-2">
                      {item.matchedPositionId && item.matchStatus !== "CONFIRMED" ? (
                        <form action={confirmMatch}>
                          <input name="lineItemId" type="hidden" value={item.id} />
                          <input name="positionId" type="hidden" value={item.matchedPositionId} />
                          <button className="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-bold text-white" type="submit">
                            Bestätigen
                          </button>
                        </form>
                      ) : null}

                      {item.matchStatus !== "REJECTED" && item.matchStatus !== "CONFIRMED" ? (
                        <form action={rejectMatch}>
                          <input name="lineItemId" type="hidden" value={item.id} />
                          <button className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50" type="submit">
                            Ablehnen
                          </button>
                        </form>
                      ) : null}

                      {item.matchStatus !== "CONFIRMED" ? (
                        <form action={manualMatch} className="flex gap-1">
                          <input name="lineItemId" type="hidden" value={item.id} />
                          <select className="rounded-lg border border-gray-300 px-2 py-1 text-xs" name="positionId" required>
                            <option value="">Manuell wählen …</option>
                            {positions.map((position) => (
                              <option key={position.id} value={position.id}>
                                {position.title}
                              </option>
                            ))}
                          </select>
                          <button className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-bold hover:bg-gray-50" type="submit">
                            OK
                          </button>
                        </form>
                      ) : null}

                      {item.matchStatus !== "CONFIRMED" ? (
                        <form action={createPositionFromLineItem}>
                          <input name="lineItemId" type="hidden" value={item.id} />
                          <button className="text-left text-xs text-gray-500 underline" type="submit">
                            Neue Katalogposition anlegen
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}
