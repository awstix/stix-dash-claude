import * as XLSX from "xlsx";
import { requireSession } from "@/lib/auth-access";
import { loadLvExportData } from "@/lib/kalkulation-export";
import { MATCH_STATUS_LABELS } from "@/lib/kalkulation-format";

export const runtime = "nodejs";

const MONEY_NUMBER_FORMAT = "0.00";

const ENTRY_TYPE_LABELS: Record<string, string> = {
  ITEM: "Position",
  REMARK: "Vorbemerkung",
  TITLE: "Titel",
};

function toEuro(cents: number | null) {
  return cents == null ? null : Math.round(cents) / 100;
}

export async function GET(_request: Request, { params }: { params: Promise<{ importId: string }> }) {
  await requireSession();
  const { importId } = await params;

  const data = await loadLvExportData(importId);
  if (!data) {
    return new Response("Import nicht gefunden.", { status: 404 });
  }
  const { lvImport, lineItems, infoLineByItemId } = data;

  const rows = lineItems.map((item) => ({
    OZ: item.positionNumber ?? "",
    Typ: ENTRY_TYPE_LABELS[item.entryType] ?? item.entryType,
    Kurztext: item.entryType === "ITEM" ? (item.shortText ?? "") : item.rawText,
    Langtext: item.entryType === "ITEM" ? item.rawText : "",
    Menge: item.quantity,
    Einheit: item.unit ?? "",
    "EP (€)": toEuro(item.unitPriceCents),
    "GP (€)": toEuro(item.totalPriceCents),
    // Zuordnungsstatus getrennt vom Preis: eine Position kann bereits
    // bestätigt/zugeordnet sein, ohne dass schon ein Preis vorliegt (z.B.
    // per "Als gleiche Position markieren" bei zwei ungepreisten LVs) -
    // sonst sieht man diese Zuordnung im Export gar nicht.
    Status: item.entryType === "ITEM" ? (MATCH_STATUS_LABELS[item.matchStatus] ?? item.matchStatus) : "",
    "Zugeordnete Position": item.matchedPosition?.title ?? "",
    Herkunft: infoLineByItemId.get(item.id) ?? "",
  }));

  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet["!cols"] = [
    { wch: 10 }, // OZ
    { wch: 12 }, // Typ
    { wch: 40 }, // Kurztext
    { wch: 60 }, // Langtext
    { wch: 10 }, // Menge
    { wch: 10 }, // Einheit
    { wch: 12 }, // EP
    { wch: 12 }, // GP
    { wch: 14 }, // Status
    { wch: 40 }, // Zugeordnete Position
    { wch: 55 }, // Herkunft
  ];
  for (let row = 1; row <= rows.length; row += 1) {
    for (const column of [6, 7]) {
      const address = XLSX.utils.encode_cell({ c: column, r: row });
      const cell = sheet[address];
      if (cell && typeof cell.v === "number") cell.z = MONEY_NUMBER_FORMAT;
    }
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "LV");

  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;
  const fileName = `${lvImport.fileName.replace(/\.[^.]+$/, "")}_vorkalkuliert.xlsx`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Disposition": `attachment; filename="${fileName.replace(/["\\]/g, "_")}"`,
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
}
