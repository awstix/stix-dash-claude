import { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";

type ImportType =
  | "employees"
  | "drivers"
  | "vehicles"
  | "materials"
  | "asphalt-types"
  | "concrete-types";

type TemplateConfig = {
  filename: string;
  sheetName: string;
  headers: string[];
  exampleRows: Record<string, string>[];
  columnWidths?: number[];
};

async function getOptions(groupKey: string) {
  const options = await prisma.adminOption.findMany({
    where: {
      groupKey,
      isActive: true,
    },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });

  return options.map((option) => option.label);
}

function createListSheet(title: string, values: string[]) {
  return XLSX.utils.aoa_to_sheet([[title], ...values.map((value) => [value])]);
}

function getTemplateConfig(type: ImportType): TemplateConfig {
  if (type === "employees") {
    const headers = [
      "Status",
      "Eintritt",
      "Austritt",
      "Firma",
      "Abteilung",
      "Vorname",
      "Nachname",
      "Berufsgruppen",
      "Leitung",
      "Geburtsdatum",
      "Geschlecht",
      "Handynummer",
      "Notfallkontakt",
      "Straße",
      "PLZ",
      "Ort",
      "Bemerkung",
    ];

    return {
      filename: "mitarbeiter-import-vorlage.xlsx",
      sheetName: "Mitarbeiter",
      headers,
      exampleRows: [
        {
          Status: "Aktiv",
          Eintritt: "01.03.2024",
          Austritt: "",
          Firma: "Stix",
          Abteilung: "Tiefbau",
          Vorname: "Max",
          Nachname: "Mustermann",
          Berufsgruppen: "LKW Fahrer*in; Maschinist*in",
          Leitung: "nein",
          Geburtsdatum: "15.08.1985",
          Geschlecht: "männlich",
          Handynummer: "0171 1234567",
          Notfallkontakt: "0170 9876543",
          Straße: "Musterstraße 1",
          PLZ: "63739",
          Ort: "Aschaffenburg",
          Bemerkung: "Beispielzeile kann gelöscht werden",
        },
      ],
      columnWidths: [16, 14, 14, 18, 22, 18, 22, 40, 12, 16, 16, 18, 20, 28, 10, 22, 40],
    };
  }

  if (type === "drivers") {
    return {
      filename: "fahrer-import-vorlage.xlsx",
      sheetName: "Fahrer",
      headers: ["Vorname", "Nachname", "Kürzel", "Telefon", "Bemerkung"],
      exampleRows: [
        {
          Vorname: "Max",
          Nachname: "Mustermann",
          Kürzel: "MM",
          Telefon: "0171 1234567",
          Bemerkung: "",
        },
      ],
      columnWidths: [18, 22, 12, 18, 36],
    };
  }

  if (type === "vehicles") {
    return {
      filename: "fahrzeuge-import-vorlage.xlsx",
      sheetName: "Fahrzeuge",
      headers: [
        "Fahrzeugnummer",
        "Kennzeichen",
        "Fahrzeugtyp",
        "Kategorie",
        "Sonderfahrzeug",
        "Bemerkung",
      ],
      exampleRows: [
        {
          Fahrzeugnummer: "101",
          Kennzeichen: "AB-ST-101",
          Fahrzeugtyp: "LKW",
          Kategorie: "4-Achser",
          Sonderfahrzeug: "nein",
          Bemerkung: "",
        },
      ],
      columnWidths: [18, 18, 18, 22, 18, 36],
    };
  }

  if (type === "materials") {
    return {
      filename: "materialliste-import-vorlage.xlsx",
      sheetName: "Materialliste",
      headers: [
        "Materialnummer",
        "Materialname",
        "Kategorie",
        "Einheit",
        "Bemerkung",
      ],
      exampleRows: [
        {
          Materialnummer: "M-001",
          Materialname: "Frostschutz 0/32",
          Kategorie: "Frostschutz",
          Einheit: "t",
          Bemerkung: "",
        },
      ],
      columnWidths: [18, 28, 20, 12, 36],
    };
  }

  if (type === "asphalt-types") {
    return {
      filename: "asphalt-sorten-import-vorlage.xlsx",
      sheetName: "Sortenliste Asphalt",
      headers: [
        "Sortennummer",
        "Bezeichnung",
        "Kurzbezeichnung",
        "Einheit",
        "Kategorie",
        "Mischanlage",
        "Bemerkung",
      ],
      exampleRows: [
        {
          Sortennummer: "AC 11 DN",
          Bezeichnung: "Asphaltdeckschicht AC 11 DN",
          Kurzbezeichnung: "AC 11 DN",
          Einheit: "t",
          Kategorie: "Asphaltdeckschicht",
          Mischanlage: "Eigene Mischanlage",
          Bemerkung: "",
        },
      ],
      columnWidths: [18, 36, 20, 12, 26, 28, 36],
    };
  }

  return {
    filename: "beton-sorten-import-vorlage.xlsx",
    sheetName: "Sortenliste Beton",
    headers: [
      "Sortennummer",
      "Bezeichnung",
      "Festigkeitsklasse",
      "Expositionsklasse",
      "Körnung",
      "Konsistenz",
      "Einheit",
      "Bemerkung",
    ],
    exampleRows: [
      {
        Sortennummer: "C25/30-XC4",
        Bezeichnung: "Beton C25/30 XC4",
        Festigkeitsklasse: "C 25/30",
        Expositionsklasse: "XC4",
        Körnung: "0/16",
        Konsistenz: "F3",
        Einheit: "m³",
        Bemerkung: "",
      },
    ],
    columnWidths: [20, 32, 22, 22, 16, 16, 12, 36],
  };
}

export async function GET(request: NextRequest) {
  const type = (request.nextUrl.searchParams.get("type") ??
    "drivers") as ImportType;

  const allowedTypes: ImportType[] = [
    "employees",
    "drivers",
    "vehicles",
    "materials",
    "asphalt-types",
    "concrete-types",
  ];

  if (!allowedTypes.includes(type)) {
    return new Response("Unbekannter Importtyp.", {
      status: 400,
    });
  }

  const config = getTemplateConfig(type);

  const emptyRows = Array.from({ length: 100 }, () =>
    Object.fromEntries(config.headers.map((header) => [header, ""]))
  );

  const workbook = XLSX.utils.book_new();

  const sheet = XLSX.utils.json_to_sheet(
    [...config.exampleRows, ...emptyRows],
    {
      header: config.headers,
    }
  );

  sheet["!cols"] = config.headers.map((_, index) => ({
    wch: config.columnWidths?.[index] ?? 20,
  }));

  XLSX.utils.book_append_sheet(workbook, sheet, config.sheetName);

  if (type === "employees") {
    const [statuses, companies, departments, genders, positions] =
      await Promise.all([
        getOptions("employee_status"),
        getOptions("employee_company"),
        getOptions("employee_department"),
        getOptions("employee_gender"),
        getOptions("employee_position"),
      ]);

    XLSX.utils.book_append_sheet(
      workbook,
      createListSheet("Status", statuses),
      "Liste_Status"
    );

    XLSX.utils.book_append_sheet(
      workbook,
      createListSheet("Firmen", companies),
      "Liste_Firmen"
    );

    XLSX.utils.book_append_sheet(
      workbook,
      createListSheet("Abteilungen", departments),
      "Liste_Abteilungen"
    );

    XLSX.utils.book_append_sheet(
      workbook,
      createListSheet("Geschlecht", genders),
      "Liste_Geschlecht"
    );

    XLSX.utils.book_append_sheet(
      workbook,
      createListSheet("Berufsgruppen", positions),
      "Liste_Berufsgruppen"
    );
  }

  const buffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "buffer",
  });

  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${config.filename}"`,
    },
  });
}