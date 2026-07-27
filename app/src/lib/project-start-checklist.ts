export const PROJECT_START_CHECKLIST_TEMPLATE = {
  code: "A-30-30-001",
  issuedAt: "2024-09-23",
  revision: "00",
  title: "GBU-Projektstart – Tiefbau / Asphaltbau",
  wordTemplate: "A-30-30-001-Projektstart-Tiefbau-Rev00.docx",
} as const;

export const PROJECT_START_ACTIVITIES = [
  "Tiefbau",
  "Rohrleitungsbau",
  "Anlagenbau",
  "Asphaltarbeiten",
  "Begehen von Gruben/Gräben",
  "Begehen von Gerüsten",
  "Leitern und Tritte",
  "Einstieg in Schächten",
  "Arbeiten mit Handmaschinen",
  "Arbeiten mit Gefahrstoffen",
  "Arbeiten mit Erdbaumaschinen",
  "Arbeiten mit Verdichtungsgeräten",
] as const;

export type ProjectStartAssessmentStatus = "OK" | "NOT_OK" | "NOT_RELEVANT";

export const PROJECT_START_ASSESSMENT_SECTIONS = [
  {
    id: "D1",
    title: "Baustelleneinrichtung / -organisation",
    questions: [
      ["1.1", "Sind ausreichend Sozial-, Wasch- und Toilettencontainer vorhanden?", "A22"],
      ["1.2", "Sind Mittel der Ersten Hilfe und des Brandschutzes ausreichend vorhanden?", "A4, A5, A21"],
      ["1.3", "Wurden Baustromverteiler ordnungsgemäß angeschlossen und geprüft?", "B171"],
      ["1.4", "Werden RCD-Schutzschalter täglich vor der Arbeit überprüft?", "B171"],
      ["1.5", "Sind Lagerplätze vorhanden beziehungsweise ausreichend bemessen?", "B217"],
      ["1.6", "Liegt die aktuelle verkehrsrechtliche Anordnung vor?", "A008"],
      ["1.7", "Sind Baustellenbereiche ordnungsgemäß abgesperrt beziehungsweise gekennzeichnet?", "A008"],
      ["1.8", "Sind Verkehrswege sicher ausgeführt und gefährdete Bereiche gesichert?", "A026"],
    ],
  },
  {
    id: "D2",
    title: "Baustellenumgebung",
    questions: [
      ["2.1", "Falls erforderlich: Liegen Arbeitsgenehmigungen der Auftraggeber vor?", "/"],
      ["2.2", "Wurden Fremdleitungspläne bei den Netzbetreibern eingeholt?", "E601"],
      ["2.3", "Sind Frei- beziehungsweise Fahrleitungen in der Nähe und sind Schutzmaßnahmen sowie Sicherheitsabstände abgestimmt und bekannt?", "C412"],
      ["2.4", "Werden Arbeiten in der Nähe von Gleisen ausgeführt, sind die Sicherheitsmaßnahmen bekannt und die Personen unterwiesen?", "C431"],
    ],
  },
  {
    id: "D3",
    title: "Persönliche Schutzausrüstung – PSA",
    questions: [
      ["3.1", "Ist die geeignete Schutzausrüstung für die kommenden Arbeiten verfügbar?", "Kap. E"],
      ["3.2", "Wird spezielle PSA benötigt, zum Beispiel PSA gegen Absturz?", "E601"],
      ["3.3", "Wird die Warnkleidung im Baustellen- beziehungsweise Verkehrsbereich getragen?", "E606"],
      ["3.4", "Werden Rettungsgeräte oder Rettungstransportmittel benötigt und eingesetzt?", "A005"],
    ],
  },
  {
    id: "D4",
    title: "Arbeitsmittel / Geräte / Maschinen",
    questions: [
      ["4.1", "Sind alle verwendeten Arbeitsmittel CE- beziehungsweise UVV-geprüft?", "A007"],
      ["4.2", "Sind elektrische Betriebsmittel gemäß DGUV Vorschrift 3 geprüft und einsatzbereit?", "A007"],
      ["4.3", "Werden tägliche Sichtprüfungen von den Beschäftigten durchgeführt?", "A007"],
      ["4.4", "Sind Personen, die Geräte bedienen, qualifiziert beziehungsweise beauftragt?", "B181"],
    ],
  },
  {
    id: "D5",
    title: "Hebezeuge / Anschlagmittel",
    questions: [
      ["5.1", "Sind alle verwendeten Hebezeuge ausreichend bemessen und geprüft?", "B214"],
      ["5.2", "Sind Ketten und Seile unbeschädigt und haben eine Prüfkennzeichnung?", "B164"],
      ["5.3", "Werden Arbeiten unter schwebenden Lasten vermieden?", "C361"],
    ],
  },
  {
    id: "D6",
    title: "Gruben / Gräben / Verbau",
    questions: [
      ["6.1", "Sind Baugruben und Gräben gemäß DIN 4124 geplant und ausgeführt?", "C469"],
      ["6.2", "Sind Absturzsicherungen an Baugruben oder Gräben erforderlich?", "B100"],
      ["6.3", "Sind Leitungsgräben in Abhängigkeit vom Leitungsdurchmesser geplant?", "H906"],
    ],
  },
  {
    id: "D7",
    title: "Rohrleitungsbau",
    questions: [
      ["7.1", "Werden Rohrleitungen sicher gelagert?", "C473"],
      ["7.2", "Werden Rohrleitungen sicher gehoben und transportiert?", "C473"],
      ["7.3", "Wird die entsprechende PSA für Arbeiten an Rohr- beziehungsweise Gasleitungen verwendet?", "C473"],
      ["7.4", "Werden Arbeiten an Gasleitungen durchgeführt, sind die Bereiche freigemessen und die Schutzmaßnahmen festgelegt?", "C482"],
      ["7.5", "Werden Arbeiten in Rohrleitungen geplant und sind spezielle Schutzmaßnahmen bekannt und unterwiesen?", "C473"],
    ],
  },
] as const;
