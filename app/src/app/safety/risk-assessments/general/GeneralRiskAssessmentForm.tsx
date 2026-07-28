"use client";

import { useMemo, useState } from "react";

import { SignatureFormField } from "../../_components/SignatureFormField";
import type {
  GeneralRiskAssessmentAnswer,
  GeneralRiskAssessmentTemplate,
} from "@/lib/general-risk-assessments";
import { saveGeneralRiskAssessment } from "./actions";

type InitialValues = {
  answers: Record<string, GeneralRiskAssessmentAnswer>;
  assessedEmployeeId: string;
  assessmentDate: string;
  id?: string;
  instructionTopics: string;
  location: string;
  notes: string;
  participantDates: Record<string, string>;
  participantIds: string[];
  participantSignatures: Record<string, string>;
  presenterName: string;
  presenterSignatureDataUrl: string;
  projectId: string;
  responsibleName: string;
  responsibleSignatureDataUrl: string;
  validityMonths: number;
};

type EmployeeOption = {
  companyDepartment: string;
  id: string;
  label: string;
};

export function GeneralRiskAssessmentForm({
  employees,
  initial,
  managerOptions,
  projects,
  template,
}: {
  employees: EmployeeOption[];
  initial: InitialValues;
  managerOptions: string[];
  projects: { constructionManager: string; id: string; label: string }[];
  template: GeneralRiskAssessmentTemplate;
}) {
  const [participants, setParticipants] = useState(initial.participantIds);
  const [missingItems, setMissingItems] = useState(0);
  const [projectId, setProjectId] = useState(initial.projectId);
  const [responsibleName, setResponsibleName] = useState(
    initial.responsibleName,
  );
  const [presenterName, setPresenterName] = useState(initial.presenterName);
  const [answerStatuses, setAnswerStatuses] = useState<
    Record<string, GeneralRiskAssessmentAnswer["status"]>
  >(
    Object.fromEntries(
      Object.entries(initial.answers)
        .filter(([, answer]) => answer.status)
        .map(([itemId, answer]) => [itemId, answer.status]),
    ),
  );
  const groupedItems = useMemo(() => {
    const groups = new Map<string, typeof template.items>();
    for (const item of template.items) {
      const groupKey = [
        item.chapterTitle ?? "",
        item.sectionTitle ?? "",
        item.activity,
      ].join("::");
      const current = groups.get(groupKey) ?? [];
      current.push(item);
      groups.set(groupKey, current);
    }
    return Array.from(groups.entries());
  }, [template.items]);
  const today = new Date().toISOString().slice(0, 10);
  const usesOriginalTable =
    template.key === "muschg" ||
    template.key === "buero" ||
    template.key === "strassenwalze" ||
    template.key === "tiefbau" ||
    template.key === "asphaltbau";
  const usesDetailedRiskTable =
    template.key === "strassenwalze" ||
    template.key === "tiefbau" ||
    template.key === "asphaltbau";
  const input =
    "w-full border border-gray-500 bg-white px-3 py-2.5 text-sm text-gray-950 outline-none focus:border-black focus:ring-1 focus:ring-black";
  const availableManagers = Array.from(
    new Set([
      responsibleName,
      presenterName,
      ...projects.map((project) => project.constructionManager),
      ...managerOptions,
    ]),
  ).filter(Boolean);
  const setItemsStatus = (
    items: GeneralRiskAssessmentTemplate["items"],
    status: NonNullable<GeneralRiskAssessmentAnswer["status"]>,
  ) => {
    setAnswerStatuses((current) => {
      const next = { ...current };
      for (const item of items) {
        if ((item.kind ?? "choice") === "choice") next[item.id] = status;
      }
      return next;
    });
    setMissingItems(0);
  };

  return (
    <>
      <div className="mx-auto mb-4 flex max-w-[1180px] justify-end">
        {initial.id ? (
          <a
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 font-bold text-black"
            href={`/safety/risk-assessments/general/${initial.id}/pdf`}
          >
            PDF exportieren
          </a>
        ) : (
          <span
            className="rounded-xl border border-gray-300 bg-gray-100 px-4 py-2 font-bold text-gray-500"
            title="Die GBU muss vor dem PDF-Export einmal gespeichert werden."
          >
            PDF exportieren · zuerst speichern
          </span>
        )}
      </div>
      <form
        action={saveGeneralRiskAssessment}
        className="mx-auto max-w-[1180px] bg-white p-4 text-black shadow-xl ring-1 ring-gray-300 sm:p-7"
        onSubmit={(event) => {
          const submitter = (
            event.nativeEvent as SubmitEvent
          ).submitter as HTMLButtonElement | null;
          if (submitter?.value !== "FINAL") return;
          const formData = new FormData(event.currentTarget);
          const missing = template.items.filter((item) => {
            const kind = item.kind ?? "choice";
            return kind === "choice" && !formData.get(`status_${item.id}`);
          }).length;
          if (missing) {
            event.preventDefault();
            setMissingItems(missing);
          }
        }}
      >
        {initial.id ? <input name="id" type="hidden" value={initial.id} /> : null}
        <input name="templateKey" type="hidden" value={template.key} />

        <header className="mb-7 grid items-start gap-5 border-b border-gray-300 pb-5 md:grid-cols-[1fr_230px]">
          <div>
            <h1 className="text-2xl font-normal text-gray-600">
              Gefährdungsbeurteilung – {template.title}
            </h1>
            <div className="mt-3 grid grid-cols-2 gap-px bg-gray-300 text-xs sm:grid-cols-4">
              {[
                ["Interne Nummer", template.code],
                ["Ausgabe", template.issuedAt],
                ["Revision", template.revision],
                ["Umfang", `${template.pageCount} Seiten`],
              ].map(([label, value]) => (
                <div className="bg-white" key={label}>
                  <div className="bg-gray-100 px-2 py-1 text-gray-600">
                    {label}
                  </div>
                  <div className="px-2 py-1.5 text-sm text-gray-800">
                    {value}
                  </div>
                </div>
              ))}
            </div>
            <a
              className="mt-3 inline-flex border border-black px-3 py-2 text-xs font-bold text-black hover:bg-gray-100"
              href={template.sourcePdfPath}
              target="_blank"
            >
              Originalvorlage ansehen
            </a>
          </div>
          <img
            alt="STIX Bauunternehmen"
            className="h-auto w-full max-w-[230px] justify-self-end"
            src="/templates/project-start-stix-logo.png"
          />
        </header>

        {template.contents?.length ? (
          <section className="mb-6 border border-black bg-white">
            <h2 className="bg-gray-300 px-3 py-2 text-xl font-bold text-black">
              Inhaltsverzeichnis
            </h2>
            <ol className="grid gap-x-8 gap-y-1 p-4 text-sm leading-6 md:grid-cols-2">
              {template.contents.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </section>
        ) : null}

        {template.introSections?.length ? (
          <section className="mb-6 border border-black bg-white">
            {template.introSections.map((intro, index) => (
              <div
                className={index ? "border-t border-black" : ""}
                key={intro.title}
              >
                <h2 className="bg-gray-200 px-4 py-2 text-lg font-bold text-black">
                  {intro.title}
                </h2>
                <div className="space-y-3 p-4 text-sm leading-6 text-black">
                  {intro.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </div>
            ))}
          </section>
        ) : null}

        <Section title="Zuordnung und Verantwortlichkeit">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Field label="Projekt">
              <select
                className={input}
                name="projectId"
                onChange={(event) => {
                  const selectedId = event.target.value;
                  setProjectId(selectedId);
                  const manager = projects.find(
                    (project) => project.id === selectedId,
                  )?.constructionManager ?? "";
                  setResponsibleName(manager);
                  setPresenterName(manager);
                }}
                value={projectId}
              >
                <option value="">Ohne Projektbezug</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Datum">
              <input
                className={input}
                defaultValue={initial.assessmentDate}
                name="assessmentDate"
                required
                type="date"
              />
            </Field>
            <Field label="Gültigkeit in Monaten">
              <input
                className={input}
                defaultValue={initial.validityMonths}
                min="1"
                name="validityMonths"
                required
                type="number"
              />
            </Field>
            <Field label="Ort / Arbeitsbereich">
              <input
                className={input}
                defaultValue={initial.location}
                name="location"
              />
            </Field>
            <Field label="Verantwortliche Bauleitung">
              <div className="space-y-2">
                <select
                  className={input}
                  onChange={(event) =>
                    setResponsibleName(event.target.value)
                  }
                  value={
                    availableManagers.includes(responsibleName)
                      ? responsibleName
                      : ""
                  }
                >
                  <option value="">Bauleitung auswählen</option>
                  {availableManagers.map((manager) => (
                    <option key={manager} value={manager}>
                      {manager}
                    </option>
                  ))}
                </select>
                <input
                  className={input}
                  name="responsibleName"
                  onChange={(event) => setResponsibleName(event.target.value)}
                  placeholder="Oder andere Person eintragen"
                  value={responsibleName}
                />
              </div>
            </Field>
            <SignatureFormField
              label="Unterschrift verantwortliche Bauleitung"
              name="responsibleSignatureDataUrl"
              value={initial.responsibleSignatureDataUrl}
            />
          </div>
        </Section>

        <Section
          title={
            template.key === "muschg"
              ? "6. Checkliste – Mutterschutzgesetz §10"
              : template.key === "buero"
                ? "6. Kap. Allgemeine Büroarbeiten"
              : "Gefährdungen und Schutzmaßnahmen"
          }
        >
          <p className="mb-4 text-sm text-gray-700">
            {template.key === "buero" || usesDetailedRiskTable
              ? "Für jede Position „ja“ oder „nein“ auswählen."
              : "Für jede Position „ja“, „nein“ oder „entfällt“ auswählen."}
          </p>
          <div className="space-y-4">
            {groupedItems.map(([groupKey, items], groupIndex) => {
              const activity = items[0]?.activity ?? groupKey;
              const chapterTitle = items[0]?.chapterTitle;
              const sectionTitle = items[0]?.sectionTitle;
              const previousItems = groupedItems[groupIndex - 1]?.[1];
              const showChapter =
                chapterTitle &&
                chapterTitle !== previousItems?.[0]?.chapterTitle;
              const showSection =
                sectionTitle &&
                sectionTitle !== previousItems?.[0]?.sectionTitle;
              return (
              <div className="space-y-2" key={groupKey}>
                {showChapter ? (
                  <div className="flex flex-col gap-3 border border-black bg-gray-900 px-4 py-3 text-white lg:flex-row lg:items-center lg:justify-between">
                    <h3 className="text-lg font-bold">{chapterTitle}</h3>
                    <BulkStatusButtons
                      label={`Komplettes Kapitel „${chapterTitle}“ bewerten`}
                      selectedStatus={commonStatus(
                        template.items.filter(
                          (item) => item.chapterTitle === chapterTitle,
                        ),
                        answerStatuses,
                      )}
                      onSelect={(status) =>
                        setItemsStatus(
                          template.items.filter(
                            (item) => item.chapterTitle === chapterTitle,
                          ),
                          status,
                        )
                      }
                    />
                  </div>
                ) : null}
                {showSection ? (
                  <h4 className="border border-black bg-gray-200 px-4 py-2 text-base font-bold text-black">
                    {sectionTitle}
                  </h4>
                ) : null}
                <details
                  className="border border-black"
                  open={groupedItems.length <= 8}
                >
                <summary className="cursor-pointer bg-gray-300 px-3 py-2 font-bold text-black">
                  {activity} ·{" "}
                  {items.filter((item) => (item.kind ?? "choice") === "choice").length}{" "}
                  bewertbare Positionen
                </summary>
                <div className="flex flex-col gap-2 border-t border-black bg-amber-50 px-3 py-3 lg:flex-row lg:items-center lg:justify-between">
                  <span className="text-sm font-bold text-black">
                    Gesamten Bereich bewerten
                  </span>
                  <BulkStatusButtons
                    label={`Bereich „${activity}“ bewerten`}
                    selectedStatus={commonStatus(items, answerStatuses)}
                    onSelect={(status) => setItemsStatus(items, status)}
                  />
                </div>
                <div>
                  {usesDetailedRiskTable ? (
                    <div className="grid border-t border-black bg-gray-300 text-xs font-bold text-black lg:grid-cols-[150px_1fr_1.5fr_120px_120px_160px]">
                      <div className="border-r border-black px-2 py-2 text-center">
                        Tätigkeit<br />(an/in/mit)
                      </div>
                      <div className="border-r border-black px-2 py-2 text-center">
                        Gefährdung
                      </div>
                      <div className="border-r border-black px-2 py-2 text-center">
                        Schutzmaßnahme
                      </div>
                      <div className="border-r border-black">
                        <div className="border-b border-black px-2 py-1 text-center">
                          Relevant?
                        </div>
                        <div className="grid grid-cols-2">
                          <span className="px-2 py-1 text-center">ja</span>
                          <span className="border-l border-black px-2 py-1 text-center">
                            nein
                          </span>
                        </div>
                      </div>
                      <div className="border-r border-black px-2 py-2 text-center">
                        weitere Infos
                      </div>
                      <div>
                        <div className="border-b border-black px-2 py-1 text-center">
                          Realisierung
                        </div>
                        <div className="grid grid-cols-[52px_1fr]">
                          <span className="px-2 py-1 text-center">✓</span>
                          <span className="border-l border-black px-2 py-1 text-center">
                            Wer
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : usesOriginalTable ? (
                    <div
                      className={`grid border-t border-black bg-gray-100 text-xs font-bold text-black ${
                        template.key === "muschg"
                          ? "lg:grid-cols-[1fr_240px]"
                          : "lg:grid-cols-[1fr_1.5fr_160px_170px]"
                      }`}
                    >
                      <div className="border-b border-gray-300 px-3 py-2 lg:border-b-0 lg:border-r lg:border-black">
                        {template.key === "muschg"
                          ? "Beurteilung"
                          : "Gefährdung"}
                      </div>
                      {template.key === "buero" ? (
                        <div className="border-b border-gray-300 px-3 py-2 lg:border-b-0 lg:border-r lg:border-black">
                          Schutzmaßnahme
                        </div>
                      ) : null}
                      <div
                        className={
                          template.key === "buero"
                            ? "border-l border-black"
                            : ""
                        }
                      >
                        {template.key === "buero" ? (
                          <div className="border-b border-black px-2 py-1 text-center">
                            Relevant?
                          </div>
                        ) : null}
                        <div
                          className={`grid ${
                            items.some(
                              (item) =>
                                (item.kind ?? "choice") === "choice" &&
                                item.options !== "YES_NO",
                            )
                              ? "grid-cols-3"
                              : "grid-cols-2"
                          }`}
                        >
                          <span className="px-2 py-2 text-center">ja</span>
                          <span className="border-l border-black px-2 py-2 text-center">
                            nein
                          </span>
                          {items.some(
                            (item) =>
                              (item.kind ?? "choice") === "choice" &&
                              item.options !== "YES_NO",
                          ) ? (
                            <span className="border-l border-black px-2 py-2 text-center">
                              entfällt
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {template.key === "buero" ? (
                        <div className="border-l border-black">
                          <div className="border-b border-black px-2 py-1 text-center">
                            Realisierung
                          </div>
                          <div className="grid grid-cols-[52px_1fr]">
                            <span className="px-2 py-2 text-center">✓</span>
                            <span className="border-l border-black px-2 py-2 text-center">
                              Wer
                            </span>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {items.map((item) => {
                    const kind = item.kind ?? "choice";
                    if (kind === "heading") {
                      return (
                        <div
                          className="border-t border-black bg-gray-100 px-4 py-3 text-sm font-bold text-black"
                          key={item.id}
                        >
                          {item.hazard}
                        </div>
                      );
                    }
                    if (kind === "note") {
                      return (
                        <p
                          className="border-t border-black bg-gray-50 px-4 py-3 text-sm italic text-gray-800"
                          key={item.id}
                        >
                          {item.hazard}
                        </p>
                      );
                    }
                    if (kind === "text") {
                      return (
                        <div
                          className="grid border-t border-black md:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)]"
                          key={item.id}
                        >
                          <p className="border-b border-gray-300 p-3 text-sm font-semibold text-black md:border-b-0 md:border-r md:border-black">
                            {item.hazard}
                          </p>
                          <textarea
                            className={`${input} min-h-20 border-0`}
                            defaultValue={initial.answers[item.id]?.text ?? ""}
                            name={`text_${item.id}`}
                          />
                        </div>
                      );
                    }
                    const options =
                      item.options === "YES_NO"
                        ? [
                            ["YES", "ja"],
                            ["NO", "nein"],
                          ]
                        : [
                            ["YES", "ja"],
                            ["NO", "nein"],
                            ["NOT_APPLICABLE", "entfällt"],
                          ];
                    const selectedStatus = answerStatuses[item.id];
                    return (
                      <div
                        className={`grid border-t border-black ${
                          template.key === "muschg"
                            ? "lg:grid-cols-[1fr_240px]"
                            : template.key === "buero"
                              ? "lg:grid-cols-[1fr_1.5fr_160px_170px]"
                              : usesDetailedRiskTable
                                ? "lg:grid-cols-[150px_1fr_1.5fr_120px_120px_160px]"
                              : "lg:grid-cols-[1fr_1.5fr_210px]"
                        }`}
                        key={item.id}
                      >
                        {usesDetailedRiskTable ? (
                          <div className="border-b border-gray-300 p-3 text-sm font-semibold text-black lg:border-b-0 lg:border-r lg:border-black">
                            <p className="whitespace-pre-line">{item.activity}</p>
                          </div>
                        ) : null}
                        <div className="border-b border-gray-300 p-3 lg:border-b-0 lg:border-r lg:border-black">
                          {!usesDetailedRiskTable ? (
                            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
                              Originalseite {item.sourcePage}
                            </p>
                          ) : null}
                          <p className="mt-1 whitespace-pre-line text-sm font-semibold text-black">
                            {item.hazard || "Allgemeine Gefährdung"}
                          </p>
                          {template.key !== "tiefbau" &&
                          item.id !== "asphaltbau-26-1-3" &&
                          item.pictograms?.length ? (
                            <div className="mt-3 flex flex-wrap items-center gap-3">
                              {item.pictograms.map((pictogram, index) => (
                                <img
                                  alt={
                                    index === 0
                                      ? "Warnung vor Umsturz"
                                      : "Sicherheitsgurt benutzen"
                                  }
                                  className="h-20 w-20 object-contain"
                                  key={pictogram}
                                  src={pictogram}
                                />
                              ))}
                            </div>
                          ) : null}
                          {!usesDetailedRiskTable && item.reference ? (
                            <p className="mt-2 text-xs italic text-blue-950">
                              {item.reference}
                            </p>
                          ) : null}
                        </div>
                        {template.key !== "muschg" ? (
                          <div className="border-b border-gray-300 p-3 text-sm text-black lg:border-b-0 lg:border-r lg:border-black">
                            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
                              Schutzmaßnahme
                            </p>
                            {item.measure ? (
                              <p className="mt-1 whitespace-pre-line">
                                {item.measure}
                              </p>
                            ) : null}
                            {(template.key === "tiefbau" ||
                              item.id === "asphaltbau-26-1-3") &&
                            item.pictograms?.length ? (
                              <div className="mt-3 flex flex-wrap items-center gap-3">
                                {item.pictograms.map((pictogram) => (
                                  <img
                                    alt="Abbildung aus der Originalvorlage"
                                    className="h-auto max-h-40 max-w-full object-contain"
                                    key={pictogram}
                                    src={pictogram}
                                  />
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                        <div className="p-3">
                          <div
                            className={`grid border border-black ${
                              options.length === 2
                                ? "grid-cols-2"
                                : "grid-cols-3"
                            }`}
                          >
                            {options.map(([value, label]) => (
                            <label
                              className="flex cursor-pointer flex-col items-center gap-1 border-l border-black p-2 text-xs font-bold first:border-l-0 has-[:checked]:bg-gray-950 has-[:checked]:text-white"
                              key={value}
                            >
                              <input
                                aria-label={`${item.hazard}: ${label}`}
                                checked={selectedStatus === value}
                                name={`status_${item.id}`}
                                onChange={() =>
                                  setAnswerStatuses((current) => ({
                                    ...current,
                                    [item.id]:
                                      value as GeneralRiskAssessmentAnswer["status"],
                                  }))
                                }
                                type="radio"
                                value={value}
                              />
                              <span
                                className={
                                  usesOriginalTable ? "sr-only" : ""
                                }
                              >
                                {label}
                              </span>
                            </label>
                          ))}
                          </div>
                          {selectedStatus === "NOT_APPLICABLE" &&
                          item.options === "YES_NO" ? (
                            <input
                              name={`status_${item.id}`}
                              type="hidden"
                              value="NOT_APPLICABLE"
                            />
                          ) : null}
                        </div>
                        {usesDetailedRiskTable ? (
                          <div className="border-t border-gray-300 p-3 text-xs italic text-blue-950 lg:border-r lg:border-t-0 lg:border-black">
                            <p className="whitespace-pre-line">
                              {item.reference || "–"}
                            </p>
                          </div>
                        ) : null}
                        {template.key === "buero" || usesDetailedRiskTable ? (
                          <div className="grid grid-cols-[52px_1fr] border-t border-gray-300 lg:border-l lg:border-t-0 lg:border-black">
                            <label className="flex items-center justify-center border-r border-black p-3">
                              <input
                                aria-label={`${item.hazard}: realisiert`}
                                defaultChecked={
                                  initial.answers[item.id]?.implemented ?? false
                                }
                                name={`implemented_${item.id}`}
                                type="checkbox"
                              />
                            </label>
                            <input
                              aria-label={`${item.hazard}: Wer`}
                              className="min-w-0 border-0 bg-white px-2 py-2 text-sm text-black outline-none focus:ring-1 focus:ring-inset focus:ring-black"
                              defaultValue={
                                initial.answers[item.id]?.responsible ?? ""
                              }
                              name={`responsible_${item.id}`}
                            />
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                </details>
              </div>
              );
            })}
          </div>
        </Section>

        <Section
          title={
            template.key === "muschg"
              ? "9. Unterweisungsnachweis"
              : template.key === "tiefbau"
                ? "13. Unterweisungsnachweis"
                : template.key === "asphaltbau"
                  ? "11. Unterweisungsnachweis"
              : "Unterweisung und Unterschriften"
          }
        >
          {template.key === "tiefbau" ||
          template.key === "asphaltbau" ? (
            <p className="mb-4 text-sm leading-6 text-black">
              Unterweisungsnachweis gemäß § 4 DGUV 1 und § 12 ArbSchG.
              Mit der Unterschrift bestätigen die teilnehmenden Personen,
              dass sie die Inhalte verstanden haben und die Schutzmaßnahmen
              und Verhaltensregeln umsetzen werden.
            </p>
          ) : null}
          <textarea
            className={`${input} min-h-24`}
            defaultValue={initial.instructionTopics}
            name="instructionTopics"
            placeholder="Unterweisungsthemen / ergänzende Maßnahmen"
          />
          <textarea
            className={`${input} mt-3 min-h-20`}
            defaultValue={initial.notes}
            name="notes"
            placeholder="Bemerkungen"
          />
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Vortragende Person">
              <div className="space-y-2">
                <select
                  className={input}
                  onChange={(event) => setPresenterName(event.target.value)}
                  value={
                    availableManagers.includes(presenterName)
                      ? presenterName
                      : ""
                  }
                >
                  <option value="">Vortragende Bauleitung auswählen</option>
                  {availableManagers.map((manager) => (
                    <option key={manager} value={manager}>
                      {manager}
                    </option>
                  ))}
                </select>
                <input
                  className={input}
                  name="presenterName"
                  onChange={(event) => setPresenterName(event.target.value)}
                  placeholder="Oder andere Person eintragen"
                  value={presenterName}
                />
              </div>
            </Field>
            <SignatureFormField
              label="Unterschrift vortragende Person"
              name="presenterSignatureDataUrl"
              value={initial.presenterSignatureDataUrl}
            />
          </div>
          <h3 className="mt-6 font-bold">Teilnehmende Mitarbeiter</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {employees.map((employee) => (
              <label
                className="flex items-center gap-3 border border-gray-400 p-3 text-sm font-semibold has-[:checked]:bg-gray-200"
                key={employee.id}
              >
                <input
                  checked={participants.includes(employee.id)}
                  name="participantId"
                  onChange={(event) =>
                    setParticipants((current) =>
                      event.target.checked
                        ? [...current, employee.id]
                        : current.filter((id) => id !== employee.id),
                    )
                  }
                  type="checkbox"
                  value={employee.id}
                />
                {employee.label}
              </label>
            ))}
          </div>
          <div className="mt-5 space-y-4">
            {employees
              .filter((employee) => participants.includes(employee.id))
              .map((employee) => (
                <div className="border border-black p-4" key={employee.id}>
                  <p className="mb-3 font-bold">{employee.label}</p>
                  <input
                    name={`companyDepartment_${employee.id}`}
                    type="hidden"
                    value={employee.companyDepartment}
                  />
                  <Field label="Datum der Unterweisung">
                    <input
                      className={input}
                      defaultValue={
                        initial.participantDates[employee.id] || today
                      }
                      name={`instructionDate_${employee.id}`}
                      type="date"
                    />
                  </Field>
                  <div className="mt-3">
                    <SignatureFormField
                      label={`Unterschrift ${employee.label}`}
                      name={`signature_${employee.id}`}
                      value={initial.participantSignatures[employee.id]}
                    />
                  </div>
                </div>
              ))}
          </div>
        </Section>

        {template.key === "tiefbau" ||
        template.key === "asphaltbau" ? (
          <Section
            title={
              template.key === "tiefbau"
                ? "14. Änderungshistorie"
                : "12. Änderungshistorie"
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm text-black">
                <thead>
                  <tr className="bg-gray-200">
                    <th className="border border-black px-3 py-2 text-left">
                      Datum
                    </th>
                    <th className="border border-black px-3 py-2 text-left">
                      Titel
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {template.key === "tiefbau" ? (
                    <>
                      <tr>
                        <td className="border border-black px-3 py-2">
                          03.07.2024
                        </td>
                        <td className="border border-black px-3 py-2">
                          Rev00 – 20240703 – Erstellung der
                          Gefährdungsbeurteilung – SiFa R. Eglitis
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-black px-3 py-2">
                          26.08.2025
                        </td>
                        <td className="border border-black px-3 py-2">
                          Rev01 – 20250826 – Anpassung der GBU – Erweiterung
                          mit Kap. Stromleitungen / Freileitungen
                        </td>
                      </tr>
                    </>
                  ) : (
                    <tr>
                      <td className="border border-black px-3 py-2">
                        18.08.2025
                      </td>
                      <td className="border border-black px-3 py-2">
                        Rev00 – 20250818 – Erstellung der
                        Gefährdungsbeurteilung – SiFa R. Eglitis
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-sm leading-6 text-black">
              Die zuständige Bauleitung prüft vor Beginn der Arbeiten die
              Gefährdungsbeurteilung auf Vollständigkeit und führt die
              Wirksamkeitskontrolle durch.
            </p>
          </Section>
        ) : null}

        <div className="sticky bottom-3 z-20 flex flex-wrap justify-end gap-3 border border-black bg-white/95 p-3 shadow-xl backdrop-blur">
          <button
            className="border border-black bg-white px-5 py-3 text-sm font-bold"
            name="submitMode"
            type="submit"
            value="DRAFT"
          >
            Entwurf speichern
          </button>
          <button
            className="border border-black bg-gray-950 px-5 py-3 text-sm font-bold text-white"
            name="submitMode"
            type="submit"
            value="FINAL"
          >
            Abschließen und speichern
          </button>
        </div>
      </form>

      {missingItems ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-[1500] flex items-center justify-center bg-gray-950/65 p-4"
          role="dialog"
        >
          <div className="w-full max-w-lg border border-black bg-white p-6 text-black shadow-2xl">
            <h2 className="text-xl font-bold">
              {missingItems} Position{missingItems === 1 ? "" : "en"} fehlen
            </h2>
            <p className="mt-3 text-sm leading-6">
              Zum Abschließen muss jede Gefährdung mit{" "}
              {usesDetailedRiskTable ? "„ja“ oder „nein“" : "„ja“, „nein“ oder „entfällt“"}{" "}
              bewertet werden. Als Entwurf kannst du sie jederzeit vorher
              speichern.
            </p>
            <div className="mt-6 flex justify-end">
              <button
                className="border border-black bg-gray-950 px-5 py-3 text-sm font-bold text-white"
                onClick={() => setMissingItems(0)}
                type="button"
              >
                Zurück zur GBU
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function BulkStatusButtons({
  label,
  onSelect,
  selectedStatus,
}: {
  label: string;
  onSelect: (
    status: NonNullable<GeneralRiskAssessmentAnswer["status"]>,
  ) => void;
  selectedStatus?: GeneralRiskAssessmentAnswer["status"];
}) {
  const options = [
    ["YES", "Ja"],
    ["NO", "Nein"],
    ["NOT_APPLICABLE", "Nicht relevant"],
  ] as const;

  return (
    <div
      aria-label={label}
      className="flex w-full overflow-hidden border border-black bg-white text-black lg:w-auto"
      role="group"
    >
      {options.map(([status, text]) => (
        <button
          aria-pressed={selectedStatus === status}
          className={`flex-1 border-l border-black px-3 py-2 text-xs font-bold first:border-l-0 hover:bg-gray-900 hover:text-white lg:flex-none ${
            selectedStatus === status ? "bg-gray-950 text-white" : ""
          }`}
          key={status}
          onClick={() => onSelect(status)}
          type="button"
        >
          {text}
        </button>
      ))}
    </div>
  );
}

function commonStatus(
  items: GeneralRiskAssessmentTemplate["items"],
  statuses: Record<string, GeneralRiskAssessmentAnswer["status"]>,
) {
  const choiceItems = items.filter(
    (item) => (item.kind ?? "choice") === "choice",
  );
  if (!choiceItems.length) return undefined;
  const first = statuses[choiceItems[0].id];
  return first && choiceItems.every((item) => statuses[item.id] === first)
    ? first
    : undefined;
}

function Section({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="mb-6 border border-black bg-white">
      <h2 className="bg-gray-300 px-3 py-2 text-xl font-bold text-black">
        {title}
      </h2>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Field({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <label className="space-y-2">
      <span className="block text-sm font-bold text-black">{label}</span>
      {children}
    </label>
  );
}
