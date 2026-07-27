import templatesJson from "./general-risk-assessment-templates.json";
import {
  MATERNITY_RISK_ASSESSMENT_CONTENTS,
  MATERNITY_RISK_ASSESSMENT_INTRO,
  MATERNITY_RISK_ASSESSMENT_ITEMS,
} from "./maternity-risk-assessment";
import {
  curateOfficeRiskAssessmentItems,
  OFFICE_RISK_ASSESSMENT_CONTENTS,
  OFFICE_RISK_ASSESSMENT_INTRO,
} from "./office-risk-assessment";

export type GeneralRiskAssessmentAnswer = {
  implemented?: boolean;
  responsible?: string;
  status?: "YES" | "NO" | "NOT_APPLICABLE";
  text?: string;
};

export type GeneralRiskAssessmentItem = {
  activity: string;
  chapterTitle?: string;
  hazard: string;
  id: string;
  kind?: "choice" | "heading" | "note" | "text";
  measure: string;
  options?: "YES_NO" | "YES_NO_NA";
  pictograms?: string[];
  reference: string;
  sectionTitle?: string;
  sourcePage: number;
};

export type GeneralRiskAssessmentIntroSection = {
  paragraphs: string[];
  title: string;
};

export type GeneralRiskAssessmentTemplate = {
  code: string;
  contents?: string[];
  issuedAt: string;
  introSections?: GeneralRiskAssessmentIntroSection[];
  items: GeneralRiskAssessmentItem[];
  key: string;
  pageCount: number;
  revision: string;
  sourceFile: string;
  sourcePdfPath: string;
  title: string;
};

const sourcePdfPaths: Record<string, string> = {
  asphaltbau:
    "/templates/general-risk-assessments/A-20-50-GBU-Asphaltbau-allgemein-Rev00.pdf",
  buero:
    "/templates/general-risk-assessments/A-20-10-001-GBU-Buerotaetigkeiten-Rev00.pdf",
  muschg:
    "/templates/general-risk-assessments/A-20-00-GBU-MuSchG-Rev00.pdf",
  strassenwalze:
    "/templates/general-risk-assessments/A-20-20-GBU-Strassenwalze-Rev00.pdf",
  tiefbau:
    "/templates/general-risk-assessments/A-20-40-GBU-Tiefbau-allgemein-Rev01.pdf",
};

export const GENERAL_RISK_ASSESSMENT_TEMPLATES =
  (templatesJson as Omit<GeneralRiskAssessmentTemplate, "sourcePdfPath">[]).map(
    (template) => ({
      ...template,
      contents:
        template.key === "muschg"
          ? MATERNITY_RISK_ASSESSMENT_CONTENTS
          : template.key === "buero"
            ? OFFICE_RISK_ASSESSMENT_CONTENTS
          : template.key === "tiefbau"
            ? civilEngineeringRiskAssessmentContents()
          : template.key === "asphaltbau"
            ? asphaltRiskAssessmentContents()
          : undefined,
      introSections:
        template.key === "muschg"
          ? MATERNITY_RISK_ASSESSMENT_INTRO
          : template.key === "buero"
            ? OFFICE_RISK_ASSESSMENT_INTRO
          : template.key === "tiefbau"
            ? civilEngineeringRiskAssessmentIntro()
          : template.key === "asphaltbau"
            ? asphaltRiskAssessmentIntro()
          : undefined,
      items:
        template.key === "muschg"
          ? MATERNITY_RISK_ASSESSMENT_ITEMS
          : template.key === "buero"
            ? curateOfficeRiskAssessmentItems(template.items)
          : template.key === "strassenwalze"
            ? curateRoadRollerRiskAssessmentItems(template.items)
          : template.key === "tiefbau"
            ? curateCivilEngineeringRiskAssessmentItems(template.items)
          : template.key === "asphaltbau"
            ? curateAsphaltRiskAssessmentItems(template.items)
          : template.items,
      sourcePdfPath: sourcePdfPaths[template.key],
    }),
  );

function civilEngineeringRiskAssessmentContents() {
  return [
  "1. Allgemeines",
  "2. Zweck",
  "3. Anwendungsgebiet, Geltungsbereich",
  "4. Dokumentation gemäß §5+6 ArbSchG",
  "5. Mitgeltende Dokumente",
  "6. Kap. Baustelleneinrichtung",
  "6.1. GBU – Büroarbeitsplätze / Arbeitsstätten",
  "6.2. GBU – Verkehrswege - allgemein",
  "6.3. GBU – Leitern + Tritte",
  "6.4. GBU – Energieversorgung / Baustrom / Beleuchtung",
  "7. Kap. Baustellenverkehr",
  "7.1. GBU – Arbeiten und Transport auf öffentlichen Straßen",
  "7.2. GBU – Baustellenverkehr",
  "7.3. GBU – Lagern von Material",
  "8. Kap. Geräte / Maschinen / Arbeitsmittel",
  "8.1. GBU – Handwerkzeuge allgemein",
  "8.2. GBU – Elektrische Handmaschinen allgemein",
  "8.3. GBU – Motorisierte Handmaschinen",
  "8.4. GBU – Baustellenkreissäge",
  "8.5. GBU – Erd- und Straßenbaumaschinen",
  "8.6. GBU – Asphaltarbeiten-Straßenfertiger",
  "8.7. GBU – Bohrgeräte im Spezialtiefbau",
  "9. Kap. Kräne / Schwebende Lasten",
  "9.1. GBU – Kranbetrieb",
  "9.2. GBU – Betonsilo ohne Bedienerstand",
  "10. Kap. PSA – Persönliche Schutzausrüstung",
  "10.1. GBU – Persönliche Schutzausrüstung",
  "11. Kap. Arbeitsumgebung / Arbeitsverfahren / Tätigkeiten",
  "11.1. GBU – Querschnittsgefährdungen",
  "11.2. GBU – Demontage / Abbrucharbeiten",
  "11.3. GBU – Rodungsarbeiten",
  "11.4. GBU – Geböschte Baugruben und Gräben",
  "11.5. GBU – Verbaute Gräben – Waagrechter und Senkrechter Verbau",
  "11.6. GBU – Heben und Tragen schwerer Lasten",
  "11.7. GBU – Wand- und Stützschalung",
  "11.8. GBU – Spritzbetonarbeiten",
  "11.9. GBU – Umgang mit Gefahrstoffen",
  "11.10. GBU – Erdverlegte Leitungen",
  "11.1. GBU – Stromleitungen / Freileitungen",
  "11.2. GBU – Kampfmittel (Munition und Bomben im Baufeld)",
  "12. Kap. Notfallmanagement",
  "12.1. GBU – Erste-Hilfe",
  "12.2. GBU – Brandschutz",
  "13. Unterweisungsnachweis",
  "14. Änderungshistorie",
  ];
}

function civilEngineeringRiskAssessmentIntro() {
  return [
  {
    title: "1. Allgemeines",
    paragraphs: [
      "Das Leben und die Gesundheit aller Beschäftigten und betroffener Dritter zu schützen sowie schädliche Auswirkungen auf die Umwelt zu vermeiden, ist erklärtes Ziel der Unternehmensleitung.",
      "Alle Beschäftigten sind ausdrücklich aufgefordert, durch ihr überlegtes und aktives Handeln oder Eingreifen zu sicherer Arbeit und störungsfreiem Arbeitsablauf bei Stix beizutragen.",
      "Bei der Umsetzung diesbezüglicher Maßnahmen sind die anerkannten Regeln der Technik, Vorschriften und Regelwerke der DGUV, Hygieneregeln und sonstige sicherheitsrelevante Vorgaben zu berücksichtigen.",
    ],
  },
  {
    title: "2. Zweck",
    paragraphs: [
      "Mit der vorliegenden Gefährdungsbeurteilung werden die allgemeinen Sicherheitsanforderungen für Arbeiten auf den Baustellen der Josef Stix GmbH & Co.KG und ähnlicher Einsatzbereiche als Arbeitsanweisung verbindlich vorgegeben. Sie ergänzt bereits gesetzlich vorgeschriebene Bestimmungen und weist auf wesentliche Punkte der berufsgenossenschaftlichen Regeln, Richtlinien und Merkblätter hin.",
    ],
  },
  {
    title: "3. Anwendungsgebiet, Geltungsbereich",
    paragraphs: [
      "Die vorliegende projektspezifische Gefährdungsbeurteilung gilt in ihrer jeweils aktuellen Fassung auf der genannten Baustelle der Josef Stix GmbH & Co.KG. Sie gilt für alle Beschäftigten von Stix, für alle Nachunternehmer und Lieferanten sowie sonstige Personen, welche sich auf den von Stix verantworteten Baustellen aufhalten.",
    ],
  },
  {
    title: "4. Dokumentation gemäß §5+6 ArbSchG",
    paragraphs: [
      "Der Arbeitgeber muss über die je nach Art der Tätigkeiten und der Zahl der Beschäftigten erforderlichen Unterlagen verfügen, aus denen das Ergebnis der Gefährdungsbeurteilung, die von ihm festgelegten Maßnahmen des Arbeitsschutzes und das Ergebnis ihrer Überprüfung ersichtlich sind. Bei gleichartiger Gefährdungssituation sind zusammengefasste Angaben ausreichend.",
    ],
  },
  {
    title: "5. Mitgeltende Dokumente",
    paragraphs: [
      "Die zuständige Bauleitung ist zur projektspezifischen Anpassung der vorliegenden Gefährdungsbeurteilung und der mitgeltenden Dokumente verpflichtet, sollten sich im jeweiligen Projekt Abweichungen zur Beurteilung der Gefährdungen beziehungsweise zur Festlegung der Schutzmaßnahmen ergeben.",
      "Mitgeltende Dokumente: A-20-00 GBU-Allgemeine; A-20-10 GBU-Bürotätigkeiten; A-20-20 GBU-Anlagen, Maschinen, Geräte; A-20-30 GBU-Tätigkeiten; A-20-40 GBU-Tiefbau; A-20-50 GBU-Asphaltbau; A-20-60 GBU-MTA, Bauhof, Magazin; A-20-70 GBU-Kieswerk, Deponie; A-20-80 GBU-Projekte; außerdem interne Betriebsanweisungen, Baustellenordnungen und Sicherheitshinweise Lohr in der jeweils aktuellen Fassung.",
    ],
  },
  ];
}

function asphaltRiskAssessmentContents() {
  return [
    "1. Allgemeines",
    "2. Zweck",
    "3. Anwendungsgebiet, Geltungsbereich",
    "4. Dokumentation gemäß §5+6 ArbSchG",
    "5. Mitgeltende Dokumente",
    "6. Kap. Baustellenverkehr",
    "6.1. GBU – Arbeiten und Transport auf öffentlichen Straßen",
    "6.2. GBU – Baustellenverkehr",
    "7. Kap. Geräte / Maschinen / Arbeitsmittel",
    "7.1. GBU – Erd- und Straßenbaumaschinen",
    "7.2. GBU – Straßenfräsen",
    "7.3. GBU – Asphaltarbeiten-Straßenfertiger",
    "7.4. GBU – Straßenwalzen",
    "8. Kap. PSA – Persönliche Schutzausrüstung",
    "8.1. GBU – Persönliche Schutzausrüstung",
    "9. Kap. Arbeitsumgebung / Arbeitsverfahren / Tätigkeiten",
    "9.1. GBU – Querschnittsgefährdungen",
    "9.2. GBU – Umgang mit Gefahrstoffen",
    "9.3. GBU – Stromleitungen / Freileitungen",
    "10. Kap. Notfallmanagement",
    "10.1. GBU – Erste-Hilfe",
    "10.2. GBU – Brandschutz",
    "11. Unterweisungsnachweis",
    "12. Änderungshistorie",
  ];
}

function asphaltRiskAssessmentIntro() {
  const intro = civilEngineeringRiskAssessmentIntro();
  return intro.map((section) =>
    section.title === "5. Mitgeltende Dokumente"
      ? {
          ...section,
          paragraphs: [
            section.paragraphs[0],
            "Mitgeltende Dokumente: A-20-00 GBU-Allgemeine; A-20-10 GBU-Bürotätigkeiten; A-20-20 GBU-Anlagen, Maschinen, Geräte; A-20-30 GBU-Tätigkeiten; A-20-40 GBU-Tiefbau; A-20-50 GBU-Asphaltbau; A-20-60 GBU-MTA, Bauhof, Magazin; A-20-70 GBU-Kieswerk, Deponie; A-20-80 GBU-Projekte; außerdem interne Betriebsanweisungen und Baustellenordnungen in der jeweils aktuellen Fassung.",
          ],
        }
      : section,
  );
}

function curateRoadRollerRiskAssessmentItems(
  items: GeneralRiskAssessmentItem[],
) {
  const result = items.map((item) => ({
    ...item,
    options: "YES_NO" as const,
    ...(item.id === "strassenwalze-2-1-7"
      ? {
          pictograms: [
            "/templates/general-risk-assessments/pictograms/strassenwalze-umsturz.png",
            "/templates/general-risk-assessments/pictograms/strassenwalze-sicherheitsgurt.png",
          ],
        }
      : {}),
  }));
  const vibrationIndex = result.findIndex(
    (item) => item.id === "strassenwalze-4-1-9",
  );
  result.splice(vibrationIndex, 0, {
    activity: "Bedienen von\nStraßenwalzen",
    hazard: "▪ Vibrationen",
    id: "strassenwalze-4-1-8",
    measure:
      "▪ Maschinen mit Vibrationsdämpfung einsetzen.\n▪ Bei Neubeschaffung vibrationsarme Maschinen bevorzugen.\n▪ Expositionszeiten durch wechselnde Tätigkeiten verringern.\n▪ Regelmäßige Wartung und Instandhaltung.",
    options: "YES_NO",
    reference: "BG-Baustein\nD501",
    sourcePage: 4,
  });
  return result;
}

function curateCivilEngineeringRiskAssessmentItems(
  items: GeneralRiskAssessmentItem[],
) {
  let lastActivity = "Betreiben von\nArbeitsstätten";
  const result: GeneralRiskAssessmentItem[] = [];
  for (const item of items) {
    const isHeaderArtifact =
      item.activity === "Interne Nummer:" ||
      (!item.hazard.trim() &&
        (item.measure === "Ausgabe:" ||
          /^\d{4}-\d{2}-\d{2}$/.test(item.measure.trim())));
    if (isHeaderArtifact) continue;

    if (!item.hazard.trim()) {
      const previous = result.at(-1);
      const continuation = [item.measure, item.reference]
        .filter(Boolean)
        .join("\n");
      if (previous && continuation) {
        previous.measure = [previous.measure, continuation]
          .filter(Boolean)
          .join("\n");
      }
      continue;
    }

    const wasShiftedByPdfHeader = item.activity === "A-20-40";
    const activity = wasShiftedByPdfHeader ? lastActivity : item.activity;
    if (activity.trim()) lastActivity = activity;
    const documentSection = civilEngineeringDocumentSection(item);
    const pictograms =
      item.id === "tiefbau-6-0-7"
        ? [
            "/templates/general-risk-assessments/pictograms/tiefbau/sanitaereinrichtungen-tabelle.png",
          ]
        : item.id === "tiefbau-24-1-5"
          ? [
              "/templates/general-risk-assessments/pictograms/tiefbau/trennjaeger-kickback-schnitt.png",
              "/templates/general-risk-assessments/pictograms/tiefbau/trennjaeger-kickback-bereich.png",
            ]
          : item.id === "tiefbau-60-1-3"
            ? [
                "/templates/general-risk-assessments/pictograms/tiefbau/freileitung-sicherheitsabstaende.png",
              ]
            : undefined;
    result.push({
      ...item,
      activity,
      chapterTitle: documentSection.chapterTitle,
      measure:
        wasShiftedByPdfHeader && !item.measure ? item.reference : item.measure,
      options: "YES_NO",
      pictograms,
      reference:
        item.id === "tiefbau-6-0-7"
          ? "ASR A4.1"
          : item.id === "tiefbau-6-0-9"
            ? "DGUV-I 215-410"
            : item.id === "tiefbau-6-0-10"
              ? "ASR A3-4"
              : wasShiftedByPdfHeader
                ? ""
                : item.reference,
      sectionTitle: documentSection.sectionTitle,
    });
  }
  return result;
}

function civilEngineeringDocumentSection(item: GeneralRiskAssessmentItem) {
  if (item.id === "tiefbau-63-2-3") {
    return {
      chapterTitle: "12. Kap. Notfallmanagement",
      sectionTitle: "12.2. GBU – Brandschutz",
    };
  }
  const sections = [
    [63, "12. Kap. Notfallmanagement", "12.1. GBU – Erste-Hilfe"],
    [62, "11. Kap. Arbeitsumgebung / Arbeitsverfahren / Tätigkeiten", "11.2. GBU – Kampfmittel (Munition und Bomben im Baufeld)"],
    [60, "11. Kap. Arbeitsumgebung / Arbeitsverfahren / Tätigkeiten", "11.1. GBU – Stromleitungen / Freileitungen"],
    [58, "11. Kap. Arbeitsumgebung / Arbeitsverfahren / Tätigkeiten", "11.10. GBU – Erdverlegte Leitungen"],
    [57, "11. Kap. Arbeitsumgebung / Arbeitsverfahren / Tätigkeiten", "11.9. GBU – Umgang mit Gefahrstoffen"],
    [55, "11. Kap. Arbeitsumgebung / Arbeitsverfahren / Tätigkeiten", "11.8. GBU – Spritzbetonarbeiten"],
    [53, "11. Kap. Arbeitsumgebung / Arbeitsverfahren / Tätigkeiten", "11.7. GBU – Wand- und Stützschalung"],
    [51, "11. Kap. Arbeitsumgebung / Arbeitsverfahren / Tätigkeiten", "11.6. GBU – Heben und Tragen schwerer Lasten"],
    [50, "11. Kap. Arbeitsumgebung / Arbeitsverfahren / Tätigkeiten", "11.5. GBU – Verbaute Gräben – Waagrechter und Senkrechter Verbau"],
    [48, "11. Kap. Arbeitsumgebung / Arbeitsverfahren / Tätigkeiten", "11.4. GBU – Geböschte Baugruben und Gräben"],
    [46, "11. Kap. Arbeitsumgebung / Arbeitsverfahren / Tätigkeiten", "11.3. GBU – Rodungsarbeiten"],
    [44, "11. Kap. Arbeitsumgebung / Arbeitsverfahren / Tätigkeiten", "11.2. GBU – Demontage / Abbrucharbeiten"],
    [43, "11. Kap. Arbeitsumgebung / Arbeitsverfahren / Tätigkeiten", "11.1. GBU – Querschnittsgefährdungen"],
    [41, "10. Kap. PSA – Persönliche Schutzausrüstung", "10.1. GBU – Persönliche Schutzausrüstung"],
    [39, "9. Kap. Kräne / Schwebende Lasten", "9.2. GBU – Betonsilo ohne Bedienerstand"],
    [36, "9. Kap. Kräne / Schwebende Lasten", "9.1. GBU – Kranbetrieb"],
    [34, "8. Kap. Geräte / Maschinen / Arbeitsmittel", "8.7. GBU – Bohrgeräte im Spezialtiefbau"],
    [33, "8. Kap. Geräte / Maschinen / Arbeitsmittel", "8.6. GBU – Asphaltarbeiten-Straßenfertiger"],
    [28, "8. Kap. Geräte / Maschinen / Arbeitsmittel", "8.5. GBU – Erd- und Straßenbaumaschinen"],
    [26, "8. Kap. Geräte / Maschinen / Arbeitsmittel", "8.4. GBU – Baustellenkreissäge"],
    [24, "8. Kap. Geräte / Maschinen / Arbeitsmittel", "8.3. GBU – Motorisierte Handmaschinen"],
    [20, "8. Kap. Geräte / Maschinen / Arbeitsmittel", "8.2. GBU – Elektrische Handmaschinen allgemein"],
    [18, "8. Kap. Geräte / Maschinen / Arbeitsmittel", "8.1. GBU – Handwerkzeuge allgemein"],
    [17, "7. Kap. Baustellenverkehr", "7.3. GBU – Lagern von Material"],
    [16, "7. Kap. Baustellenverkehr", "7.2. GBU – Baustellenverkehr"],
    [15, "7. Kap. Baustellenverkehr", "7.1. GBU – Arbeiten und Transport auf öffentlichen Straßen"],
    [13, "6. Kap. Baustelleneinrichtung", "6.4. GBU – Energieversorgung / Baustrom / Beleuchtung"],
    [9, "6. Kap. Baustelleneinrichtung", "6.3. GBU – Leitern + Tritte"],
    [8, "6. Kap. Baustelleneinrichtung", "6.2. GBU – Verkehrswege - allgemein"],
    [5, "6. Kap. Baustelleneinrichtung", "6.1. GBU – Büroarbeitsplätze / Arbeitsstätten"],
  ] as const;
  const match = sections.find(([sourcePage]) => item.sourcePage >= sourcePage);
  return {
    chapterTitle: match?.[1],
    sectionTitle: match?.[2],
  };
}

function curateAsphaltRiskAssessmentItems(
  items: GeneralRiskAssessmentItem[],
) {
  let lastActivity = "Arbeiten und Transport auf\nöffentlichen Straßen";
  let insertedPersonalProtectiveEquipment = false;
  const result: GeneralRiskAssessmentItem[] = [];
  for (const item of items) {
    const isHeaderArtifact =
      item.activity === "Interne Nummer:" ||
      (!item.hazard.trim() &&
        (item.measure === "Ausgabe:" ||
          /^\d{4}-\d{2}-\d{2}$/.test(item.measure.trim())));
    if (isHeaderArtifact) continue;
    if (item.sourcePage === 21 && item.hazard.trim()) {
      if (!insertedPersonalProtectiveEquipment) {
        result.push(...asphaltPersonalProtectiveEquipmentItems());
        insertedPersonalProtectiveEquipment = true;
      }
      continue;
    }
    if (!item.hazard.trim()) {
      const previous = result.at(-1);
      const continuation = [item.measure, item.reference]
        .filter(Boolean)
        .join("\n");
      if (previous && continuation) {
        previous.measure = [previous.measure, continuation]
          .filter(Boolean)
          .join("\n");
      }
      continue;
    }
    const wasShiftedByPdfHeader = item.activity === "A-20-50";
    const activity = wasShiftedByPdfHeader ? lastActivity : item.activity;
    if (activity.trim()) lastActivity = activity;
    const documentSection = asphaltDocumentSection(item);
    const contentOverride = asphaltContentOverride(item.id);
    const pictograms =
      item.id === "asphaltbau-18-1-4"
        ? [
            "/templates/general-risk-assessments/pictograms/asphaltbau/strassenwalze-umsturz.png",
            "/templates/general-risk-assessments/pictograms/asphaltbau/strassenwalze-sicherheitsgurt.png",
          ]
        : item.id === "asphaltbau-26-1-3"
          ? [
              "/templates/general-risk-assessments/pictograms/asphaltbau/freileitung-sicherheitsabstaende.png",
            ]
          : undefined;
    result.push({
      ...item,
      activity,
      chapterTitle: documentSection.chapterTitle,
      measure:
        contentOverride?.measure ??
        (wasShiftedByPdfHeader && !item.measure
          ? item.reference
          : item.measure),
      options: "YES_NO",
      pictograms,
      reference:
        contentOverride?.reference ??
        (wasShiftedByPdfHeader ? "" : item.reference),
      sectionTitle: documentSection.sectionTitle,
    });
  }
  return result;
}

function asphaltPersonalProtectiveEquipmentItems(): GeneralRiskAssessmentItem[] {
  const common = {
    activity: "Allgemein",
    chapterTitle: "8. Kap. PSA – Persönliche Schutzausrüstung",
    options: "YES_NO" as const,
    sectionTitle: "8.1. GBU – Persönliche Schutzausrüstung",
    sourcePage: 21,
  };
  return [
    {
      ...common,
      hazard:
        "Kopfschutz / Schutzhelm:\n• Für den Kopfbereich\n• Durch herabfallende Gegenstände",
      id: "asphaltbau-21-psa-kopf",
      measure:
        "• Kopfschutz (Schutzhelme) bereitstellen.\n• Anwendung des Kopfschutzes kontrollieren.",
      reference: "BG-Baustein(e):\nE602",
    },
    {
      ...common,
      hazard: "Augen-Gesichtsschutz:\n• Für Augen und Gesicht",
      id: "asphaltbau-21-psa-augen",
      measure:
        "• Augenschutz (Schutzbrillen) bei allen span-, flamm- und funkenbildenden Tätigkeiten sowie bei Tätigkeiten mit starker Staubentwicklung tragen.\n• Augenschutz (Schutzbrillen) bereitstellen.",
      reference: "BG-Baustein(e):\nE607",
    },
    {
      ...common,
      hazard:
        "Gehörschutzmittel:\n• Durch Lärmbelastungen\n• Gehörschäden",
      id: "asphaltbau-21-psa-gehoer",
      measure:
        "• Schallschutz (Gehörschutzmittel) ab 85 dB.\n• Einsatz lärmgeminderter Baumaschinen bzw. Baugeräte.\n• Vorsorge Typ Lärm anbieten.\n• Geeignete Gehörschutzmittel bereitstellen.\n• Bei Bedarf Unterweisungen im Lärmbereich durchführen.",
      reference: "BG-Baustein(e):\nE609\nDGUV-R 112-198",
    },
    {
      ...common,
      hazard: "Fußschutz:\n• Gefahren für Füße, Beine und Knie",
      id: "asphaltbau-21-psa-fuss",
      measure:
        "• Fußschutz (Sicherheitsschuhe) bereitstellen.\n• Fußschutz S3/S5 für Arbeiten auf Baustellen.\n• Sicherheitsschuhe mit wärmeisolierendem Unterbau benutzen.\n• Abhängig von der Tätigkeit Knieschutz bereitstellen und anwenden.",
      reference: "BG-Baustein(e):\nE600\nE608",
    },
    {
      ...common,
      hazard: "Hand- / Hautschutz:\n• Gefahren für Hände und Haut",
      id: "asphaltbau-21-psa-hand",
      measure:
        "• Geeignete Schutzhandschuhe bereitstellen.\n• Handschuhplan beachten.\n• Hautreinigungs-, Hautschutz- und Hautpflegemittel bereitstellen.",
      reference: "BG-Baustein(e):\nE604",
    },
    {
      ...common,
      hazard: "Atemschutz:\n• Gefahren für Atemorgane",
      id: "asphaltbau-21-psa-atem",
      measure:
        "• Geeigneten Filter-Atemschutz bereitstellen.\n• Außenluftunabhängigen Atemschutz bereitstellen.\n• Beschäftigte in Atemschutzgeräte einweisen.\n• Vorsorgeuntersuchung anbieten und durchführen.",
      reference: "BG-Baustein(e):\nE603",
    },
  ];
}

function asphaltContentOverride(id: string) {
  switch (id) {
    case "asphaltbau-23-1-2":
      return {
        measure:
          "• Lärmarme Arbeitsverfahren einsetzen.\n• Lärmgeminderte Baumaschinen und Baugeräte einsetzen.\n• Lärmintensive Geräte oder Baumaschinen fernbedienen.\n• Lärmquellen durch Lärmschutzwände oder Kapselung abschirmen.\n• Persönliche Schutzausrüstung (Gehörschutz) bereitstellen.",
        reference: "",
      };
    case "asphaltbau-23-1-3":
      return {
        measure:
          "• Lärm-Beurteilungspegel ermitteln.\n• Lärmbereiche kennzeichnen.\n• Arbeitszeiten in Lärmbereichen beschränken.\n• Arbeitsmedizinische Vorsorge bei Beurteilungspegeln über 85 dB(A) veranlassen.",
        reference: "",
      };
    case "asphaltbau-23-1-4":
      return {
        measure:
          "• Staubfreie oder staubarme Arbeitsverfahren auswählen.\n• Staubbindung bzw. Staubniederschlag einsetzen.\n• Technische Lüftung bei Stäuben, Dämpfen und Aerosolen einsetzen.\n• Persönliche Schutzausrüstung wie Atemschutz, Schutzkleidung und Schutzhandschuhe bereitstellen.",
        reference: "BG-Baustein(e):\nE603",
      };
    case "asphaltbau-23-1-5":
      return {
        measure:
          "• Arbeits- und Straßenkleidung getrennt aufbewahren.\n• Reinigung der Arbeitskleidung veranlassen.\n• Arbeitsmedizinische Vorsorge veranlassen.",
        reference: "",
      };
    case "asphaltbau-23-1-6":
      return {
        measure:
          "• Arbeitsplätze möglichst gegen Wind, Kälte und Regen schützen.\n• Schutzkleidung gegen Kälte und Regen bereitstellen.",
        reference: "BG-Baustein(e):\nD505\nE606",
      };
    case "asphaltbau-24-0-7":
      return {
        measure:
          "• Arbeitszeiten und Pausen anpassen, um direkte Sonneneinstrahlung insbesondere von 11 bis 15 Uhr zu vermeiden.\n• Baumaschinen und Fahrzeuge mit Klimaanlagen ausstatten.\n• Für gute Belüftung von Arbeitsbereichen im Inneren von Bauwerken sorgen.",
        reference: "BG-Baustein(e):\nD505",
      };
    case "asphaltbau-24-0-8":
      return {
        measure:
          "• Kopfschutz mit Nacken- und Ohrenschutz bereitstellen.\n• Luft- und feuchtigkeitsdurchlässige Unterbekleidung tragen.\n• Langärmelige Arbeitskleidung tragen.\n• Schutzbrille mit Seiten- und UV-Schutz tragen.",
        reference: "BG-Baustein(e):\nD505",
      };
    case "asphaltbau-24-0-9":
      return {
        measure:
          "• Sonnenschutzcreme mit hohem Lichtschutzfaktor bereitstellen.\n• Mineralwasser und Getränke bereitstellen.\n• Häufige Kurzpausen oder Trinkpausen im Schatten einplanen.\n• Getränke in ausreichenden Mengen zu sich nehmen.\n• Leichte Mahlzeiten einnehmen.",
        reference: "BG-Baustein(e):\nD505",
      };
    default:
      return undefined;
  }
}

function asphaltDocumentSection(item: GeneralRiskAssessmentItem) {
  if (item.id === "asphaltbau-28-2-3") {
    return {
      chapterTitle: "10. Kap. Notfallmanagement",
      sectionTitle: "10.2. GBU – Brandschutz",
    };
  }
  const sections = [
    [28, "10. Kap. Notfallmanagement", "10.1. GBU – Erste-Hilfe"],
    [26, "9. Kap. Arbeitsumgebung / Arbeitsverfahren / Tätigkeiten", "9.3. GBU – Stromleitungen / Freileitungen"],
    [25, "9. Kap. Arbeitsumgebung / Arbeitsverfahren / Tätigkeiten", "9.2. GBU – Umgang mit Gefahrstoffen"],
    [23, "9. Kap. Arbeitsumgebung / Arbeitsverfahren / Tätigkeiten", "9.1. GBU – Querschnittsgefährdungen"],
    [21, "8. Kap. PSA – Persönliche Schutzausrüstung", "8.1. GBU – Persönliche Schutzausrüstung"],
    [16, "7. Kap. Geräte / Maschinen / Arbeitsmittel", "7.4. GBU – Straßenwalzen"],
    [13, "7. Kap. Geräte / Maschinen / Arbeitsmittel", "7.3. GBU – Asphaltarbeiten-Straßenfertiger"],
    [10, "7. Kap. Geräte / Maschinen / Arbeitsmittel", "7.2. GBU – Straßenfräsen"],
    [6, "7. Kap. Geräte / Maschinen / Arbeitsmittel", "7.1. GBU – Erd- und Straßenbaumaschinen"],
    [5, "6. Kap. Baustellenverkehr", "6.2. GBU – Baustellenverkehr"],
    [4, "6. Kap. Baustellenverkehr", "6.1. GBU – Arbeiten und Transport auf öffentlichen Straßen"],
  ] as const;
  const match = sections.find(([sourcePage]) => item.sourcePage >= sourcePage);
  return {
    chapterTitle: match?.[1],
    sectionTitle: match?.[2],
  };
}

export function getGeneralRiskAssessmentTemplate(key: string) {
  return GENERAL_RISK_ASSESSMENT_TEMPLATES.find(
    (template) => template.key === key,
  );
}

export function parseGeneralRiskAssessmentAnswers(value: string) {
  try {
    return JSON.parse(value) as Record<string, GeneralRiskAssessmentAnswer>;
  } catch {
    return {};
  }
}
