"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { PointerEvent, ReactNode } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { saveProjectDailyReport } from "./actions";
import type {
  DailyReportContext,
  DailyReportCountRow,
  DailyReportMaterialRow,
  DailyReportPhotoGridLayout,
} from "./dailyReportContext";

type ReportFormState = {
  approvedByName: string;
  approvedFields: string[];
  laborRows: DailyReportCountRow[];
  machineRows: DailyReportCountRow[];
  materialRows: DailyReportMaterialRow[];
  performanceLines: string[];
  photoIds: string[];
  photoGridLayout: DailyReportPhotoGridLayout;
  projectName: string;
  projectNumber: string;
  sheetNumber: string;
  siteDiscussionNotes: string;
  siteDiscussionRoles: string[];
  siteDiscussionThirdPartyName: string;
  contractorSignatureDataUrl: string;
  clientSignatureDataUrl: string;
  showRealMachineNames: boolean;
  trafficSafetyFirstCheckTime: string;
  trafficSafetySecondCheckTime: string;
  weatherCategory: string;
  weatherNotes: string;
  weatherTempMaxC: string;
  weatherTempMinC: string;
  weekday: string;
  workEnd: string;
  workStart: string;
};

const inputClassName =
  "mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900";
const compactInputClassName =
  "w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 outline-none focus:border-gray-900";
const textareaClassName =
  "mt-1 min-h-28 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900";
const dailyReportPerformanceLineLimit = 8;
const siteDiscussionRoleOptions = [
  { label: "Auftraggeber (AG)", value: "CLIENT" },
  { label: "Bauüberwacher", value: "SUPERVISOR" },
  { label: "Planer", value: "PLANNER" },
] as const;

const dirtyWindowKey = "__projectDailyReportDirty";

function setDailyReportDirty(isDirty: boolean) {
  (window as Window & { [dirtyWindowKey]?: boolean })[dirtyWindowKey] =
    isDirty;
}

export function ProjectDailyReportEditor({
  context,
  exportHref,
  projectId,
}: {
  context: DailyReportContext;
  exportHref: string;
  projectId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saveMessage, setSaveMessage] = useState("");
  const [form, setForm] = useState<ReportFormState>(() =>
    createInitialState(context),
  );

  useEffect(() => {
    setDailyReportDirty(false);

    return () => setDailyReportDirty(false);
  }, [context.dateKey, context.id, context.projectNumber, context.sheetNumber]);

  function markDirty() {
    setSaveMessage("");
    setDailyReportDirty(true);
  }

  function updateValue<Key extends keyof ReportFormState>(
    key: Key,
    value: ReportFormState[Key],
  ) {
    markDirty();
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function toggleApproval(fieldId: string, checked: boolean) {
    markDirty();
    setForm((current) => {
      const approvedFields = new Set(current.approvedFields);

      if (checked) {
        approvedFields.add(fieldId);
      } else {
        approvedFields.delete(fieldId);
      }

      return {
        ...current,
        approvedFields: Array.from(approvedFields),
      };
    });
  }

  function getSuggestedMachineRows(showRealMachineNames: boolean) {
    return showRealMachineNames
      ? context.suggestions.realMachineRows
      : context.suggestions.groupedMachineRows;
  }

  function toggleRealMachineNames(checked: boolean) {
    markDirty();
    setForm((current) => ({
      ...current,
      machineRows: cloneRows(getSuggestedMachineRows(checked)),
      showRealMachineNames: checked,
    }));
  }

  function useSuggestions() {
    markDirty();
    setForm((current) => ({
      ...current,
      laborRows: cloneRows(context.suggestions.laborRows),
      materialRows: cloneMaterialRows(context.suggestions.materialRows),
      machineRows: cloneRows(
        getSuggestedMachineRows(current.showRealMachineNames),
      ),
      performanceLines: [...context.suggestions.performanceLines],
      projectName: context.suggestions.projectName,
      projectNumber: context.suggestions.projectNumber,
      siteDiscussionNotes: current.siteDiscussionNotes,
      siteDiscussionRoles: current.siteDiscussionRoles,
      siteDiscussionThirdPartyName: current.siteDiscussionThirdPartyName,
      contractorSignatureDataUrl: current.contractorSignatureDataUrl,
      clientSignatureDataUrl: current.clientSignatureDataUrl,
      weatherCategory: context.suggestions.weatherLabel,
      weatherTempMaxC: context.suggestions.tempMax,
      weatherTempMinC: context.suggestions.tempMin,
      trafficSafetyFirstCheckTime:
        context.trafficSafetyFirstCheckTime || context.suggestions.workStart,
      trafficSafetySecondCheckTime:
        context.trafficSafetySecondCheckTime || context.suggestions.workEnd,
      weekday: context.suggestions.weekday,
      workEnd: context.suggestions.workEnd,
      workStart: context.suggestions.workStart,
    }));
  }

  function useWeatherSuggestion() {
    markDirty();
    setForm((current) => ({
      ...current,
      weatherCategory: context.suggestions.weatherLabel,
      weatherTempMaxC: context.suggestions.tempMax,
      weatherTempMinC: context.suggestions.tempMin,
    }));
  }

  function save(
    status: "APPROVED" | "DRAFT",
    confirmIncompleteApproval = false,
  ) {
    if (
      confirmIncompleteApproval &&
      status === "APPROVED" &&
      form.approvedFields.length < approvalGroups.length
    ) {
      const confirmed = window.confirm(
        "Es sind noch nicht alle Bereiche freigegeben. Bautagesbericht trotzdem freigeben?",
      );

      if (!confirmed) return;
    }

    startTransition(async () => {
      try {
        await saveProjectDailyReport({
          ...form,
          projectId,
          reportDate: context.dateKey,
          status,
        });
        setDailyReportDirty(false);
        setSaveMessage(
          status === "APPROVED"
            ? "Freigegebener Bautagesbericht gespeichert."
            : "Entwurf gespeichert.",
        );
        router.refresh();
      } catch (error) {
        alert(
          error instanceof Error
            ? error.message
            : "Bautagesbericht konnte nicht gespeichert werden.",
        );
      }
    });
  }

  const isApproved = context.status === "APPROVED";
  const hasWeatherSuggestion = Boolean(
    context.suggestions.weatherLabel ||
      context.suggestions.tempMin ||
      context.suggestions.tempMax,
  );

  return (
    <div className="mt-5 space-y-4">
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-semibold text-gray-900">
                {isApproved && context.reportNumber
                  ? `Bautagesbericht Nr. ${context.reportNumber}`
                  : "Bautagesbericht Entwurf"}
              </span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  isApproved
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {isApproved ? "freigegeben" : "Entwurf"}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-600">
              {context.dateLabel} · Vorschläge kommen aus Projektakte,
              Dispositionen und Wetterprotokoll.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
              onClick={useSuggestions}
              type="button"
            >
              Vorschläge übernehmen
            </button>
            <a
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
              href={exportHref}
            >
              PDF herunterladen
            </a>
          </div>
        </div>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <SectionHeader
          approved={form.approvedFields.includes("project")}
          fieldId="project"
          onToggle={toggleApproval}
          title="Projekt / Kopf"
        />
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-5">
          <LabeledInput
            label="Projekt"
            onChange={(value) => updateValue("projectName", value)}
            suggestion={context.suggestions.projectName}
            value={form.projectName}
          />
          <LabeledInput
            label="Projektnr."
            onChange={(value) => updateValue("projectNumber", value)}
            suggestion={context.suggestions.projectNumber}
            value={form.projectNumber}
          />
          <LabeledInput
            label="Wochentag"
            onChange={(value) => updateValue("weekday", value)}
            suggestion={context.suggestions.weekday}
            value={form.weekday}
          />
          <ReadOnlyField label="Datum" value={context.dateLabel} />
          <LabeledInput
            label="Blattnr."
            onChange={(value) => updateValue("sheetNumber", value)}
            value={form.sheetNumber}
          />
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900">
              Fotodokumentation
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              Ausgewählte Fotos erscheinen ab Seite 2 in der gewählten,
              gleichbleibenden Rastergröße.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs font-semibold text-gray-700">
              Raster im PDF
              <select
                className="mt-1 block rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-900"
                onChange={(event) =>
                  updateValue(
                    "photoGridLayout",
                    event.currentTarget.value as DailyReportPhotoGridLayout,
                  )
                }
                value={form.photoGridLayout}
              >
                <option value="1x2">1 × 2 (2 Fotos)</option>
                <option value="2x2">2 × 2 (4 Fotos)</option>
                <option value="2x3">2 × 3 (6 Fotos)</option>
                <option value="2x4">2 × 4 (8 Fotos)</option>
              </select>
            </label>
            <span className="pb-2 text-xs font-semibold text-gray-500">
              {form.photoIds.length} ausgewählt
            </span>
          </div>
        </div>

        {context.photos.length > 0 ? (
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            {context.photos.map((photo) => {
              const selected = form.photoIds.includes(photo.id);

              return (
                <label
                  className={`cursor-pointer overflow-hidden rounded-xl border bg-white ${
                    selected
                      ? "border-blue-500 ring-2 ring-blue-100"
                      : "border-gray-200"
                  }`}
                  key={photo.id}
                >
                  <Image
                    alt={photo.notes || "Projektfoto"}
                    className="aspect-[4/3] w-full object-cover"
                    height={360}
                    src={photo.publicUrl}
                    width={480}
                  />
                  <span className="flex items-start gap-2 p-2 text-xs text-gray-700">
                    <input
                      checked={selected}
                      className="mt-0.5"
                      onChange={(event) => {
                        const photoIds = new Set(form.photoIds);

                        if (event.currentTarget.checked) {
                          photoIds.add(photo.id);
                        } else {
                          photoIds.delete(photo.id);
                        }

                        updateValue("photoIds", Array.from(photoIds));
                      }}
                      type="checkbox"
                    />
                    <span className="min-w-0">
                      <span className="block font-semibold">
                        {photo.capturedAtLabel || "Ohne Aufnahmedatum"}
                      </span>
                      {photo.notes ? (
                        <span className="mt-0.5 block line-clamp-2">
                          {photo.notes}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        ) : (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Für dieses Projekt sind noch keine Fotos als „Für
            Bautagesbericht“ markiert.
          </p>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <SectionHeader
          approved={form.approvedFields.includes("weather")}
          fieldId="weather"
          onToggle={toggleApproval}
          title="Wetter / Temperatur"
        />
        {hasWeatherSuggestion ? (
          <div className="mt-3 flex justify-end">
            <button
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
              onClick={useWeatherSuggestion}
              type="button"
            >
              Wettervorschlag übernehmen
            </button>
          </div>
        ) : (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
            Für dieses Projekt und Datum ist noch kein Wetterprotokoll
            gespeichert. Wetter erst in der Projektakte aktualisieren oder hier
            manuell eintragen.
          </div>
        )}
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[1fr_120px_120px]">
          <LabeledInput
            label="Wetter"
            onChange={(value) => updateValue("weatherCategory", value)}
            suggestion={context.suggestions.weatherLabel}
            value={form.weatherCategory}
          />
          <LabeledInput
            label="Temp min"
            onChange={(value) => updateValue("weatherTempMinC", value)}
            suggestion={context.suggestions.tempMin}
            value={form.weatherTempMinC}
          />
          <LabeledInput
            label="Temp max"
            onChange={(value) => updateValue("weatherTempMaxC", value)}
            suggestion={context.suggestions.tempMax}
            value={form.weatherTempMaxC}
          />
        </div>
        <label className="mt-3 block text-sm font-medium text-gray-800">
          Wetterbemerkung
          <textarea
            className="mt-1 min-h-20 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
            onChange={(event) => updateValue("weatherNotes", event.target.value)}
            value={form.weatherNotes}
          />
        </label>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <SectionHeader
          approved={form.approvedFields.includes("workTime")}
          fieldId="workTime"
          onToggle={toggleApproval}
          title="Arbeitszeit"
        />
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <LabeledInput
            label="Arbeitszeit von"
            onChange={(value) => updateValue("workStart", value)}
            suggestion={context.suggestions.workStart}
            type="time"
            value={form.workStart}
          />
          <LabeledInput
            label="Arbeitszeit bis"
            onChange={(value) => updateValue("workEnd", value)}
            suggestion={context.suggestions.workEnd}
            type="time"
            value={form.workEnd}
          />
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <SectionHeader
          approved={form.approvedFields.includes("trafficSafety")}
          fieldId="trafficSafety"
          onToggle={toggleApproval}
          title="Verkehrssicherung"
        />
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <LabeledInput
            label="Überprüfung 1"
            onChange={(value) =>
              updateValue("trafficSafetyFirstCheckTime", value)
            }
            type="time"
            value={form.trafficSafetyFirstCheckTime}
          />
          <LabeledInput
            label="Überprüfung 2"
            onChange={(value) =>
              updateValue("trafficSafetySecondCheckTime", value)
            }
            type="time"
            value={form.trafficSafetySecondCheckTime}
          />
        </div>
      </section>

      <CountRowsSection
        approved={form.approvedFields.includes("labor")}
        fieldId="labor"
        onRowsChange={(rows) => updateValue("laborRows", rows)}
        onToggle={toggleApproval}
        rows={form.laborRows}
        title="Arbeitskräfte"
      />

      <CountRowsSection
        approved={form.approvedFields.includes("machines")}
        fieldId="machines"
        headerAddon={
          <label className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700">
            <input
              checked={form.showRealMachineNames}
              onChange={(event) =>
                toggleRealMachineNames(event.currentTarget.checked)
              }
              type="checkbox"
            />
            Reale Maschinennamen anzeigen
          </label>
        }
        onRowsChange={(rows) => updateValue("machineRows", rows)}
        onToggle={toggleApproval}
        rows={form.machineRows}
        title="Maschinen und Geräte"
      />

      <MaterialRowsSection
        approved={form.approvedFields.includes("materials")}
        fieldId="materials"
        onRowsChange={(rows) => updateValue("materialRows", rows)}
        onToggle={toggleApproval}
        rows={form.materialRows}
      />

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <SectionHeader
          approved={form.approvedFields.includes("performance")}
          fieldId="performance"
          onToggle={toggleApproval}
          title="Sonstige Bauleistung"
        />
        <textarea
          className={textareaClassName}
          onChange={(event) =>
            updateValue(
              "performanceLines",
              event.target.value
                .split(/\r?\n/)
                .slice(0, dailyReportPerformanceLineLimit),
            )
          }
          rows={8}
          value={form.performanceLines.join("\n")}
        />
        <p className="mt-2 text-xs text-gray-500">
          Langer Text wird im PDF automatisch auf Fortsetzungsseiten
          weitergeführt.
        </p>
        <div className="mt-4">
          <p className="text-sm font-semibold text-gray-900">
            Auftraggeber (AG), Bauüberwacher, Planer oder Dritte auf der
            Baustelle gewesen? Wurde etwas angewiesen/besprochen?
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {siteDiscussionRoleOptions.map((option) => (
              <label
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-800"
                key={option.value}
              >
                <input
                  checked={form.siteDiscussionRoles.includes(option.value)}
                  onChange={(event) => {
                    const roles = new Set(form.siteDiscussionRoles);

                    if (event.currentTarget.checked) {
                      roles.add(option.value);
                    } else {
                      roles.delete(option.value);
                    }

                    updateValue("siteDiscussionRoles", Array.from(roles));
                  }}
                  type="checkbox"
                />
                {option.label}
              </label>
            ))}
            <label className="inline-flex min-w-[240px] flex-1 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-800">
              <span className="shrink-0">Dritte (wer?)</span>
              <input
                className="min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm font-normal text-gray-900 outline-none focus:border-gray-900"
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  const roles = new Set(form.siteDiscussionRoles);

                  if (value.trim()) {
                    roles.add("THIRD_PARTY");
                  } else {
                    roles.delete("THIRD_PARTY");
                  }

                  updateValue("siteDiscussionThirdPartyName", value);
                  updateValue("siteDiscussionRoles", Array.from(roles));
                }}
                value={form.siteDiscussionThirdPartyName}
              />
            </label>
          </div>
          <label className="mt-3 block text-sm font-medium text-gray-800">
            Bemerkung
            <textarea
              className="mt-1 min-h-24 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-normal text-gray-900 outline-none focus:border-gray-900"
              onChange={(event) =>
                updateValue("siteDiscussionNotes", event.target.value)
              }
              value={form.siteDiscussionNotes}
            />
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="text-base font-semibold text-gray-900">
          Unterschriften
        </h3>
        <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SignaturePad
            label="Josef Stix"
            onChange={(value) =>
              updateValue("contractorSignatureDataUrl", value)
            }
            value={form.contractorSignatureDataUrl}
          />
          <SignaturePad
            label="Auftraggeber"
            onChange={(value) => updateValue("clientSignatureDataUrl", value)}
            value={form.clientSignatureDataUrl}
          />
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
          <LabeledInput
            label="Freigegeben von"
            onChange={(value) => updateValue("approvedByName", value)}
            value={form.approvedByName}
          />
          <button
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-60"
            disabled={isPending}
            onClick={() => save(isApproved ? "APPROVED" : "DRAFT")}
            type="button"
          >
            Speichern
          </button>
          <button
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-60"
            disabled={isPending}
            onClick={() => save("APPROVED", true)}
            type="button"
          >
            Freigeben
          </button>
        </div>
        {saveMessage ? (
          <p className="mt-3 text-sm font-semibold text-emerald-700">
            {saveMessage}
          </p>
        ) : null}
      </section>
    </div>
  );
}

const approvalGroups = [
  "project",
  "weather",
  "workTime",
  "trafficSafety",
  "labor",
  "machines",
  "materials",
  "performance",
];

function createInitialState(context: DailyReportContext): ReportFormState {
  return {
    approvedByName: context.approvedByName,
    approvedFields: [...context.approvedFields],
    laborRows: cloneRows(context.laborRows),
    machineRows: cloneRows(context.machineRows),
    materialRows: cloneMaterialRows(context.materialRows),
    performanceLines: [...context.performanceLines],
    photoIds: context.photos
      .filter((photo) => photo.selected)
      .map((photo) => photo.id),
    photoGridLayout: context.photoGridLayout,
    projectName: context.projectName,
    projectNumber: context.projectNumber,
    sheetNumber: context.sheetNumber,
    siteDiscussionNotes: context.siteDiscussionNotes,
    siteDiscussionRoles: [...context.siteDiscussionRoles],
    siteDiscussionThirdPartyName: context.siteDiscussionThirdPartyName,
    contractorSignatureDataUrl: context.contractorSignatureDataUrl,
    clientSignatureDataUrl: context.clientSignatureDataUrl,
    showRealMachineNames: context.showRealMachineNames,
    trafficSafetyFirstCheckTime: context.trafficSafetyFirstCheckTime,
    trafficSafetySecondCheckTime: context.trafficSafetySecondCheckTime,
    weatherCategory: context.weatherLabel,
    weatherNotes: context.weatherNotes,
    weatherTempMaxC: context.tempMax,
    weatherTempMinC: context.tempMin,
    weekday: context.weekday,
    workEnd: context.workEnd,
    workStart: context.workStart,
  };
}

function cloneRows(rows: DailyReportCountRow[]) {
  return rows.map((row) => ({ ...row }));
}

function cloneMaterialRows(rows: DailyReportMaterialRow[]) {
  return rows.map((row) => ({ ...row }));
}

function SignaturePad({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);

    if (!value) return;

    const image = new window.Image();
    image.onload = () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
    };
    image.src = value;
  }, [value]);

  function getCanvasPoint(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();

    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function startDrawing(event: PointerEvent<HTMLCanvasElement>) {
    const point = getCanvasPoint(event);
    if (!point) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    isDrawingRef.current = true;
    lastPointRef.current = point;
  }

  function draw(event: PointerEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current) return;

    const canvas = canvasRef.current;
    const point = getCanvasPoint(event);
    const lastPoint = lastPointRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context || !point || !lastPoint) return;

    context.strokeStyle = "#111827";
    context.lineWidth = 5;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    context.moveTo(lastPoint.x, lastPoint.y);
    context.lineTo(point.x, point.y);
    context.stroke();

    lastPointRef.current = point;
  }

  function finishDrawing() {
    const canvas = canvasRef.current;

    if (!canvas || !isDrawingRef.current) return;

    isDrawingRef.current = false;
    lastPointRef.current = null;
    onChange(canvas.toDataURL("image/png"));
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    if (canvas && context) {
      context.clearRect(0, 0, canvas.width, canvas.height);
    }

    onChange("");
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-gray-800">{label}</span>
        <button
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-50"
          onClick={clearSignature}
          type="button"
        >
          Zurücksetzen
        </button>
      </div>
      <canvas
        className="block h-36 w-full touch-none rounded-lg border border-gray-300 bg-white shadow-inner"
        height={220}
        onPointerCancel={finishDrawing}
        onPointerDown={startDrawing}
        onPointerLeave={finishDrawing}
        onPointerMove={draw}
        onPointerUp={finishDrawing}
        ref={canvasRef}
        width={720}
      />
    </div>
  );
}

function SectionHeader({
  approved,
  fieldId,
  onToggle,
  title,
}: {
  approved: boolean;
  fieldId: string;
  onToggle: (fieldId: string, checked: boolean) => void;
  title: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      <label className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700">
        <input
          checked={approved}
          onChange={(event) => onToggle(fieldId, event.currentTarget.checked)}
          type="checkbox"
        />
        freigegeben
      </label>
    </div>
  );
}

function LabeledInput({
  label,
  onChange,
  suggestion,
  type = "text",
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  suggestion?: string;
  type?: string;
  value: string;
}) {
  return (
    <label className="text-sm font-medium text-gray-800">
      {label}
      <input
        className={inputClassName}
        onChange={(event) => onChange(event.currentTarget.value)}
        type={type}
        value={value}
      />
      {suggestion ? (
        <span className="mt-1 block text-xs font-normal text-gray-500">
          Vorschlag: {suggestion}
        </span>
      ) : null}
    </label>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-sm font-medium text-gray-800">
      {label}
      <div className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-900">
        {value || "-"}
      </div>
    </div>
  );
}

function MaterialRowsSection({
  approved,
  fieldId,
  onRowsChange,
  onToggle,
  rows,
}: {
  approved: boolean;
  fieldId: string;
  onRowsChange: (rows: DailyReportMaterialRow[]) => void;
  onToggle: (fieldId: string, checked: boolean) => void;
  rows: DailyReportMaterialRow[];
}) {
  function updateRow(
    index: number,
    key: "label" | "quantity" | "unit",
    value: string,
  ) {
    onRowsChange(
      rows.map((row, rowIndex) => {
        if (rowIndex !== index) return row;

        if (key === "quantity") {
          return {
            ...row,
            quantity: Number(value.replace(",", ".")) || 0,
          };
        }

        return {
          ...row,
          [key]: value,
        };
      }),
    );
  }

  function addEmptyRow() {
    onRowsChange([
      ...rows,
      {
        key: `material_${rows.length + 1}_${Date.now()}`,
        label: "",
        quantity: 0,
        unit: "",
      },
    ]);
  }

  function removeRow(index: number) {
    onRowsChange(rows.filter((_, rowIndex) => rowIndex !== index));
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <SectionHeader
        approved={approved}
        fieldId={fieldId}
        onToggle={onToggle}
        title="Material"
      />
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2 font-semibold">Menge</th>
              <th className="px-3 py-2 font-semibold">Bezeichnung</th>
              <th className="px-3 py-2 font-semibold">Einheit</th>
              <th className="px-3 py-2 font-semibold">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr className="border-t border-gray-100" key={row.key}>
                <td className="w-32 px-3 py-2">
                  <input
                    className={compactInputClassName}
                    min="0"
                    onChange={(event) =>
                      updateRow(index, "quantity", event.currentTarget.value)
                    }
                    step="0.1"
                    type="number"
                    value={row.quantity}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    className={compactInputClassName}
                    onChange={(event) =>
                      updateRow(index, "label", event.currentTarget.value)
                    }
                    value={row.label}
                  />
                </td>
                <td className="w-28 px-3 py-2">
                  <input
                    className={compactInputClassName}
                    onChange={(event) =>
                      updateRow(index, "unit", event.currentTarget.value)
                    }
                    value={row.unit}
                  />
                </td>
                <td className="w-24 px-3 py-2">
                  <button
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                    onClick={() => removeRow(index)}
                    type="button"
                  >
                    Löschen
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        className="mt-3 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
        onClick={addEmptyRow}
        type="button"
      >
        Materialzeile hinzufügen
      </button>
    </section>
  );
}

function CountRowsSection({
  approved,
  fieldId,
  headerAddon,
  onRowsChange,
  onToggle,
  rows,
  title,
}: {
  approved: boolean;
  fieldId: string;
  headerAddon?: ReactNode;
  onRowsChange: (rows: DailyReportCountRow[]) => void;
  onToggle: (fieldId: string, checked: boolean) => void;
  rows: DailyReportCountRow[];
  title: string;
}) {
  function updateRow(
    index: number,
    key: "count" | "hours" | "label",
    value: string,
  ) {
    onRowsChange(
      rows.map((row, rowIndex) => {
        if (rowIndex !== index) return row;

        if (key === "label") {
          return {
            ...row,
            label: value,
          };
        }

        return {
          ...row,
          [key]: Number(value.replace(",", ".")) || 0,
        };
      }),
    );
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <SectionHeader
        approved={approved}
        fieldId={fieldId}
        onToggle={onToggle}
        title={title}
      />
      {headerAddon ? <div className="mt-3">{headerAddon}</div> : null}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2 font-semibold">Anzahl</th>
              <th className="px-3 py-2 font-semibold">Bezeichnung</th>
              <th className="px-3 py-2 font-semibold">Ges. Std.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr className="border-t border-gray-100" key={row.key}>
                <td className="w-24 px-3 py-2">
                  <input
                    className={compactInputClassName}
                    min="0"
                    onChange={(event) =>
                      updateRow(index, "count", event.currentTarget.value)
                    }
                    type="number"
                    value={row.count}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    className={compactInputClassName}
                    onChange={(event) =>
                      updateRow(index, "label", event.currentTarget.value)
                    }
                    value={row.label}
                  />
                </td>
                <td className="w-28 px-3 py-2">
                  <input
                    className={compactInputClassName}
                    min="0"
                    onChange={(event) =>
                      updateRow(index, "hours", event.currentTarget.value)
                    }
                    step="0.5"
                    type="number"
                    value={row.hours}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
