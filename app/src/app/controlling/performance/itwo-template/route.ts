import * as XLSX from "xlsx";

export const runtime = "nodejs";

const headers = [
  "OZ",
  "Kurztext",
  "ME",
  "LV-Menge",
  "RE-Menge",
  "Einheitspreis",
  "Std/ME",
  "Kosten/ME",
  "1 Personalkosten",
  "2 Geräte (o.Bedienung. / o. Montage)",
  "3 Material - AB WERK",
  "4 Nachunternehmer",
  "5 Gehalt / Sonstiges",
];

const exampleRow: Record<string, string> = {
  OZ: "01.02.0010",
  Kurztext: "Asphaltdecke einbauen",
  ME: "m²",
  "LV-Menge": "1200",
  "RE-Menge": "980",
  Einheitspreis: "18,50",
  "Std/ME": "0,08",
  "Kosten/ME": "14,20",
  "1 Personalkosten": "6,50",
  "2 Geräte (o.Bedienung. / o. Montage)": "4,10",
  "3 Material - AB WERK": "3,00",
  "4 Nachunternehmer": "0",
  "5 Gehalt / Sonstiges": "0,60",
};

export async function GET() {
  const dataRow = headers.map((header) => exampleRow[header] ?? "");
  const itwoSheet = XLSX.utils.aoa_to_sheet([headers, dataRow]);
  itwoSheet["!cols"] = headers.map((header) => ({
    wch: Math.max(14, Math.min(38, header.length + 4)),
  }));

  const hintSheet = XLSX.utils.aoa_to_sheet([
    ["So kommen Sie an die Daten (Export aus iTWO)"],
    [
      "1. Kalkulation in iTWO öffnen, oben im Menü \"Ansicht\" wählen.",
    ],
    [
      "2. Die Vorlage \"Standard_Artur_Controlling\" auswählen.",
    ],
    [
      "3. Die gesamte Tabelle markieren, kopieren und in Excel einfügen.",
    ],
    [
      "4. Diese Excel-Datei direkt im Import-Formular hochladen.",
    ],
    [
      "Falls die Ansicht \"Standard_Artur_Controlling\" nicht verfügbar ist: selbst eine Ansicht erstellen und die benötigten Spalten gemäß dieser Importvorlage auswählen. Wichtig: Die Spaltenreihenfolge muss dabei genau der Importvorlage entsprechen!",
    ],
    [""],
    ["Hinweis zu den Spalten"],
    [
      "Zeile 1 sind die Spaltennamen, ab Zeile 2 stehen die Daten. Pro Zeile eine LV-Position.",
    ],
    [
      "Der so erzeugte Export kann direkt hochgeladen werden - die Spalten müssen dafür nicht umbenannt werden. Der Import erkennt automatisch auch diese gängigen iTWO-Bezeichnungen:",
    ],
    ["OZ: OZ, Position, Pos., Ordnungszahl"],
    ["Kurztext: Kurztext, Kurz-Info, Beschreibung, Leistung"],
    ["ME: ME, Einheit"],
    ["RE-Menge: RE-Menge, RE Menge, Abrechnungsmenge, Menge"],
    ["LV-Menge: LV-Menge, LV Menge, Auftragsmenge"],
    ["Einheitspreis: Einheitspreis, EP, EP netto, EP netto €"],
    ["Std/ME: Std/ME, Std ME, Stunden je ME"],
    ["Kosten/ME: Kosten/ME, Kosten ME, Kosten je ME"],
    [
      "Pflichtfelder sind OZ, Kurztext, ME und RE-Menge - Zeilen ohne diese Angaben (oder mit RE-Menge = 0) werden beim Import übersprungen.",
    ],
    [
      "RE-Menge ist die abgerechnete/freigegebene Menge (Rechnungsmenge) der Position, LV-Menge die ursprüngliche Vertragsmenge laut Leistungsverzeichnis - beides finden Sie im iTWO-Aufmaß bzw. der Rechnungsprüfung.",
    ],
    [
      "Aus RE-Menge × Einheitspreis wird der Umsatz berechnet, aus RE-Menge × Std/ME die Stunden. Sind die Kostenspalten (1-5) gefüllt, werden die Kosten daraus je Kostenart berechnet, sonst ersatzweise aus RE-Menge × Kosten/ME als Gesamtkosten.",
    ],
    [
      "Zahlen mit Komma oder Punkt als Dezimaltrennzeichen sind beide möglich.",
    ],
    [
      "Beim Import kann \"bisherigen iTWO-Import ersetzen\" angehakt werden - dann werden vor dem Import alle vorherigen iTWO-Positionen dieser Leistungsmeldung gelöscht und durch die neue Datei ersetzt.",
    ],
  ]);
  hintSheet["!cols"] = [{ wch: 110 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, itwoSheet, "iTWO-Import");
  XLSX.utils.book_append_sheet(workbook, hintSheet, "Hinweise");

  const buffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "buffer",
  }) as Buffer;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Disposition": 'attachment; filename="itwo-rechnungsmengen-vorlage.xlsx"',
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
}
