import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { getAiSettings, isAiConfigured } from "@/lib/kalkulation-ai-settings";
import { confirmMatch, createPositionFromLineItem, manualMatch, rejectMatch, runMatching } from "../actions";
import { MatchingThresholdInput } from "../MatchingThresholdInput";
import { buildShortlist, type CatalogEntryForMatching } from "@/lib/kalkulation-matching";

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

const LV_TYPE_LABELS: Record<string, string> = {
  ANGEBOT: "Angebot (gepreist)",
  AUFTRAG: "Auftrag",
  AUSSCHREIBUNG: "Ausschreibung (ungepreist)",
};

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

  // Andere Imports desselben Projekts (z.B. erst die ungepreiste
  // Ausschreibung, später das eigene kalkulierte Angebot dazu) - verknüpft
  // rein über die Projektnummer, kein eigenes Datenfeld nötig.
  const relatedImports = lvImport.projectNumber
    ? await prisma.kalkulationLvImport.findMany({
        where: { projectNumber: lvImport.projectNumber, id: { not: importId } },
        orderBy: { createdAt: "asc" },
      })
    : [];

  // Preishistorie aus ANDEREN Projekten für jede in diesem LV bereits
  // (vorgeschlagen oder bestätigt) zugeordnete Position - damit man beim
  // Prüfen direkt sieht, was dieselbe Position anderswo schon gekostet hat.
  const matchedPositionIds = [
    ...new Set(lineItems.map((item) => item.matchedPositionId).filter((id): id is string => Boolean(id))),
  ];
  const historyRows = matchedPositionIds.length
    ? await prisma.kalkulationLvLineItem.findMany({
        where: {
          matchedPositionId: { in: matchedPositionIds },
          matchStatus: "CONFIRMED",
          lvImportId: { not: importId },
        },
        include: { lvImport: true },
        orderBy: { lvImport: { lvDate: "desc" } },
      })
    : [];
  const priceHistoryByPosition = new Map<string, typeof historyRows>();
  for (const row of historyRows) {
    if (!row.matchedPositionId) continue;
    const existing = priceHistoryByPosition.get(row.matchedPositionId) ?? [];
    if (existing.length < 2) existing.push(row);
    priceHistoryByPosition.set(row.matchedPositionId, existing);
  }

  // Direkter Vergleich gegen Positionen ANDERER bereits importierter LVs -
  // unabhängig davon, ob dort schon irgendetwas bestätigt/katalogisiert
  // wurde. Ergänzt (ersetzt nicht) den Katalog-Abgleich: hilft schon vor
  // jeder Katalogpflege zu sehen "das gab's so ähnlich schon in LV X".
  const otherLvItems = await prisma.kalkulationLvLineItem.findMany({
    where: { entryType: "ITEM", lvImportId: { not: importId } },
    include: { lvImport: true },
    orderBy: { createdAt: "desc" },
    take: 3000,
  });
  const otherLvItemsById = new Map(otherLvItems.map((row) => [row.id, row]));
  const otherLvCatalog: CatalogEntryForMatching[] = otherLvItems.map((row) => ({
    id: row.id,
    code: row.positionNumber,
    title: row.shortText ?? row.rawText.slice(0, 100),
    description: row.rawText,
    unit: row.unit ?? "",
  }));
  const crossLvMatchByLineItem = new Map<string, (typeof otherLvItems)[number] & { similarityScore: number }>();
  if (otherLvCatalog.length > 0) {
    for (const item of lineItems) {
      if (item.entryType !== "ITEM") continue;
      const combinedText = `${item.shortText ?? ""} ${item.rawText}`.trim();
      const [best] = buildShortlist(combinedText, otherLvCatalog, 1, lvImport.matchingThreshold);
      if (!best) continue;
      const source = otherLvItemsById.get(best.positionId);
      if (source) crossLvMatchByLineItem.set(item.id, { ...source, similarityScore: best.similarityScore });
    }
  }

  const aiConfigured = isAiConfigured(aiSettings);
  const projectLabel = [lvImport.projectNumber, lvImport.tenderTitle].filter(Boolean).join(" – ");
  const prefillParams = new URLSearchParams();
  if (lvImport.projectNumber) prefillParams.set("prefillProjectNumber", lvImport.projectNumber);
  if (lvImport.tenderTitle) prefillParams.set("prefillTenderTitle", lvImport.tenderTitle);

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

        <Link
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          href={`/kalkulation/imports?${prefillParams.toString()}`}
          title="Legt einen zweiten, mit diesem Projekt verknüpften Import an"
        >
          Kalkuliertes Angebot nachreichen →
        </Link>

        {!aiConfigured ? (
          <span className="text-sm text-amber-800">
            KI nicht konfiguriert (optional) -{" "}
            <Link className="underline" href="/admin/kalkulation-ai-settings">
              einrichten
            </Link>
          </span>
        ) : null}
      </div>

      <form action={runMatching} className="mb-6 max-w-md rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <input name="importId" type="hidden" value={importId} />
        <MatchingThresholdInput defaultValue={Math.round(lvImport.matchingThreshold * 100)} name="matchingThreshold" />
        <button
          className="mt-4 rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
          title="Wendet zuerst gelernte Zuordnungen an, danach - falls eingerichtet - die KI"
          type="submit"
        >
          Abgleich starten
        </button>
      </form>

      {relatedImports.length > 0 ? (
        <section className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <h2 className="text-sm font-bold text-blue-950">Weitere Imports zu diesem Projekt</h2>
          <ul className="mt-2 space-y-1">
            {relatedImports.map((related) => (
              <li key={related.id}>
                <Link className="text-sm font-semibold text-blue-800 underline" href={`/kalkulation/imports/${related.id}`}>
                  {related.fileName}
                </Link>
                <span className="ml-2 text-xs text-blue-700">
                  {LV_TYPE_LABELS[related.lvType] ?? related.lvType} · {related.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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
              <th className="p-3">Ähnlich in anderen LVs</th>
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
                    <td className="bg-gray-900 p-3 font-bold text-white" colSpan={10}>
                      {item.rawText}
                    </td>
                  </tr>
                );
              }

              if (item.entryType === "REMARK") {
                return (
                  <tr key={item.id}>
                    <td className="whitespace-pre-line bg-amber-50 p-3 text-sm italic text-amber-950" colSpan={10}>
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
                    {(() => {
                      const cross = crossLvMatchByLineItem.get(item.id);
                      if (!cross) return <span className="text-gray-400">–</span>;
                      return (
                        <div>
                          <div className="font-semibold text-gray-900">{cross.shortText ?? cross.rawText.slice(0, 60)}</div>
                          <div className="text-xs text-gray-500">Ähnlichkeit {Math.round(cross.similarityScore * 100)}%</div>
                          <div className="mt-1 text-xs font-semibold text-green-800">
                            {formatCents(cross.unitPriceCents)} · {cross.lvImport.fileName}
                            {cross.lvImport.lvDate
                              ? ` (${new Intl.DateTimeFormat("de-DE", { month: "2-digit", year: "numeric" }).format(cross.lvImport.lvDate)})`
                              : ""}
                          </div>
                        </div>
                      );
                    })()}
                  </td>
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
                        {(priceHistoryByPosition.get(item.matchedPosition.id) ?? []).map((history) => (
                          <div className="mt-1 text-xs font-semibold text-green-800" key={history.id}>
                            {formatCents(history.unitPriceCents)} · {history.lvImport.fileName}
                            {history.lvImport.lvDate
                              ? ` (${new Intl.DateTimeFormat("de-DE", { month: "2-digit", year: "numeric" }).format(history.lvImport.lvDate)})`
                              : ""}
                          </div>
                        ))}
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
