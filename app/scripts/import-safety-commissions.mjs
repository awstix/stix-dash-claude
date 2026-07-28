import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const execFileAsync = promisify(execFile);
const soffice =
  "/Users/arturwittlif/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/override/soffice";
const targetRoot = path.resolve("public/templates/safety-commissions");
const libreOfficeProfile = `/tmp/stix-a90-libreoffice-${process.pid}`;

const entries = [
  ["A-90-00", "Bestellung SiFa", "/Volumes/NO NAME/11 Arbeitssicherheit/A-90 - Beauftagungen/A-90-00 - Bestellung SiFa + BA/A-90-00-001 - Bestellung SiFa_20230215 Rev00.docx"],
  ["A-90-00", "Bestellung Betriebsarzt / Betriebsärztin", "/Volumes/NO NAME/11 Arbeitssicherheit/A-90 - Beauftagungen/A-90-00 - Bestellung SiFa + BA/A-90-00-002 - Bestellung BA_20230215 Rev00.docx"],
  ["A-90-10", "Übertragung von Unternehmerpflichten – Bauleitung", "/Volumes/NO NAME/11 Arbeitssicherheit/A-90 - Beauftagungen/A-90-10 - Beauftragung_Bauleitung/A-90-10-001 - Unternehmerpflichten_BL_Rev01 - 20260520.docx"],
  ["A-90-20", "Übertragung von Unternehmerpflichten – Polier", "/Volumes/NO NAME/11 Arbeitssicherheit/A-90 - Beauftagungen/A-90-20 - Beauftragung_Polier/A-90-20-001 - Unternehmerpflichten_PL_Rev01 - 20260520.docx"],
  ["A-90-30", "Benennung zum Ersthelfer", "/Volumes/NO NAME/11 Arbeitssicherheit/A-90 - Beauftagungen/A-90-30 - Ersthelfer/A-90-30-001 - Benennung zum Ersthelfer_20230215 Rev00.docx"],
  ["A-90-40", "Benennung zum Brandschutzhelfer", "/Volumes/NO NAME/11 Arbeitssicherheit/A-90 - Beauftagungen/A-90-40 - Brandschutzhelfer/A-90-40-001 - Benennung zum Brandschutzhelfer_20230215 Rev00.docx"],
  ["A-90-50", "Benennung zum Sicherheitsbeauftragten", "/Volumes/NO NAME/11 Arbeitssicherheit/A-90 - Beauftagungen/A-90-50 - Sicherheitsbeauftragte/A-90-50-001 - Benennung zum Sicherheitsbeauftragten_2025-02-24 Rev00.docx"],
  ["A-90-60-001", "Beauftragung Erdbaumaschinen", "/Volumes/NO NAME/11 Arbeitssicherheit/A-90 - Beauftagungen/A-90-60 - Beauftragung_Geräteführer/A-90-60-001 - Beauftragung_Erdbaumaschinen/A-90-60-001 - Beauftragung - Erdbaumaschinen_Rev00 - 260107.pdf"],
  ["A-90-60-002-STAPLER", "Beauftragung Gabelstapler", "/Volumes/NO NAME/11 Arbeitssicherheit/A-90 - Beauftagungen/A-90-60 - Beauftragung_Geräteführer/A-90-60-002 - Beauftragung_Gabelstapler/A-90-60-002 - Beauftragung_Gabelstapler_20230215 Rev00.docx"],
  ["A-90-60-002-LKW", "Beauftragung LKW / PKW", "/Volumes/NO NAME/11 Arbeitssicherheit/A-90 - Beauftagungen/A-90-60 - Beauftragung_Geräteführer/A-90-60-002 - Beauftragung_LKW-PKW/A-90-60-002 - Beauftragung - LKW-PKW_Rev00 - 260107.pdf"],
  ["A-90-100", "Einarbeitung LKW", "/Volumes/NO NAME/11 Arbeitssicherheit/A-90 - Beauftagungen/A-90-100 - Einarbeitungen/A-90-100 - Einarbeitung-LKW - 2022-10-24 Rev00 - Vorschlag.docx"],
];

const catalog = [];
await mkdir(targetRoot, { recursive: true });

for (const [folderCode, title, source] of entries) {
  const targetDirectory = path.join(targetRoot, folderCode);
  await mkdir(targetDirectory, { recursive: true });
  const sourceName = path.basename(source);
  const extension = path.extname(source).toLowerCase();
  let pdfName = sourceName;
  let docxPath = null;

  if (extension === ".docx") {
    await copyFile(source, path.join(targetDirectory, sourceName));
    await execFileAsync(soffice, [
      `-env:UserInstallation=file://${libreOfficeProfile}`,
      "--headless",
      "--convert-to",
      "pdf",
      "--outdir",
      targetDirectory,
      source,
    ]);
    pdfName = sourceName.replace(/\.docx$/i, ".pdf");
    docxPath = `/templates/safety-commissions/${folderCode}/${sourceName}`;
  } else {
    await copyFile(source, path.join(targetDirectory, sourceName));
  }

  catalog.push({
    docxPath,
    folderCode,
    pdfPath: `/templates/safety-commissions/${folderCode}/${pdfName}`,
    sections: commissionSections(title),
    title,
  });
}

await writeFile(
  path.resolve("src/lib/safety-commission-catalog.json"),
  `${JSON.stringify(catalog, null, 2)}\n`,
);
console.log(`Imported ${catalog.length} commission templates.`);

function commissionSections(title) {
  if (title.includes("Einarbeitung")) {
    return [
      "Persönliche Voraussetzungen und Fahrerlaubnis geprüft",
      "Fahrzeug, Anbaugeräte und Gefahrenbereiche erklärt",
      "Bedieneinrichtungen und tägliche Einsatzprüfung durchgeführt",
      "Verhalten bei Störungen und Unfällen besprochen",
      "Technische Einweisung und Fahrtraining abgeschlossen",
    ];
  }
  if (
    title.includes("Erdbaumaschinen") ||
    title.includes("Gabelstapler") ||
    title.includes("LKW")
  ) {
    return [
      "Fachliche Befähigung / Fahrerlaubnis geprüft",
      "Körperliche und geistige Eignung bestätigt",
      "Beauftragte Fahrzeuge oder Geräte festgelegt",
      "Betriebsanweisung und Verantwortlichkeiten erläutert",
    ];
  }
  return [
    "Aufgaben und Verantwortungsbereich erläutert",
    "Erforderliche Fachkunde und Voraussetzungen geprüft",
    "Rechte, Pflichten und Befugnisse übertragen",
    "Originalvorlage gemeinsam gelesen und bestätigt",
  ];
}
