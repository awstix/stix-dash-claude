import type {
  GeneralRiskAssessmentIntroSection,
  GeneralRiskAssessmentItem,
} from "./general-risk-assessments";

const choice = (
  id: string,
  activity: string,
  hazard: string,
  sourcePage: number,
  options: "YES_NO" | "YES_NO_NA" = "YES_NO_NA",
): GeneralRiskAssessmentItem => ({
  activity,
  hazard,
  id,
  kind: "choice",
  measure: "",
  options,
  reference: "",
  sourcePage,
});

const heading = (
  id: string,
  activity: string,
  hazard: string,
  sourcePage: number,
): GeneralRiskAssessmentItem => ({
  activity,
  hazard,
  id,
  kind: "heading",
  measure: "",
  reference: "",
  sourcePage,
});

const text = (
  id: string,
  activity: string,
  hazard: string,
  sourcePage: number,
): GeneralRiskAssessmentItem => ({
  activity,
  hazard,
  id,
  kind: "text",
  measure: "",
  reference: "",
  sourcePage,
});

const note = (
  id: string,
  activity: string,
  hazard: string,
  sourcePage: number,
): GeneralRiskAssessmentItem => ({
  activity,
  hazard,
  id,
  kind: "note",
  measure: "",
  reference: "",
  sourcePage,
});

export const MATERNITY_RISK_ASSESSMENT_CONTENTS = [
  "1. Allgemeines",
  "2. Zweck",
  "3. Anwendungsgebiet, Geltungsbereich",
  "4. Mitgeltende Dokumente",
  "5. Dokumentation gemäß §5+6 ArbSchG",
  "6. Checkliste – Mutterschutzgesetz §10",
  "7. Mitgeltende Dokumente",
  "8. Anlage",
  "9. Unterweisungsnachweis",
  "10. Änderungshistorie",
];

export const MATERNITY_RISK_ASSESSMENT_INTRO: GeneralRiskAssessmentIntroSection[] =
  [
    {
      paragraphs: [
        "Das Leben und die Gesundheit aller Beschäftigten und betroffener Dritter zu schützen sowie schädliche Auswirkungen auf die Umwelt zu vermeiden, ist erklärtes Ziel der Unternehmensleitung.",
        "Alle Beschäftigten sind ausdrücklich aufgefordert, durch ihr überlegtes und aktives Handeln oder Eingreifen zu sicherer Arbeit und störungsfreiem Arbeitsablauf bei Stix beizutragen.",
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
        "Bei Bekanntwerden einer Schwangerschaft muss die vorliegende Gefährdungsbeurteilung von der direkten vorgesetzten Person im Unternehmen mit Unterstützung der zuständigen Sicherheitsfachkraft bearbeitet, besprochen und unterwiesen werden.",
      ],
      title: "3. Anwendungsgebiet, Geltungsbereich",
    },
    {
      paragraphs: [
        "Die zuständige Bauleitung ist zur projektspezifischen Anpassung der vorliegenden Gefährdungsbeurteilung und den mitgeltenden Dokumenten verpflichtet, sollten sich im jeweiligen Projekt Abweichungen zur Beurteilung der Gefährdungen bzw. zur Festlegung der Schutzmaßnahmen ergeben.",
        "A-20-00 – GBU Allgemein",
        "A-20-10 – GBU Bürotätigkeit",
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
        "§10 MuSchG – Beurteilung der Arbeitsbedingungen; Schutzmaßnahmen",
        "(1) Im Rahmen der Beurteilung der Arbeitsbedingungen nach § 5 des Arbeitsschutzgesetzes hat der Arbeitgeber für jede Tätigkeit 1. die Gefährdungen nach Art, Ausmaß und Dauer zu beurteilen, denen eine schwangere oder stillende Frau oder ihr Kind ausgesetzt ist oder sein kann, und 2. unter Berücksichtigung des Ergebnisses der Beurteilung der Gefährdung nach Nummer 1 zu ermitteln, ob für eine schwangere oder stillende Frau oder ihr Kind voraussichtlich a) keine Schutzmaßnahmen erforderlich sein werden, b) eine Umgestaltung der Arbeitsbedingungen nach § 13 Absatz 1 Nummer 1 erforderlich sein wird oder c) eine Fortführung der Tätigkeit der Frau an diesem Arbeitsplatz nicht möglich sein wird.",
        "Bei gleichartigen Arbeitsbedingungen ist die Beurteilung eines Arbeitsplatzes oder einer Tätigkeit ausreichend.",
        "(2) Sobald eine Frau dem Arbeitgeber mitgeteilt hat, dass sie schwanger ist oder stillt, hat der Arbeitgeber unverzüglich die nach Maßgabe der Gefährdungsbeurteilung nach Absatz 1 erforderlichen Schutzmaßnahmen festzulegen. Zusätzlich hat der Arbeitgeber der Frau ein Gespräch über weitere Anpassungen ihrer Arbeitsbedingungen anzubieten.",
        "(3) Der Arbeitgeber darf eine schwangere oder stillende Frau nur diejenigen Tätigkeiten ausüben lassen, für die er die erforderlichen Schutzmaßnahmen nach Absatz 2 Satz 1 getroffen hat.",
      ],
      title: "5. Dokumentation gemäß §5+6 ArbSchG",
    },
  ];

export const MATERNITY_RISK_ASSESSMENT_ITEMS: GeneralRiskAssessmentItem[] = [
  heading("m-a-a", "A · Physikalische Gefährdungen", "a) Heben, tragen oder bewegen von Lasten, ohne mechanische Hilfsmittel", 5),
  choice("m-a-a1", "A · Physikalische Gefährdungen", "– regelmäßig mehr als 5 kg", 5),
  choice("m-a-a2", "A · Physikalische Gefährdungen", "– gelegentlich mehr als 10 kg", 5),
  note("m-a-note", "A · Physikalische Gefährdungen", "Werden mechanische Hilfsmittel eingesetzt, so gilt die körperliche Beanspruchung entsprechend.", 5),
  choice("m-a-b", "A · Physikalische Gefährdungen", "b) Hitze", 5),
  choice("m-a-c", "A · Physikalische Gefährdungen", "c) Kälte", 5),
  choice("m-a-d", "A · Physikalische Gefährdungen", "d) Nässe", 5),
  choice("m-a-e", "A · Physikalische Gefährdungen", "e) Lärm mit einem Beurteilungspegel (Leq) > 80 dB (A), ggf. Messung veranlassen, oder impulshaltige Geräusche", 5),
  choice("m-a-f", "A · Physikalische Gefährdungen", "f) Stöße und Erschütterungen auf oder in der Nähe von Maschinen", 5),
  heading("m-a-g", "A · Physikalische Gefährdungen", "g) Ionisierende Strahlung", 5),
  choice("m-a-g1", "A · Physikalische Gefährdungen", "– Tätigkeit im Kontrollbereich", 5),
  choice("m-a-g2", "A · Physikalische Gefährdungen", "– Sonstige Tätigkeiten", 5),
  choice("m-a-h", "A · Physikalische Gefährdungen", "h) Genehmigungspflichtiger Umgang mit offenen radioaktiven Stoffen", 5),
  heading("m-a-i", "A · Physikalische Gefährdungen", "i) Nicht ionisierende Strahlung", 5),
  choice("m-a-i1", "A · Physikalische Gefährdungen", "– Kernspintomographie", 5),
  choice("m-a-i2", "A · Physikalische Gefährdungen", "– sonstige extreme elektromagnetische Felder", 5),
  heading("m-a-j", "A · Physikalische Gefährdungen", "j) Ständiges Stehen", 5),
  choice("m-a-j1", "A · Physikalische Gefährdungen", "– Sitzgelegenheit nicht vorhanden", 5),
  choice("m-a-j2", "A · Physikalische Gefährdungen", "– länger als 4 Stunden täglich", 5),
  choice("m-a-k", "A · Physikalische Gefährdungen", "k) Häufig erhebliches Strecken oder Beugen oder dauerhaftes Hocken oder sich gebückt halten", 5),
  choice("m-a-l", "A · Physikalische Gefährdungen", "l) Beschäftigung auf Fahrzeugen (Fahrzeit mehr als 4 Stunden täglich)", 5),

  text("m-b-substances", "B · Gefährdungen durch chemische Arbeitsstoffe", "Sofern ja, welche Gefahrstoffe? (Siehe Gefahrstoffkataster, Sicherheitsdatenblätter, Stoffkennzeichnung)", 6),
  heading("m-b-1", "B · Gefährdungen durch chemische Arbeitsstoffe", "1. Krebserzeugende, erbgutverändernde oder fruchtschädigende Gefahrstoffe", 6),
  choice("m-b-1a", "B · Gefährdungen durch chemische Arbeitsstoffe", "a) Befinden sich im Arbeitsumfeld der werdenden Mutter Stoffe mit der Einstufung als krebserzeugend nach Kategorie 1 oder 2 bzw. nach TRGS 905 (R 45, R 46, R 49 oder R 61)?", 6),
  choice("m-b-1b", "B · Gefährdungen durch chemische Arbeitsstoffe", "b) Befinden sich im Arbeitsumfeld Stoffe der Kategorie 3 bzw. Verdachtsstoffe nach TRGS 905 (R 40 oder R 68)?", 6),
  choice("m-b-1c", "B · Gefährdungen durch chemische Arbeitsstoffe", "c) Arbeitet die werdende Mutter selbst mit diesen krebserzeugenden, erbgutverändernden oder fruchtschädigenden Gefahrstoffen?", 6),
  choice("m-b-1d", "B · Gefährdungen durch chemische Arbeitsstoffe", "d) Ist die werdende Mutter diesen Gefahrstoffen ausgesetzt, weil andere Beschäftigte im gleichen Arbeitsraum damit arbeiten?", 6),
  heading("m-b-2", "B · Gefährdungen durch chemische Arbeitsstoffe", "2. Sehr giftige, giftige, gesundheitsschädliche oder in sonstiger Weise den Menschen chronisch schädigende Stoffe", 6),
  choice("m-b-2a", "B · Gefährdungen durch chemische Arbeitsstoffe", "a) Hat die werdende Mutter Kontakt mit entsprechend eingestuften Gefahrstoffen?", 6),
  choice("m-b-2b", "B · Gefährdungen durch chemische Arbeitsstoffe", "b) Werden die Grenzwerte überschritten (ggf. Messung veranlassen)? Bei Grenzwertüberschreitung besteht ein Beschäftigungsverbot.", 6),
  choice("m-b-2c", "B · Gefährdungen durch chemische Arbeitsstoffe", "c) Besteht unmittelbarer Hautkontakt mit hautresorptiven Gefahrstoffen?", 6),

  choice("m-c-1", "C · Gefährdungen durch biologische Arbeitsstoffe", "1. Umgang mit Stoffen, Zubereitungen oder Erzeugnissen, die erfahrungsgemäß Krankheitserreger übertragen können (z. B. Gewebe, Blut, Körperflüssigkeiten und -ausscheidungen)", 7),
  choice("m-c-2", "C · Gefährdungen durch biologische Arbeitsstoffe", "2. Exposition gegenüber sonstigen Erregern der Risikogruppen 2–4 (Viren, Bakterien, Pilze), die für die werdende Mutter oder die Leibesfrucht gefährlich sind", 7),
  choice("m-c-3", "C · Gefährdungen durch biologische Arbeitsstoffe", "3. Arbeiten mit besonderer Gefahr des Entstehens einer Berufskrankheit oder erhöhter Gefährdung für die werdende Mutter bzw. das ungeborene Kind", 7),

  choice("m-d-1", "D · Gefährdungen durch Arbeitsbedingungen und Arbeitsverfahren", "1. Arbeiten bei Überdruck (z. B. in Druckkammern, beim Tauchen)", 7),
  choice("m-d-2", "D · Gefährdungen durch Arbeitsbedingungen und Arbeitsverfahren", "2. Arbeiten mit erhöhten Unfallgefahren, insbesondere Ausgleiten, Abstürzen oder Fallen; Umgang mit potenziell aggressiven Personen", 7),
  choice("m-d-3", "D · Gefährdungen durch Arbeitsbedingungen und Arbeitsverfahren", "3. Akkordarbeit, Fließarbeit mit vorgeschriebenem Arbeitstempo u. ä.", 7),

  choice("m-e-1", "E · Arbeitszeit", "1. Nachtarbeit (§ 8 Abs. 1 und 3 MuSchG)", 7),
  choice("m-e-2", "E · Arbeitszeit", "2. Mehrarbeit: mehr als 8,5 Stunden täglich oder 90 Stunden in der Doppelwoche (unter 18 Jahre: 8 Stunden täglich oder 80 Stunden in der Doppelwoche)", 7),

  text("m-f-notes", "F · Bemerkungen und ggf. weitere Gefährdungsfaktoren", "Bemerkungen und ggf. weitere Gefährdungsfaktoren", 8),

  choice("m-g-1", "G · Ergebnis der Arbeitsplatzbeurteilung", "1. Die Beschäftigte ist keiner Gefährdung nach mutterschutzrechtlichen Vorschriften ausgesetzt. Es sind keine weiteren Maßnahmen erforderlich.", 8, "YES_NO"),
  choice("m-g-2", "G · Ergebnis der Arbeitsplatzbeurteilung", "2. Eine Gefährdung liegt vor oder ist nicht mit Sicherheit auszuschließen. Entsprechende Maßnahmen sind umgehend zu veranlassen.", 8, "YES_NO"),
  choice("m-g-3", "G · Ergebnis der Arbeitsplatzbeurteilung", "3. Die betroffene Arbeitnehmerin sowie die übrigen Arbeitnehmerinnen und Arbeitnehmer wurden über das Ergebnis der Beurteilung unterrichtet.", 8, "YES_NO"),

  text("m-h-name", "H · Maßnahmen bei Bekanntwerden einer Schwangerschaft", "Name der werdenden Mutter", 8),
  choice("m-h-a", "H · Maßnahmen bei Bekanntwerden einer Schwangerschaft", "a) Änderung der Arbeitsbedingungen veranlasst", 8, "YES_NO"),
  text("m-h-a-details", "H · Maßnahmen bei Bekanntwerden einer Schwangerschaft", "Datum und Beschreibung der geänderten Arbeitsbedingungen", 8),
  choice("m-h-b", "H · Maßnahmen bei Bekanntwerden einer Schwangerschaft", "b) Arbeitsplatzwechsel veranlasst", 9, "YES_NO"),
  text("m-h-b-details", "H · Maßnahmen bei Bekanntwerden einer Schwangerschaft", "Datum und neuer Arbeitsplatz", 9),
  choice("m-h-c", "H · Maßnahmen bei Bekanntwerden einer Schwangerschaft", "c) Ist die weitere Beschäftigung der werdenden/stillenden Mutter ohne Gefährdung möglich?", 9, "YES_NO"),
  text("m-h-c-details", "H · Maßnahmen bei Bekanntwerden einer Schwangerschaft", "Falls nein: Freistellung ab", 9),
  heading("m-h-info", "H · Maßnahmen bei Bekanntwerden einer Schwangerschaft", "Unterrichtung über das Ergebnis der Gefährdungsbeurteilung und die veranlassten Schutzmaßnahmen", 9),
  choice("m-h-info-a", "H · Maßnahmen bei Bekanntwerden einer Schwangerschaft", "a) Unterrichtung der schwangeren Arbeitnehmerin", 9, "YES_NO"),
  choice("m-h-info-b", "H · Maßnahmen bei Bekanntwerden einer Schwangerschaft", "b) Unterrichtung der im Umfeld tätigen Beschäftigten", 9, "YES_NO"),
  choice("m-h-info-c", "H · Maßnahmen bei Bekanntwerden einer Schwangerschaft", "c) Unterrichtung des Betriebs-/Personalrates bzw. der Mitarbeitervertretung", 9, "YES_NO"),
];
