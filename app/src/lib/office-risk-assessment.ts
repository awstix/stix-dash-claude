import type {
  GeneralRiskAssessmentIntroSection,
  GeneralRiskAssessmentItem,
} from "./general-risk-assessments";

export const OFFICE_RISK_ASSESSMENT_CONTENTS = [
  "1. Allgemeines",
  "2. Zweck",
  "3. Anwendungsgebiet, Geltungsbereich",
  "4. Mitgeltende Dokumente",
  "5. Dokumentation gemäß §5+6 ArbSchG",
  "6. Kap. Allgemeine Büroarbeiten",
  "7. GBU – Büro- und Bildschirmarbeiten",
  "8. GBU – Benutzung von Leitern + Tritten",
  "9. GBU – Heben und Tragen schwerer Lasten",
  "10. Änderungshistorie",
];

export const OFFICE_RISK_ASSESSMENT_INTRO: GeneralRiskAssessmentIntroSection[] =
  [
    {
      paragraphs: [
        "Das Leben und die Gesundheit aller Beschäftigten und betroffener Dritter zu schützen sowie schädliche Auswirkungen auf die Umwelt zu vermeiden, ist erklärtes Ziel der Unternehmensleitung.",
        "Alle Beschäftigten sind ausdrücklich aufgefordert, durch ihr überlegtes und aktives Handeln oder Eingreifen zu sicherer Arbeit und störungsfreiem Arbeitsablauf bei der Josef Stix GmbH & Co.KG, im Folgenden auch Stix genannt, beizutragen.",
        "Bei der Umsetzung diesbezüglicher Maßnahmen sind die anerkannten Regeln der Technik, Vorschriften- und Regelwerk der DGUV, Hygieneregeln und sonstige sicherheitsrelevante Vorgaben zu berücksichtigen.",
      ],
      title: "1. Allgemeines",
    },
    {
      paragraphs: [
        "Mit der vorliegenden Gefährdungsbeurteilung werden die allgemeinen Sicherheitsanforderungen für Arbeiten auf den Baustellen der Josef Stix GmbH & Co.KG und ähnlicher Einsatzbereiche als Arbeitsanweisung verbindlich vorgegeben. Sie ergänzt bereits gesetzlich vorgeschriebene Bestimmungen und weist auf wesentliche Punkte der berufsgenossenschaftlichen Regeln, Richtlinien und Merkblätter hin.",
      ],
      title: "2. Zweck",
    },
    {
      paragraphs: [
        "Die vorliegende projektspezifische Gefährdungsbeurteilung gilt in ihrer jeweils aktuellen Fassung immer und auf der genannten Baustelle der Josef Stix GmbH & Co.KG. Sie gilt für alle Beschäftigte von Stix, für alle Nachunternehmer und Lieferanten sowie sonstige Personen, welche sich auf den von Stix verantwortenden Baustellen aufhalten.",
      ],
      title: "3. Anwendungsgebiet, Geltungsbereich",
    },
    {
      paragraphs: [
        "Die zuständige Bauleitung ist zur projektspezifischen Anpassung der vorliegenden Gefährdungsbeurteilung und den mitgeltenden Dokumenten verpflichtet, sollten sich im jeweiligen Projekt Abweichungen zur Beurteilung der Gefährdungen bzw. zur Festlegung der Schutzmaßnahmen ergeben.",
        "A-20-00 – GBU Allgemein",
        "A-20-10 – GBU Bürotätigkeiten",
        "A-20-20 – GBU Anlagen, Maschinen, Geräte",
        "A-20-30 – GBU Tätigkeiten",
        "A-20-40 – GBU Tiefbau",
        "A-20-50 – GBU Asphaltbau",
        "A-20-60 – GBU MTA, Bauhof, Magazin",
        "A-20-70 – GBU Kieswerk, Deponie",
        "A-20-80 – GBU Projekte",
        "Sowie interne Betriebsanweisungen und Baustellenordnungen in der jeweils aktuellen Fassung.",
      ],
      title: "4. Mitgeltende Dokumente",
    },
    {
      paragraphs: [
        "Der Arbeitgeber muss über die je nach Art der Tätigkeiten und der Zahl der Beschäftigten erforderlichen Unterlagen verfügen, aus denen das Ergebnis der Gefährdungsbeurteilung, die von ihm festgelegten Maßnahmen des Arbeitsschutzes und das Ergebnis ihrer Überprüfung ersichtlich sind. Bei gleichartiger Gefährdungssituation ist es ausreichend, wenn die Unterlagen zusammengefasste Angaben enthalten.",
      ],
      title: "5. Dokumentation gemäß §5+6 ArbSchG",
    },
  ];

export function curateOfficeRiskAssessmentItems(
  sourceItems: GeneralRiskAssessmentItem[],
) {
  const byId = new Map(sourceItems.map((item) => [item.id, item]));
  const group = (
    id: string,
    activity: string,
    sourceIds: string[],
    hazard?: string,
    extraMeasure = "",
  ): GeneralRiskAssessmentItem => {
    const sources = sourceIds
      .map((sourceId) => byId.get(sourceId))
      .filter((item): item is GeneralRiskAssessmentItem => Boolean(item));
    return {
      activity,
      hazard:
        hazard ??
        sources.find((item) => item.hazard.trim())?.hazard.trim() ??
        "Allgemein",
      id,
      kind: "choice",
      measure: [
        ...sources.map((item) => item.measure.trim()).filter(Boolean),
        extraMeasure,
      ]
        .filter(Boolean)
        .join("\n\n"),
      options: "YES_NO",
      reference: sources
        .map((item) => item.reference.trim())
        .filter(Boolean)
        .join("\n"),
      sourcePage: Math.min(...sources.map((item) => item.sourcePage)),
    };
  };

  const office = "7. GBU – Büro- und Bildschirmarbeiten";
  const ladders = "8. GBU – Benutzung von Leitern + Tritten";
  const lifting = "9. GBU – Heben und Tragen schwerer Lasten";
  return [
    group("b-office-1", office, ["buero-4-1-5"]),
    group("b-office-2", office, [
      "buero-4-1-6",
      "buero-4-1-7",
      "buero-5-0-10",
    ]),
    group("b-office-3", office, ["buero-5-0-11"]),
    group("b-office-4", office, ["buero-5-0-12", "buero-6-0-10"]),
    group("b-office-5", office, ["buero-6-0-11"]),
    group("b-office-6", office, ["buero-6-0-12"]),
    group("b-office-7", office, ["buero-6-0-13", "buero-7-0-10"]),
    group("b-office-8", office, ["buero-7-0-11"]),
    group("b-office-9", office, ["buero-7-0-12"]),
    group(
      "b-office-10",
      office,
      ["buero-7-0-14"],
      undefined,
      "Ggf. Verwenden eines Sitzkeils und einer Fußstütze für kleine Mitarbeiter.\nBildschirm leicht dreh- und neigbar ausführen.\nTastatur getrennt vom Bildschirm; Auflagemöglichkeit für Handballen.\nStuhl- und Tischhöhen so einstellen, dass die Winkel zwischen Ober- und Unterschenkel sowie Ober- und Unterarm etwa 90° betragen.\nDauerhafte einseitige Belastungen vermeiden. Beinfreiheit unter Tischen herstellen. Blickwinkel zwischen Schreibvorlage und Bildschirm gering halten. Dynamisches Sitzen fördern. Häufige und längere Dateneingabe durch Pausen oder andere Tätigkeiten unterbrechen.",
    ),
    group("b-office-11", office, ["buero-8-0-11"]),
    group("b-office-12", office, ["buero-8-0-12"]),
    group("b-office-13", office, ["buero-9-0-10"]),
    group("b-ladders-1", ladders, ["buero-9-1-5"]),
    group("b-ladders-2", ladders, ["buero-9-1-6"]),
    group("b-ladders-3", ladders, ["buero-9-1-7", "buero-10-0-10"]),
    group("b-lifting-1", lifting, ["buero-10-1-5", "buero-11-0-10"]),
    group("b-lifting-2", lifting, ["buero-11-0-11"]),
    group("b-lifting-3", lifting, ["buero-11-0-12"]),
  ];
}
