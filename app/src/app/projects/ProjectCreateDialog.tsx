"use client";

import { useState, useTransition } from "react";
import { ActionIcon } from "@/components/ActionIcon";
import { useRouter } from "next/navigation";

import { createProject, type ProjectFormInput } from "./actions";
import { ConstructionManagersField } from "./ConstructionManagersField";
import { ProjectRequirementsFields } from "./ProjectRequirementsFields";
import { TimeReminderFields } from "./TimeReminderFields";

type ProjectStatus =
  | "NOT_STARTED"
  | "ACTIVE"
  | "PAUSED"
  | "FINISHED"
  | "CANCELLED";

const statusOptions: { value: ProjectStatus; label: string }[] = [
  { value: "NOT_STARTED", label: "noch nicht begonnen" },
  { value: "ACTIVE", label: "aktiv" },
  { value: "PAUSED", label: "ruht" },
  { value: "FINISHED", label: "beendet" },
  { value: "CANCELLED", label: "storniert" },
];

const emptyProject: ProjectFormInput = {
  actualEnd: "",
  actualStart: "",
  autoApproveTimeEntriesOverride: "inherit",
  changeOrdersNet: 0,
  client: "",
  constructionManagers: [],
  contractValueNet: 0,
  finalInvoiceCreated: false,
  finalInvoiceNet: 0,
  finalInvoiceNumber: "",
  name: "",
  notes: "",
  paymentsNet: 0,
  plannedEnd: "",
  plannedStart: "",
  remainingConstructionTime: "",
  dvgw: false,
  guetezeichenKanalbau: false,
  lieferscheine: false,
  progressPercent: 0,
  projectNumber: "",
  status: "NOT_STARTED",
  timeReminderExtraRecipients: "",
  timeReminderIntervalWeeks: 1,
  timeReminderMode: "inherit",
  timeReminderWeekdays: [],
};

export type ConstructionManagerOption = {
  employeeId: string;
  label: string;
  positionsLabel: string;
  value: string;
};

export function ProjectCreateDialog({
  constructionManagerOptions = [],
}: {
  constructionManagerOptions?: ConstructionManagerOption[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<ProjectFormInput>(emptyProject);
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function close() {
    if (isPending) return;
    setIsOpen(false);
    setForm(emptyProject);
  }

  function updateForm<K extends keyof ProjectFormInput>(
    key: K,
    value: ProjectFormInput[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function saveProject() {
    startTransition(async () => {
      try {
        await createProject(form);
        setForm(emptyProject);
        setIsOpen(false);
        router.refresh();
      } catch (error) {
        alert(error instanceof Error ? error.message : "Fehler beim Speichern.");
      }
    });
  }

  const formTotalContract = form.contractValueNet + form.changeOrdersNet;
  const formPerformanceValue =
    formTotalContract * (form.progressPercent / 100);
  const formBillingPercent =
    formTotalContract > 0 ? (form.paymentsNet / formTotalContract) * 100 : 0;
  const formDifference = form.paymentsNet - formPerformanceValue;
  const formCoveragePercent =
    formPerformanceValue > 0
      ? (formDifference / formPerformanceValue) * 100
      : 0;
  const formInvoiceDifference = form.finalInvoiceNet - formTotalContract;
  const formInvoiceQuotePercent =
    formTotalContract > 0 ? (form.finalInvoiceNet / formTotalContract) * 100 : 0;

  return (
    <>
      <button
        className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-700"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        Projekt anlegen
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-gray-950/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              close();
            }
          }}
        >
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-6xl overflow-y-auto rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-gray-950">
                  Neues Projekt anlegen
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  Gleiche Felder wie unter Projekte Leistung, damit die
                  Projektanlage überall identisch bleibt.
                </p>
              </div>
              <button
                aria-label="Schließen"
                className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-bold text-gray-800 hover:bg-gray-50"
                disabled={isPending}
                onClick={close}
                type="button"
              >
                <ActionIcon name="close" className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <TextField
                label="Projektnummer"
                onChange={(value) => updateForm("projectNumber", value)}
                value={form.projectNumber}
              />
              <TextField
                label="Projektname"
                onChange={(value) => updateForm("name", value)}
                value={form.name}
              />
              <TextField
                label="Auftraggeber"
                onChange={(value) => updateForm("client", value)}
                value={form.client}
              />
              <TextField
                label="Baubeginn geplant"
                onChange={(value) => updateForm("plannedStart", value)}
                type="date"
                value={form.plannedStart}
              />
              <TextField
                label="Bauende geplant"
                onChange={(value) => updateForm("plannedEnd", value)}
                type="date"
                value={form.plannedEnd}
              />
              <TextField
                label="Baubeginn tatsächlich"
                onChange={(value) => updateForm("actualStart", value)}
                type="date"
                value={form.actualStart}
              />
              <TextField
                label="Bauende tatsächlich"
                onChange={(value) => updateForm("actualEnd", value)}
                type="date"
                value={form.actualEnd}
              />
              <TextField
                label="Restliche Bauzeit"
                onChange={(value) => updateForm("remainingConstructionTime", value)}
                value={form.remainingConstructionTime}
              />

              <div>
                <label className="text-sm font-medium text-gray-700">
                  Status
                </label>
                <select
                  className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
                  onChange={(event) =>
                    updateForm("status", event.target.value as ProjectStatus)
                  }
                  value={form.status}
                >
                  {statusOptions.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>

              <ProjectRequirementsFields
                dvgw={form.dvgw}
                guetezeichenKanalbau={form.guetezeichenKanalbau}
                lieferscheine={form.lieferscheine}
                onDvgwChange={(value) => updateForm("dvgw", value)}
                onGuetezeichenKanalbauChange={(value) => updateForm("guetezeichenKanalbau", value)}
                onLieferscheineChange={(value) => updateForm("lieferscheine", value)}
              />

              <h4 className="md:col-span-2 lg:col-span-3 mt-2 border-t border-gray-200 pt-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Schnellstand
              </h4>

              <NumberField
                label="Auftragssumme (netto)"
                onChange={(value) => updateForm("contractValueNet", value)}
                value={form.contractValueNet}
              />
              <NumberField
                label="Nachträge beauftragt (netto)"
                onChange={(value) => updateForm("changeOrdersNet", value)}
                value={form.changeOrdersNet}
              />
              <NumberField
                label="Leistungsstand (IST %)"
                onChange={(value) => updateForm("progressPercent", value)}
                value={form.progressPercent}
              />
              <NumberField
                label="Summe aller Abschläge (netto)"
                onChange={(value) => updateForm("paymentsNet", value)}
                value={form.paymentsNet}
              />
            </div>

            <div className="mt-4">
              <ConstructionManagersField
                onChange={(value) => updateForm("constructionManagers", value)}
                options={constructionManagerOptions}
                value={form.constructionManagers}
              />
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
              <FormMetricCard
                label="Auftragssumme inkl. Nachträge (netto)"
                value={formatEuro(formTotalContract)}
              />
              <FormMetricCard
                detail={`${formatPercent(form.progressPercent)} Leistungsstand`}
                label="Leistungsstand (IST in €)"
                value={formatEuro(formPerformanceValue)}
              />
              <FormMetricCard
                detail={formatEuro(form.paymentsNet)}
                label="Abrechnungsstand (IST in %)"
                value={formatPercent(formBillingPercent)}
              />
              <FormMetricCard
                label="Delta Leistungsstand vs. Abrechnungsstand"
                tone={formDifference >= 0 ? "positive" : "negative"}
                value={formatEuro(formDifference)}
              />
              <FormMetricCard
                label="Über-/Unterdeckung"
                tone={formCoveragePercent >= 0 ? "positive" : "negative"}
                value={formatPercent(formCoveragePercent)}
              />
            </div>

            <h4 className="mt-6 border-t border-gray-200 pt-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Schlussrechnung
            </h4>

            <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-800">
                <input
                  checked={form.finalInvoiceCreated}
                  className="h-4 w-4 rounded border-gray-300"
                  onChange={(event) => updateForm("finalInvoiceCreated", event.target.checked)}
                  type="checkbox"
                />
                SR erstellt
              </label>
              <TextField
                label="SR-Nr."
                onChange={(value) => updateForm("finalInvoiceNumber", value)}
                value={form.finalInvoiceNumber}
              />
              <NumberField
                label="SR Summe (netto)"
                onChange={(value) => updateForm("finalInvoiceNet", value)}
                value={form.finalInvoiceNet}
              />
              {form.finalInvoiceCreated ? (
                <>
                  <FormMetricCard
                    label="Delta Auftragssumme vs. SR (netto)"
                    tone={formInvoiceDifference >= 0 ? "positive" : "negative"}
                    value={formatEuro(formInvoiceDifference)}
                  />
                  <FormMetricCard
                    label="Quote Auftragssumme vs. SR Summe"
                    value={formatPercent(formInvoiceQuotePercent)}
                  />
                </>
              ) : null}
            </div>

            <div className="mt-4">
              <label className="text-sm font-medium text-gray-700">
                Bemerkungen / Notizen
              </label>
              <textarea
                className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
                onChange={(event) => updateForm("notes", event.target.value)}
                rows={4}
                value={form.notes}
              />
            </div>

            <div className="mt-4">
              <label className="text-sm font-medium text-gray-700">
                Zeiterfassung: Automatische Freigabe
              </label>
              <select
                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
                onChange={(event) =>
                  updateForm(
                    "autoApproveTimeEntriesOverride",
                    event.target.value as "inherit" | "on" | "off",
                  )
                }
                value={form.autoApproveTimeEntriesOverride}
              >
                <option value="inherit">Kolonnen-Einstellung übernehmen (Standard, siehe Admin &gt; Kolonnen)</option>
                <option value="on">Immer automatisch freigeben (keine Bauleitungs-Freigabe nötig)</option>
                <option value="off">Immer Bauleitungs-Freigabe verlangen (Stunden müssen bestätigt werden)</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Legt fest, ob vom Polier erfasste Kolonnen-Stunden auf dieser Baustelle automatisch
                freigegeben werden oder eine Freigabe durch die Bauleitung benötigen. Überschreibt die
                Standard-Einstellung der jeweiligen Kolonne.
              </p>
            </div>

            <TimeReminderFields
              extraRecipients={form.timeReminderExtraRecipients}
              intervalWeeks={form.timeReminderIntervalWeeks}
              mode={form.timeReminderMode}
              onExtraRecipientsChange={(value) => updateForm("timeReminderExtraRecipients", value)}
              onIntervalWeeksChange={(weeks) => updateForm("timeReminderIntervalWeeks", weeks)}
              onModeChange={(mode) => updateForm("timeReminderMode", mode)}
              onWeekdaysChange={(weekdays) => updateForm("timeReminderWeekdays", weekdays)}
              weekdays={form.timeReminderWeekdays}
            />

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                className="rounded-xl border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                disabled={isPending}
                onClick={close}
                type="button"
              >
                Abbrechen
              </button>
              <button
                className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-60"
                disabled={isPending}
                onClick={saveProject}
                type="button"
              >
                {isPending ? "Speichert..." : "Projekt speichern"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function TextField({
  label,
  onChange,
  type = "text",
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  type?: string;
  value: string;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <input
        className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
        onChange={(event) => onChange(event.target.value)}
        type={type}
        value={value}
      />
    </div>
  );
}

/** Displays whatever the user is actively typing (own local state), not a
 * value reformatted from the parsed number on every render - a purely
 * value-driven input would erase a just-typed "," (or any trailing
 * partial decimal) the instant it's typed, since re-rendering with the
 * unchanged parsed number reformats back to the pre-comma string before
 * the user can type a fraction digit. Parsing still happens on every
 * keystroke (via onChange) so dependent live totals stay in sync - only
 * the input's own displayed text is decoupled from that round-trip.
 * Safe to initialize state once from `value`: both call sites (the
 * create dialog and the edit form in ProjectManager.tsx) fully unmount/
 * remount this field whenever the underlying record changes, rather
 * than reusing the same mounted instance across different projects. */
function NumberField({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: number) => void;
  value: number;
}) {
  const [text, setText] = useState(() =>
    value === 0 ? "" : formatNumberInputValue(value),
  );

  return (
    <div>
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <input
        className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
        inputMode="decimal"
        onChange={(event) => {
          setText(event.target.value);
          onChange(parseNumberInputValue(event.target.value));
        }}
        type="text"
        value={text}
      />
    </div>
  );
}

function FormMetricCard({
  detail,
  label,
  tone = "neutral",
  value,
}: {
  detail?: string;
  label: string;
  tone?: "negative" | "neutral" | "positive";
  value: string;
}) {
  const valueClass = getToneClass(tone);

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <p className="text-xs font-semibold uppercase text-gray-500">{label}</p>
      <p className={`mt-2 text-lg font-bold ${valueClass}`}>{value}</p>
      {detail ? <p className="mt-1 text-xs text-gray-500">{detail}</p> : null}
    </div>
  );
}

function getToneClass(tone: "negative" | "neutral" | "positive" = "neutral") {
  if (tone === "positive") return "text-green-700";
  if (tone === "negative") return "text-red-700";
  return "text-gray-900";
}

function formatNumberInputValue(value: number) {
  if (!Number.isFinite(value)) return "";
  return String(value).replace(".", ",");
}

function parseNumberInputValue(value: string) {
  const cleaned = value.trim();

  if (!cleaned) {
    return 0;
  }

  const parsed = Number(cleaned.replace(/\./g, "").replace(",", "."));

  return Number.isFinite(parsed) ? parsed : 0;
}

function formatEuro(value: number) {
  return new Intl.NumberFormat("de-DE", {
    currency: "EUR",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)} %`;
}
