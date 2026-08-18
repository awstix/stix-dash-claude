import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const MONEY_NUMBER_FORMAT = "0.00";

function toEuro(cents: number | null) {
  return cents === null ? null : Math.round(cents) / 100;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rateSetIdParam = url.searchParams.get("rateSetId");

  const rateSet = rateSetIdParam
    ? await prisma.controllingRateSet.findUnique({ where: { id: rateSetIdParam } })
    : await prisma.controllingRateSet.findFirst({
        orderBy: [{ isDefault: "desc" }, { year: "desc" }],
      });

  if (!rateSet) {
    return new Response("Kein Satzstand gefunden.", { status: 404 });
  }

  const [categories, items, categoryRates, itemRates] = await Promise.all([
    prisma.inventoryCategory.findMany({
      include: { parentCategory: true },
      orderBy: [{ parentCategoryId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    }),
    // Deliberately unbounded (no `take`) - unlike the on-page table, an
    // export meant to cover every object for a bulk Excel round-trip must
    // never silently truncate the list.
    prisma.inventoryItem.findMany({
      include: { category: true },
      orderBy: [{ objectNumber: "asc" }, { name: "asc" }],
      where: { status: { not: "DELETED" } },
    }),
    prisma.controllingInventoryCategoryRate.findMany({
      where: { rateSetId: rateSet.id },
    }),
    prisma.controllingInventoryItemRate.findMany({
      where: { rateSetId: rateSet.id },
    }),
  ]);

  const categoryRateById = new Map(categoryRates.map((rate) => [rate.categoryId, rate]));
  const itemRateById = new Map(itemRates.map((rate) => [rate.itemId, rate]));

  const categoryRows = categories.map((category) => {
    const rate = categoryRateById.get(category.id);

    return {
      "Kategorie-ID": category.id,
      Kategorie: category.name,
      "Übergeordnete Kategorie": category.parentCategory?.name ?? "",
      "Normal (€/Einheit)": toEuro(rate?.billingRateCents ?? category.billingRateCents),
      "Stillstand (€/Einheit)": toEuro(
        rate?.idleBillingRateCents ?? category.idleBillingRateCents,
      ),
    };
  });

  const itemRows = items.map((item) => {
    const rate = itemRateById.get(item.id);

    return {
      "Objekt-ID": item.id,
      Objektnummer: item.objectNumber ?? "",
      Name: item.name,
      Kategorie: item.category?.name ?? "",
      "Normal (€/Einheit)": toEuro(rate?.billingRateCents ?? item.billingRateCents),
      "Stillstand (€/Einheit)": toEuro(rate?.idleBillingRateCents ?? item.idleBillingRateCents),
    };
  });

  const workbook = XLSX.utils.book_new();

  const categorySheet = XLSX.utils.json_to_sheet(categoryRows);
  applyMoneyColumnFormat(categorySheet, categoryRows.length, [3, 4]);
  categorySheet["!cols"] = [
    { wch: 26 }, // Kategorie-ID
    { wch: 28 }, // Kategorie
    { wch: 28 }, // Übergeordnete Kategorie
    { wch: 16 }, // Normal
    { wch: 16 }, // Stillstand
  ];
  XLSX.utils.book_append_sheet(workbook, categorySheet, "Inventarkategorien");

  const itemSheet = XLSX.utils.json_to_sheet(itemRows);
  applyMoneyColumnFormat(itemSheet, itemRows.length, [4, 5]);
  itemSheet["!cols"] = [
    { wch: 26 }, // Objekt-ID
    { wch: 14 }, // Objektnummer
    { wch: 32 }, // Name
    { wch: 28 }, // Kategorie
    { wch: 16 }, // Normal
    { wch: 16 }, // Stillstand
  ];
  XLSX.utils.book_append_sheet(workbook, itemSheet, "Inventarobjekte");

  const hintsSheet = XLSX.utils.aoa_to_sheet([
    [`Verrechnungssätze ${rateSet.year} (${rateSet.name})`],
    [],
    ["Nur die Spalten „Normal (€/Einheit)“ und „Stillstand (€/Einheit)“ bearbeiten."],
    [
      "Die -ID-Spalten (Kategorie-ID / Objekt-ID) nicht verändern - sie ordnen jede Zeile beim Import eindeutig zu.",
    ],
    [
      "Beim erneuten Hochladen unter Controlling > Verrechnungssätze werden die Sätze dieser Zeilen überschrieben.",
    ],
    ["Leere Satz-Zellen löschen den Satz wieder (es gilt dann automatisch der Kategoriesatz)."],
  ]);
  hintsSheet["!cols"] = [{ wch: 100 }];
  XLSX.utils.book_append_sheet(workbook, hintsSheet, "Hinweise");

  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Disposition": `attachment; filename="verrechnungssaetze-${rateSet.year}.xlsx"`,
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
}

function applyMoneyColumnFormat(
  sheet: XLSX.WorkSheet,
  rowCount: number,
  columnIndexes: number[],
) {
  for (let row = 1; row <= rowCount; row += 1) {
    for (const column of columnIndexes) {
      const address = XLSX.utils.encode_cell({ c: column, r: row });
      const cell = sheet[address];
      if (cell && typeof cell.v === "number") {
        cell.z = MONEY_NUMBER_FORMAT;
      }
    }
  }
}
