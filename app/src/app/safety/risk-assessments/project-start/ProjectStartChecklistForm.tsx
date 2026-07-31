"use client";

import { useState } from "react";

import { SignatureFormField } from "../../_components/SignatureFormField";
import { ExternalParticipants } from "../../_components/ExternalParticipants";
import {
  PROJECT_START_ACTIVITIES,
  PROJECT_START_ASSESSMENT_SECTIONS,
} from "@/lib/project-start-checklist";
import { saveProjectStartChecklist } from "./actions";

type ChecklistValues = {
  activities: string[];
  assessments: Record<string, string>;
  checklistDate: string;
  endDate: string;
  id?: string;
  instructionTopics: string;
  otherActivities: string;
  participantIds: string[];
  participantDates: Record<string, string>;
  participantSignatures: Record<string, string>;
  presenterName: string;
  presenterSignatureDataUrl: string;
  projectId: string;
  responsibleManager: string;
  responsibleMobile: string;
  responsiblePhone: string;
  sitePostalCity: string;
  siteStreet: string;
  startDate: string;
  validityMonths: number;
};

export function ProjectStartChecklistForm({
  employees,
  initial,
  managerOptions,
  projects,
}: {
  employees: Array<{
    companyDepartment: string;
    id: string;
    label: string;
  }>;
  initial: ChecklistValues;
  managerOptions: string[];
  projects: Array<{
    constructionManager: string;
    id: string;
    label: string;
  }>;
}) {
  const [participants, setParticipants] = useState(initial.participantIds);
  const [missingAssessments, setMissingAssessments] = useState(0);
  const [selectedProjectId, setSelectedProjectId] = useState(initial.projectId);
  const [responsibleManager, setResponsibleManager] = useState(
    initial.responsibleManager ||
      projects.find((project) => project.id === initial.projectId)
        ?.constructionManager ||
      "",
  );
  const [presenterName, setPresenterName] = useState(
    initial.presenterName ||
      initial.responsibleManager ||
      projects.find((project) => project.id === initial.projectId)
        ?.constructionManager ||
      "",
  );
  const input =
    "w-full border border-gray-500 bg-white px-3 py-2.5 text-sm text-gray-950 outline-none focus:border-black focus:ring-1 focus:ring-black";
  const availableManagers = Array.from(
    new Set([
      responsibleManager,
      ...projects.map((project) => project.constructionManager),
      ...managerOptions,
    ]),
  ).filter(Boolean);

  return (
    <>
    <form
      action={saveProjectStartChecklist}
      className="mx-auto max-w-[1120px] bg-white p-3 text-black shadow-xl ring-1 ring-gray-300 sm:p-6 lg:p-10"
      onSubmit={(event) => {
        const submitter = (
          event.nativeEvent as SubmitEvent
        ).submitter as HTMLButtonElement | null;
        if (submitter?.value !== "FINAL") return;

        const formData = new FormData(event.currentTarget);
        const missing = PROJECT_START_ASSESSMENT_SECTIONS.reduce(
          (count, section) =>
            count +
            section.questions.filter(
              ([number]) => !formData.get(`assessment_${number}`),
            ).length,
          0,
        );
        if (missing > 0) {
          event.preventDefault();
          setMissingAssessments(missing);
        }
      }}
    >
      {initial.id ? <input name="id" type="hidden" value={initial.id} /> : null}
      <header className="mb-8 grid items-start gap-5 border-b border-gray-300 pb-5 md:grid-cols-[1fr_250px]">
        <div>
          <h1 className="text-2xl font-normal tracking-tight text-gray-600 sm:text-3xl">
            GBU-Projektstart – Tiefbau / Asphaltbau
          </h1>
          <div className="mt-3 grid grid-cols-2 gap-px bg-gray-300 text-xs sm:grid-cols-4">
            {[
              ["Interne Nummer", "A-30-30-001"],
              ["Ausgabestand", "2024-09-23"],
              ["Layout-Rev.", "00"],
              ["Ersteller", "EGRO S+C – RE"],
            ].map(([label, value]) => (
              <div className="bg-gray-100" key={label}>
                <div className="px-2 py-1 text-gray-600">{label}:</div>
                <div className="bg-white px-2 py-1.5 text-sm text-gray-700">
                  {value}
                </div>
              </div>
            ))}
          </div>
        </div>
        <img
          alt="STIX Bauunternehmen"
          className="h-auto w-full max-w-[250px] justify-self-end object-contain"
          src="/templates/project-start-stix-logo.png"
        />
      </header>
      <Section title="A · Allgemeine Angaben und Projekt">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Projekt">
            <select
              className={input}
              name="projectId"
              onChange={(event) => {
                const projectId = event.target.value;
                setSelectedProjectId(projectId);
                setResponsibleManager(
                  projects.find((project) => project.id === projectId)
                    ?.constructionManager ?? "",
                );
                setPresenterName(
                  projects.find((project) => project.id === projectId)
                    ?.constructionManager ?? "",
                );
              }}
              required
              value={selectedProjectId}
            >
              <option value="">Projekt auswählen</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.label}</option>)}
            </select>
          </Field>
          <Field label="Datum"><input className={input} defaultValue={initial.checklistDate} name="checklistDate" type="date" /></Field>
          <Field label="Gültigkeit in Monaten"><input className={input} defaultValue={initial.validityMonths} min="1" name="validityMonths" required type="number" /></Field>
          <Field label="Verantwortliche Bauleitung">
            <select
              className={input}
              name="responsibleManager"
              onChange={(event) => setResponsibleManager(event.target.value)}
              value={responsibleManager}
            >
              <option value="">Bauleitung auswählen</option>
              {availableManagers.map((manager) => (
                <option key={manager} value={manager}>
                  {manager}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Telefon"><input className={input} defaultValue={initial.responsiblePhone} name="responsiblePhone" /></Field>
          <Field label="Mobil"><input className={input} defaultValue={initial.responsibleMobile} name="responsibleMobile" /></Field>
          <Field label="Baustellenstraße"><input className={input} defaultValue={initial.siteStreet} name="siteStreet" /></Field>
          <Field label="PLZ / Ort"><input className={input} defaultValue={initial.sitePostalCity} name="sitePostalCity" /></Field>
          <Field label="Von"><input className={input} defaultValue={initial.startDate} name="startDate" type="date" /></Field>
          <Field label="Bis"><input className={input} defaultValue={initial.endDate} name="endDate" type="date" /></Field>
        </div>
      </Section>

      <Section title="C · Auszuführende Arbeiten">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {PROJECT_START_ACTIVITIES.map((activity) => (
            <label className="flex items-center gap-3 border border-gray-400 bg-gray-50 p-3 text-sm font-semibold text-black has-[:checked]:bg-gray-200" key={activity}>
              <input defaultChecked={initial.activities.includes(activity)} name="activity" type="checkbox" value={activity} />
              {activity}
            </label>
          ))}
        </div>
        <textarea className={`${input} mt-4 min-h-24`} defaultValue={initial.otherActivities} name="otherActivities" placeholder="Sonstiges / Details" />
      </Section>

      <Section title="D · Erforderliche Maßnahmen / LMRA">
        <p className="mb-4 text-sm text-gray-700">Jeder Punkt erhält genau eine Bewertung.</p>
        <div className="space-y-5">
          {PROJECT_START_ASSESSMENT_SECTIONS.map((section) => (
            <div className="overflow-hidden border border-black" key={section.id}>
              <h3 className="bg-gray-200 px-3 py-2 text-lg font-medium italic text-black">{section.id} – {section.title}</h3>
              {section.questions.map(([number, question, reference]) => (
                <div className="grid border-t border-black md:grid-cols-[70px_1fr_100px_240px]" key={number}>
                  <div className="border-b border-gray-300 p-3 font-bold md:border-b-0 md:border-r md:border-black">{number}</div>
                  <p className="border-b border-gray-300 p-3 text-sm font-medium text-black md:border-b-0 md:border-r md:border-black">{question}</p>
                  <p className="border-b border-gray-300 p-3 text-sm italic text-blue-950 md:border-b-0 md:border-r md:border-black">{reference}</p>
                  <div className="grid grid-cols-3">
                    {[["OK","i.O."],["NOT_OK","n.i.O."],["NOT_RELEVANT","n.r."]].map(([value,label]) => (
                      <label className="flex min-h-12 cursor-pointer flex-col items-center justify-center gap-1 border-l border-black px-2 py-2 text-xs font-bold text-black first:border-l-0 has-[:checked]:bg-gray-900 has-[:checked]:text-white md:first:border-l" key={value}>
                        <input defaultChecked={initial.assessments[number] === value} name={`assessment_${number}`} type="radio" value={value} /><span>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </Section>

      <Section title="E · Unterweisung und Unterschriften">
        <textarea className={`${input} min-h-28`} defaultValue={initial.instructionTopics} name="instructionTopics" placeholder="Sonstige Unterweisungsthemen / projektspezifische Besonderheiten" />
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Vortragende Person">
            <select
              className={input}
              name="presenterName"
              onChange={(event) => setPresenterName(event.target.value)}
              value={presenterName}
            >
              <option value="">Vortragende Bauleitung auswählen</option>
              {availableManagers.map((manager) => (
                <option key={manager} value={manager}>
                  {manager}
                </option>
              ))}
            </select>
          </Field>
          <SignatureFormField label="Unterschrift der vortragenden Person" name="presenterSignatureDataUrl" value={initial.presenterSignatureDataUrl} />
        </div>
        <h3 className="mt-6 font-bold text-black">Teilnehmende Mitarbeiter auswählen</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {employees.map((employee) => (
            <label className="flex items-center gap-3 border border-gray-400 p-3 text-sm font-semibold text-black has-[:checked]:bg-gray-200" key={employee.id}>
              <input checked={participants.includes(employee.id)} name="participantId" onChange={(event) => setParticipants((current) => event.target.checked ? [...current, employee.id] : current.filter((id) => id !== employee.id))} type="checkbox" value={employee.id} />
              {employee.label}
            </label>
          ))}
        </div>
        <div className="mt-5 space-y-4">
          {employees.filter((employee) => participants.includes(employee.id)).map((employee) => (
            <div className="border border-black p-4" key={employee.id}>
              <p className="mb-3 font-bold text-black">{employee.label}</p>
              <input name={`companyDepartment_${employee.id}`} type="hidden" value={employee.companyDepartment} />
              <Field label="Datum der Unterweisung">
                <input
                  className={input}
                  defaultValue={
                    initial.participantDates[employee.id] ||
                    initial.checklistDate
                  }
                  name={`instructionDate_${employee.id}`}
                  type="date"
                />
              </Field>
              <div className="mt-3">
              <SignatureFormField label={`Unterschrift ${employee.label}`} name={`signature_${employee.id}`} value={initial.participantSignatures[employee.id]} />
              </div>
            </div>
          ))}
        </div>
        <ExternalParticipants defaultDate={initial.checklistDate} />
      </Section>

      <div className="sticky bottom-3 z-20 flex flex-wrap justify-end gap-3 border border-black bg-white/95 p-3 shadow-xl backdrop-blur">
        <button className="border border-black bg-white px-5 py-3 text-sm font-bold text-black" name="submitMode" type="submit" value="DRAFT">Entwurf speichern</button>
        <button className="border border-black bg-gray-950 px-5 py-3 text-sm font-bold text-white" name="submitMode" type="submit" value="FINAL">Abschließen und speichern</button>
      </div>
    </form>
    {missingAssessments > 0 ? (
      <div
        aria-modal="true"
        className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-gray-950/65 p-4"
        onClick={() => setMissingAssessments(0)}
        role="dialog"
      >
        <div
          className="w-full max-w-lg rounded-3xl border border-amber-300 bg-white p-6 text-black shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <p className="text-xs font-bold uppercase tracking-wide text-amber-700">
            Checkliste noch nicht vollständig
          </p>
          <h2 className="mt-2 text-xl font-bold text-black">
            {missingAssessments} von 31 LMRA-Punkten fehlen
          </h2>
          <p className="mt-3 text-sm leading-6 text-black">
            Zum Abschließen muss jeder LMRA-Punkt mit „i.O.“, „n.i.O.“ oder
            „n.r.“ bewertet sein. Du kannst die fehlenden Punkte ergänzen oder
            die Checkliste zunächst als Entwurf speichern.
          </p>
          <div className="mt-6 flex justify-end">
            <button
              className="rounded-xl bg-gray-950 px-5 py-3 text-sm font-bold text-white"
              onClick={() => setMissingAssessments(0)}
              type="button"
            >
              Zurück zur Checkliste
            </button>
          </div>
        </div>
      </div>
    ) : null}
    </>
  );
}

function Section({ children, title }: { children: React.ReactNode; title: string }) {
  return <section className="mb-6 border border-black bg-white"><h2 className="mb-0 bg-gray-300 px-3 py-2 text-xl font-bold text-black">{title}</h2><div className="p-4">{children}</div></section>;
}
function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return <label className="space-y-2"><span className="block text-sm font-bold text-black">{label}</span>{children}</label>;
}
