import { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";

const optionHeaders = [
  "Gruppe",
  "Interner Wert",
  "Bezeichnung",
  "Position",
  "Aktiv",
];

function createOptionsSheet(
  options: {
    groupKey: string;
    value: string;
    label: string;
    sortOrder: number;
    isActive: boolean;
  }[],
) {
  const rows = options.map((option) => ({
    Gruppe: option.groupKey,
    "Interner Wert": option.value,
    Bezeichnung: option.label,
    Position: option.sortOrder,
    Aktiv: option.isActive ? "ja" : "nein",
  }));

  const sheet = XLSX.utils.json_to_sheet(rows, {
    header: optionHeaders,
  });

  sheet["!cols"] = [
    { wch: 30 },
    { wch: 28 },
    { wch: 36 },
    { wch: 12 },
    { wch: 12 },
  ];

  return sheet;
}

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type") ?? "options";

  if (type !== "options") {
    return new Response("Unbekannter Exporttyp.", {
      status: 400,
    });
  }

  const options = await prisma.adminOption.findMany({
    orderBy: [{ groupKey: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
  });

  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    createOptionsSheet(options),
    "Auswahllisten",
  );

  const groupRows = Array.from(
    new Set(options.map((option) => option.groupKey)),
  ).map((groupKey) => ({
    Gruppe: groupKey,
    Anzahl: options.filter((option) => option.groupKey === groupKey).length,
  }));

  const groupSheet = XLSX.utils.json_to_sheet(groupRows, {
    header: ["Gruppe", "Anzahl"],
  });

  groupSheet["!cols"] = [{ wch: 30 }, { wch: 12 }];

  XLSX.utils.book_append_sheet(workbook, groupSheet, "Gruppen");

  const buffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "buffer",
  });

  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="auswahllisten-export.xlsx"',
    },
  });
}
