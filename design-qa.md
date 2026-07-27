# Design QA – Projektstart Tiefbau

- source visual: `/tmp/stix-projectstart-doc/template-reference-render/page-1.png`
- implementation screenshot: `/tmp/stix-projectstart-doc/implementation-top.png`
- comparison artifact: `/tmp/stix-projectstart-doc/comparison.png`
- tested route: `http://localhost:3000/safety/risk-assessments/project-start/new`
- viewport: 1280 × 720 px
- page dimensions: 1280 × 6960 px
- density/state: Desktop, neues noch nicht ausgefülltes Formular
- full-page evidence: `/tmp/stix-projectstart-doc/implementation-full.png`
- focused evidence: `/tmp/stix-projectstart-doc/implementation-top.png`

## Visual comparison

The implementation adopts the defining visual language of the three-page Word
reference: white document sheet, original STIX logo, restrained gray document
title, metadata strip, square black table borders, gray section headers and
compact form controls. The interactive controls remain larger than the printed
cells so the form can be completed reliably on desktop and tablet.

## Findings and corrections

- P0: none
- P1: none
- P2: none
- Corrected during QA: rounded dashboard-style fields and action bar were
  replaced with square, black/gray document controls.
- Intentional adaptation: the save actions remain sticky so a long 31-point
  checklist can be saved without scrolling to the final line.

## Interaction checks

- Selecting a project preselects its assigned construction manager.
- The same eligible construction manager is preselected as presenter.
- Attempting final save with incomplete LMRA answers opens the foreground
  dialog and reports `31 von 31 LMRA-Punkten fehlen`.
- Browser console: no warnings or errors.
- Production build: passed.

## Comparison history

1. Word reference rendered as three A4 portrait PNG pages.
2. Initial web implementation inspected at desktop size.
3. Input corners, borders, section headers and action styling aligned more
   closely with the Word reference.
4. Source and final implementation reviewed side by side in
   `/tmp/stix-projectstart-doc/comparison.png`.

final result: passed

# QA – Bürotätigkeiten Originalspalten

- Webformular enthält pro 19 Bewertungszeilen:
  - Relevant? `ja / nein`
  - Realisierung `✓`
  - Realisierung `Wer`
- Tabellenköpfe enthalten die sichtbaren Oberbegriffe `Relevant?` und
  `Realisierung`.
- PDF-Nachweis: `tmp/pdfs/office-columns/page-3.png`
- Im PDF geprüft: Ja-Markierung, Nein-Markierung, Realisierungshaken und
  verantwortliche Person werden getrennt ausgegeben.
- PDF-Export ist oben im Formular sichtbar; vor dem ersten Speichern wird der
  notwendige Speicherschritt direkt am Button erklärt.
- Browser-Konsole ohne Fehler; Produktions-Build bestanden.

final result: passed

# Design/PDF QA – Bürotätigkeiten analog zum Original

- Original: `app/public/templates/general-risk-assessments/A-20-10-001-GBU-Buerotaetigkeiten-Rev00.pdf`
- Webroute: `http://localhost:3000/safety/risk-assessments/general/new?template=buero`
- Prüfexport: `output/pdf/Buerotaetigkeiten-Export-Pruefung.pdf`
- PDF-Kontaktbogen: `tmp/pdfs/office-export/contact.png`

## Struktur

- Inhaltsverzeichnis und Vortexte 1–5 aus dem Original übernommen.
- Kapitel 7 Büro- und Bildschirmarbeiten: 13 echte Bewertungszeilen.
- Kapitel 8 Benutzung von Leitern und Tritten: 3 echte Bewertungszeilen.
- Kapitel 9 Heben und Tragen schwerer Lasten: 3 echte Bewertungszeilen.
- PDF-Fortsetzungszeilen wurden wieder mit ihrer ursprünglichen Gefährdung
  zusammengeführt.
- Gefährdung, Schutzmaßnahme und relevante Regelwerke bleiben sichtbar.
- `ja / nein` steht einmal im Tabellenkopf; Einzelzeilen enthalten nur die
  Kästchen.
- Kein `Umsetzung durch`, kein `entfällt`, kein erfundener
  `Siehe Originalvorlage`-Text.

## Prüfung

- Web: 38 Radiobuttons für 19 Bewertungszeilen.
- Web: 3 Ja/Nein-Tabellenköpfe, 0 Entfällt-Spalten.
- Browser-Konsole: keine Warnungen oder Fehler.
- Export: 5 digitale A4-Seiten + 12 unveränderte Originalseiten.
- Keine abgeschnittenen Texte, Überlagerungen oder fehlerhaften
  Tabellenumbrüche.
- Produktions-Build: bestanden.

final result: passed

# QA – Gemeinsame Bewertungsüberschrift

- Webnachweis: `/tmp/stix-gbu-import/maternity-header-placement.png`
- PDF-Nachweis: `tmp/pdfs/maternity-header-v3/page-03.png`
- `ja / nein / entfällt` steht je Abschnitt einmal im Tabellenkopf.
- Einzelzeilen enthalten ausschließlich die zugehörigen Kästchen.
- Abschnitte G und H zeigen originalgetreu nur `ja / nein`.
- Webformular: 8 sichtbare Ja/Nein-Köpfe, davon 5 zusätzlich mit `entfällt`.
- PDF: Überschrift und Kästchenspalten sind ausgerichtet und vollständig lesbar.

final result: passed

# PDF QA – Mutterschutzgesetz Originalstruktur

- finaler Prüfexport: `output/pdf/Mutterschutzgesetz-Export-Pruefung.pdf`
- gerenderte Seiten: `tmp/pdfs/maternity-export-v2/page-01.png` bis
  `page-07.png`
- Kontaktbogen: `tmp/pdfs/maternity-export-v2/contact.png`
- Format: durchgehend A4
- Aufbau: 6 digitale Formularseiten + 11 unveränderte Originalseiten

## Geprüft

- Inhaltsverzeichnis 1–10 und Vortexte 1–5 vollständig lesbar
- Checkliste beginnt auf einer eigenen Seite
- Abschnitte A–H deutlich getrennt
- reine Überschriften ohne Auswahlkästchen
- Ja/Nein/Entfällt als echte Kästchen mit eingetragenem X
- Freitextzeilen, Zuordnung, verantwortliche Unterschrift und
  Unterweisungsnachweis vorhanden
- keine abgeschnittenen Zeilen, Überlagerungen oder fehlerhaften
  Seitenumbrüche
- Originaldokument beginnt unmittelbar nach dem digitalen Nachweis

final result: passed

# Design QA – Mutterschutzgesetz Korrektur

- Originalreferenz: `/tmp/stix-gbu-import/muschg/contact-1.png`
- Detailreferenz Inhaltsverzeichnis: `/tmp/stix-gbu-import/muschg/page-2.png`
- Implementierung: `/tmp/stix-gbu-import/maternity-form-top-v2.png`
- vollständige Webansicht: `/tmp/stix-gbu-import/maternity-form-full-v2.png`
- Vergleich: `/tmp/stix-gbu-import/maternity-comparison-v2.png`
- geprüfte Route: `http://localhost:3000/safety/risk-assessments/general/new?template=muschg`

## Korrekturen

- Inhaltsverzeichnis mit den Originalabschnitten 1–10 ergänzt.
- Vortexte 1–5 einschließlich des Wortlauts aus §10 MuSchG ergänzt.
- Checkliste nach A–H statt nach fehlerhaft zusammengezogenen Importgruppen
  gegliedert.
- Reine Zwischenüberschriften wie `A a) Heben, tragen oder bewegen von Lasten`
  besitzen keine Auswahlfelder.
- Fortsetzungszeilen wurden mit ihren Fragen verbunden.
- Bemerkungs- und Detailzeilen sind Freitextfelder; reine Hinweise sind nicht
  ausfüllbar.
- `Umsetzung durch` und der erfundene Ersatztext `Siehe Originalvorlage.` sind
  vollständig entfernt.
- Die gespeicherte GBU-Tabelle verwendet dieselbe graue Kopfzeile, schwarze
  Schrift, Rahmenfarben und Aktionsschaltflächen wie die Projektstart-Tabelle.

## Prüfung

- Überschrift `a) Heben, tragen oder bewegen von Lasten` enthält 0 Eingaben.
- `Umsetzung durch`: nicht im DOM vorhanden.
- `Siehe Originalvorlage.`: nicht im DOM vorhanden.
- Browser-Konsole: keine Warnungen oder Fehler.
- Produktions-Build: bestanden.

final result: passed

# Design QA – Weitere Gefährdungsbeurteilungen

- source visual: `/tmp/stix-gbu-import/buero/page-04.png`
- implementation screenshot: `/tmp/stix-gbu-import/general-form-top.png`
- full-page evidence: `/tmp/stix-gbu-import/general-form-full.png`
- comparison artifact: `/tmp/stix-gbu-import/general-comparison.png`
- tested route: `http://localhost:3000/safety/risk-assessments/general/new?template=buero`
- representative template: A-20-10-001 Bürotätigkeiten

## Visual comparison

Die gemeinsame Eingabemaske übernimmt die prägenden Merkmale aller fünf
STIX-Originale: weißes Dokumentblatt, Original-Logo, graue Metadatenzeile,
kantige schwarze Tabellenlinien, graue Abschnittsköpfe und die Gliederung nach
Tätigkeit, Gefährdung und Schutzmaßnahme. Die Web-Steuerelemente sind bewusst
größer als die Druckzellen, damit die GBUs am Rechner und Tablet ausfüllbar
bleiben.

## Interaction checks

- Alle fünf Vorlagen sind von der Übersicht aus erreichbar.
- Projekt- und Mitarbeiterbezug sind auswählbar.
- Jede Position bietet `ja`, `nein` und `entfällt` sowie die zuständige Person.
- Der Abschluss einer unvollständigen Büro-GBU öffnet einen Dialog mit
  `25 Positionen fehlen`; die Seite stürzt nicht ab.
- Verantwortliche, Vortragende und Teilnehmende besitzen getrennte
  Unterschriftenfelder.
- Browser-Konsole: keine Warnungen oder Fehler.

## PDF export QA

- Testexport: `/tmp/stix-gbu-import/general-export-qa.pdf`
- Format: 15 A4-Seiten für die Büro-GBU
- Aufbau: 3 Seiten digitaler Ausfüllnachweis + 12 unveränderte Originalseiten
- geprüft: Zuordnung, Bewertungen, Verantwortlichkeiten, Unterschriftenzeilen,
  Seitennummerierung und Originalanhang

final result: passed

## General GBU PDF export without original attachment

- The generated PDF now contains only the completed digital assessment.
- Mutterschutz export verified: 6 A4 pages.
- Bürotätigkeiten export verified: 6 A4 pages.
- The unchanged source document remains available separately through the
  original-template download.
- The same export rule applies to all general GBU templates.

final result: passed

## Straßenwalze GBU

- Webansicht analog zur Originaltabelle mit Tätigkeit, Gefährdung,
  Schutzmaßnahme, Relevant ja/nein, weiteren Informationen sowie
  Realisierung und verantwortlicher Person.
- Die beiden Original-Piktogramme „Warnung vor Umsturz“ und
  „Sicherheitsgurt benutzen“ sind dem passenden Tabellenpunkt zugeordnet.
- Die im bisherigen Import fehlende Position „Vibrationen“ wurde ergänzt.
- PDF-Export oben sichtbar und geprüft: 3 digitale A4-Seiten ohne
  angehängte Originalvorlage.
- PDF visuell geprüft: Piktogramme, Tabellenlinien, Bewertungen,
  Realisierung und Verantwortlichkeit werden korrekt ausgegeben.

final result: passed

## Tiefbau allgemein GBU

- Webansicht analog zur Originaltabelle mit Tätigkeit, Gefährdung,
  Schutzmaßnahme, Relevant ja/nein, weiteren Informationen sowie
  Realisierung und verantwortlicher Person.
- Vier fachliche Originalabbildungen übernommen und den passenden Positionen
  zugeordnet: Sanitär-Mindestmengentabelle, zwei Trennjäger-Kickback-
  Abbildungen und Sicherheitsabstände an Freileitungen.
- Reine PDF-Navigationssymbole wurden nicht als Fachpiktogramme übernommen.
- Importbedingte Kopfzeilen und getrennte Fortsetzungszeilen wurden bereinigt
  beziehungsweise wieder mit der vorherigen Schutzmaßnahme zusammengeführt.
- PDF-Export geprüft: 21 digitale A4-Seiten ohne angehängte Originalvorlage.
- Visuell geprüft: Tabellenlinien, Abbildungen, Relevant-Auswahl,
  Realisierung und Verantwortlichkeit werden lesbar ausgegeben.
- Vollständige Originalgliederung von Kapitel 6 bis Kapitel 12 ergänzt:
  Hauptkapitel, nummerierte GBU-Unterkapitel und Tätigkeitsgruppen erscheinen
  in Webansicht und PDF in der richtigen Reihenfolge.
- PDF-Seitenumbrüche verhindern alleinstehende Kapitel- oder
  Unterkapitelüberschriften am Seitenende.
- Kapitelstruktur im Export geprüft, unter anderem 6., 6.1., 8., 11.10.
  und 12.2.; finaler Export umfasst 22 digitale A4-Seiten.
- Kapitel 1 bis 5 mit den vollständigen Vorbemerkungen und mitgeltenden
  Dokumenten ergänzt.
- Kapitel 13 als Unterweisungsnachweis mit Vortragenden, Themen,
  Unterschriften und teilnehmenden Beschäftigten gekennzeichnet.
- Kapitel 14 mit beiden Original-Revisionsständen und Hinweis zur
  Vollständigkeits- und Wirksamkeitskontrolle ergänzt.
- Vollständiger Export 1 bis 14 visuell geprüft: 25 digitale A4-Seiten.

final result: passed

## Asphaltbau allgemein GBU

- Vollständige Originalgliederung 1 bis 12 übernommen: Vorbemerkungen,
  Hauptkapitel, GBU-Unterkapitel, Unterweisungsnachweis und
  Änderungshistorie.
- Originaltabelle mit Tätigkeit, Gefährdung, Schutzmaßnahme, Relevant
  ja/nein, weiteren Informationen sowie Realisierung und verantwortlicher
  Person umgesetzt.
- Drei fachliche Originalabbildungen übernommen: zwei
  Straßenwalzen-Sicherheitszeichen und das Freileitungs-Abstandsschaubild.
- PDF-Navigationssymbole bewusst nicht als Fachpiktogramme übernommen.
- Fehlende PSA-Zeilen für Augen-/Gesichtsschutz und Fußschutz ergänzt;
  sämtliche PSA- und Querschnitts-Schutzmaßnahmen anhand des Originals
  vervollständigt.
- PDF-Seitenumbrüche verhindern alleinstehende Tätigkeits- und
  Kapitelüberschriften.
- Reiner digitaler PDF-Export visuell geprüft: 12 A4-Seiten ohne
  angehängte Originalvorlage.

final result: passed

## PDF export QA

- exported artifact: `output/pdf/Projektstart-Tiefbau-Designpruefung.pdf`
- format: 3 A4 portrait pages
- rendered evidence:
  - `tmp/pdfs/project-start-final-1.png`
  - `tmp/pdfs/project-start-export-2.png`
  - `tmp/pdfs/project-start-export-3.png`
- verified: document header, STIX logo, metadata, project information,
  activities, all 31 LMRA answers, references, page numbering, presenter
  signature and participant signatures
- visual result: aligned with the original Word document; no clipped table
  rows, overlapping content or unreadable values
