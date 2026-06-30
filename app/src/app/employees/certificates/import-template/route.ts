import * as XLSX from "xlsx";
const headers = [
  "Nr.",
  "Anbieter",
  "Thema Kurs",
  "Datum der Schulung",
  "Typ",
  "Ort",
  "Dauer [Tage]",
  "Vorname",
  "Nachname",
  "Buchung am",
  "Buchungsbestätigung",
  "Zertifikat erhalten",
  "Gültigkeit",
  "gültig bis",
  "Bemerkung",
];

export async function GET() {
  const workbook = XLSX.utils.book_new();
  const templateRows = [
    {
      "Nr.": "01",
      Anbieter: "Intern",
      "Thema Kurs": "Sicherheitsunterweisung",
      "Datum der Schulung": "2026-06-30",
      Typ: "Allgemein",
      Ort: "Niedernberg",
      "Dauer [Tage]": 0.5,
      Vorname: "Max",
      Nachname: "Mustermann",
      "Buchung am": "",
      Buchungsbestätigung: "",
      "Zertifikat erhalten": "",
      Gültigkeit: 1,
      "gültig bis": "",
      Bemerkung: "Beispielzeile löschen oder überschreiben",
    },
  ];
  const templateSheet = XLSX.utils.json_to_sheet(templateRows, {
    header: headers,
  });

  templateSheet["!cols"] = [
    { wch: 8 },
    { wch: 18 },
    { wch: 34 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 14 },
    { wch: 18 },
    { wch: 20 },
    { wch: 14 },
    { wch: 20 },
    { wch: 18 },
    { wch: 12 },
    { wch: 14 },
    { wch: 38 },
  ];

  XLSX.utils.book_append_sheet(workbook, templateSheet, "Schulungsimport");

  const employeeRows = [
    {
      Vorname: "Max",
      Nachname: "Mustermann",
    },
    {
      Vorname: "Erika",
      Nachname: "Musterfrau",
    },
  ];
  const employeeSheet = XLSX.utils.json_to_sheet(employeeRows, {
    header: ["Vorname", "Nachname"],
  });

  employeeSheet["!cols"] = [
    { wch: 20 },
    { wch: 22 },
  ];
  XLSX.utils.book_append_sheet(workbook, employeeSheet, "Mitarbeiterliste");

  const infoSheet = XLSX.utils.aoa_to_sheet([
    ["Hinweis"],
    [
      "Pflichtfelder für Import: Vorname, Nachname, Thema Kurs. Vorname und Nachname werden mit den bereits angelegten Mitarbeitern im System abgeglichen.",
    ],
    [
      "Gültigkeit bitte in Jahren eintragen, z.B. 1, 2, 5. Wenn gültig bis leer ist, wird es aus Datum der Schulung + Gültigkeit berechnet.",
    ],
    [
      "Aus Datenschutzgründen enthält die Vorlage nur Beispieldaten. Die Namen müssen beim Import mit den echten Mitarbeitern im System übereinstimmen. Nicht gefundene Mitarbeiter werden übersprungen.",
    ],
  ]);

  infoSheet["!cols"] = [{ wch: 120 }];
  XLSX.utils.book_append_sheet(workbook, infoSheet, "Hinweise");

  const buffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "buffer",
  });

  return new Response(buffer, {
    headers: {
      "Content-Disposition":
        'attachment; filename="mitarbeiter-schulungen-importvorlage.xlsx"',
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
}
