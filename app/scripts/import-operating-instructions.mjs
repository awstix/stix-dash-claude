import { copyFile, mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const sourceRoot =
  "/Volumes/NO NAME/11 Arbeitssicherheit/A-30 - Betriebsanweisungen/A-30-10 - Betriebsanweisungen";
const hazardSourceDirectory = path.join(
  sourceRoot,
  "A-30-19 - Gefahrstoffe",
  "Betriebsanweisungen",
);
const constructionSiteRulesSource = path.join(
  path.dirname(sourceRoot),
  "A-30-20 - Baustellenordnungen",
  "A-30-20-BO-Stix_2024-08-29 Rev00.pdf",
);
const targetRoot = path.resolve(
  "public/templates/operating-instructions",
);

const categories = [
  ["A-30-11 - Gebäude, Einrichtungen", "A-30-11", "Gebäude und Einrichtungen"],
  ["A-30-12 - Tätigkeiten", "A-30-12", "Tätigkeiten"],
  ["A-30-13 - Arbeitsmittel", "A-30-13", "Arbeitsmittel"],
  ["A-30-14 - Fahr-Förder-Hub", "A-30-14", "Fahrzeuge, Förder- und Hubmittel"],
  ["A-30-15 - Maschine-Hand", "A-30-15", "Handgeführte Maschinen"],
  ["A-30-16 - Maschine-Stationär", "A-30-16", "Stationäre Maschinen"],
  ["A-30-17 - Maschine-Bau", "A-30-17", "Baumaschinen und Baugeräte"],
  ["A-30-18 - PSA", "A-30-18", "Persönliche Schutzausrüstung"],
];

const preferredDocx = new Set([
  "A-30-11 - Betriebstankstelle - 2026-02-24.docx",
  "A-30-11 - Betriebstankstelle-Wartung - 2026-02-24.docx",
  "A-30-12 - Hitzearbeit_Hitzebelastungen - 2026-06-25- WA.docx",
  "A-30-17 - Lichtmast-mobil - 2026-02-25.docx",
  "A-30-17 - Stromerzeuger-mobil - 2026-02-25.docx",
]);

const sections = [
  "Betriebsanweisung gemeinsam gelesen und erläutert",
  "Gefahren für Mensch und Umwelt",
  "Schutzmaßnahmen und Verhaltensregeln",
  "Verhalten bei Störungen und im Gefahrfall",
  "Erste Hilfe",
  "Instandhaltung, Wartung und sachgerechter Abschluss",
];

await mkdir(targetRoot, { recursive: true });
const catalog = [];

function catalogTitle(fileName) {
  return fileName
    .replace(/\.(docx|pdf)$/i, "")
    .replace(/^A-\d{2}-\d{2}\s*-\s*/, "")
    .replace(/\s*-\s*\d{4}-\d{2}-\d{2}.*$/, "")
    .replace(/\s+\d{4}-\d{2}-\d{2}.*$/, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function comparableName(fileName) {
  return fileName
    .replace(/\.(docx|pdf)$/i, "")
    .toLocaleLowerCase("de")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "");
}

async function copyCatalogEntry({
  category,
  categoryCode,
  docxName = null,
  pdfName,
  sourceDirectory,
  title = null,
  titleSource = pdfName,
}) {
  const targetDirectory = path.join(targetRoot, categoryCode);
  await mkdir(targetDirectory, { recursive: true });
  await copyFile(
    path.join(sourceDirectory, pdfName),
    path.join(targetDirectory, pdfName),
  );
  if (docxName) {
    await copyFile(
      path.join(sourceDirectory, docxName),
      path.join(targetDirectory, docxName),
    );
  }

  const dateMatch = `${docxName ?? ""} ${pdfName}`.match(
    /(\d{4}-\d{2}-\d{2})/,
  );
  catalog.push({
    category,
    categoryCode,
    date: dateMatch?.[1] ?? null,
    docxPath: docxName
      ? `/templates/operating-instructions/${categoryCode}/${docxName}`
      : null,
    pdfPath: `/templates/operating-instructions/${categoryCode}/${pdfName}`,
    sections,
    title: title ?? catalogTitle(titleSource),
  });
}

for (const [directory, code, category] of categories) {
  const sourceDirectory = path.join(sourceRoot, directory);
  const entries = await readdir(sourceDirectory);
  const pdfFiles = entries
    .filter(
      (name) =>
        name.toLowerCase().endsWith(".pdf") &&
        name !== "A-30-11 - Betriebstankstelle Anleitung.pdf",
    )
    .sort((a, b) => a.localeCompare(b, "de"));

  for (const fileName of pdfFiles) {
    const docxName = [...preferredDocx].find((name) => {
      const docxTitle = name
        .replace(/\.docx$/i, "")
        .replace(/\s*-\s*\d{4}-\d{2}-\d{2}.*$/, "");
      const pdfTitle = fileName
        .replace(/\.pdf$/i, "")
        .replace(/\s*-\s*\d{4}-\d{2}-\d{2}.*$/, "");
      return docxTitle === pdfTitle;
    });

    await copyCatalogEntry({
      category,
      categoryCode: code,
      docxName,
      pdfName: fileName,
      sourceDirectory,
    });
  }
}

const hazardEntries = await readdir(hazardSourceDirectory);
const hazardDocxFiles = hazardEntries
  .filter(
    (name) =>
      name.toLowerCase().endsWith(".docx") &&
      !name.toLocaleLowerCase("de").includes("aspen2") &&
      !name.toLocaleLowerCase("de").includes("all-grund") &&
      !name.toLocaleLowerCase("de").includes("bitu-ex"),
  )
  .sort((a, b) => a.localeCompare(b, "de"));
const hazardPdfFiles = hazardEntries.filter((name) =>
  name.toLowerCase().endsWith(".pdf"),
);

for (const docxName of hazardDocxFiles) {
  const exactPdfName = docxName.replace(/\.docx$/i, ".pdf");
  const pdfName =
    hazardPdfFiles.find((name) => name === exactPdfName) ??
    hazardPdfFiles.find(
      (name) => comparableName(name) === comparableName(docxName),
    );
  if (!pdfName) {
    throw new Error(`Keine passende PDF für ${docxName} gefunden.`);
  }
  await copyCatalogEntry({
    category: "Gefahrstoffe",
    categoryCode: "A-30-19",
    docxName,
    pdfName,
    sourceDirectory: hazardSourceDirectory,
    titleSource: docxName,
  });
}

await copyCatalogEntry({
  category: "Gefahrstoffe",
  categoryCode: "A-30-19",
  pdfName: "A-30-19 - Asbestbruchstücke im Erdreich.pdf",
  sourceDirectory: hazardSourceDirectory,
});

await copyCatalogEntry({
  category: "Baustellenordnungen",
  categoryCode: "A-30-20",
  pdfName: path.basename(constructionSiteRulesSource),
  sourceDirectory: path.dirname(constructionSiteRulesSource),
  title: "Baustellenordnung Stix",
});

await writeFile(
  path.resolve("src/lib/operating-instruction-catalog.json"),
  `${JSON.stringify(catalog, null, 2)}\n`,
);

console.log(`Imported ${catalog.length} operating instructions.`);
