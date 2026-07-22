"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ActionIcon } from "@/components/ActionIcon";
import {
  cancelProject,
  createProject,
  deleteProject,
  ProjectFormInput,
  updateProject,
} from "./actions";

type ProjectStatus =
  | "NOT_STARTED"
  | "ACTIVE"
  | "PAUSED"
  | "FINISHED"
  | "CANCELLED";

type Project = ProjectFormInput & {
  controllingSummary: ProjectControllingSummary | null;
  id: string;
};

type ProjectControllingSummary = {
  actualCostsNet: number;
  detailCostsNet: number;
  hourCostsNet: number;
  invoiceRevenueNet: number;
  periodEnd: string;
  periodStart: string;
  performanceValueNet: number;
  progressPercent: number;
  reportId: string;
  resultNet: number;
  resultPercent: number;
  status: string;
  title: string;
};

const statusOptions: { value: ProjectStatus; label: string }[] = [
  { value: "NOT_STARTED", label: "noch nicht begonnen" },
  { value: "ACTIVE", label: "aktiv" },
  { value: "PAUSED", label: "ruht" },
  { value: "FINISHED", label: "beendet" },
  { value: "CANCELLED", label: "storniert" },
];

const emptyProject: ProjectFormInput = {
  projectNumber: "",
  name: "",
  constructionManager: "",
  plannedStart: "",
  plannedEnd: "",
  actualStart: "",
  actualEnd: "",
  status: "NOT_STARTED",
  contractValueNet: 0,
  changeOrdersNet: 0,
  progressPercent: 0,
  paymentsNet: 0,
  notes: "",
};

export function ProjectManager({ projects }: { projects: Project[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLDivElement | null>(null);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<ProjectFormInput>(emptyProject);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<Project | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const totals = useMemo(() => {
    return projects.reduce(
      (sum, project) => {
        const totalContract =
          project.contractValueNet + project.changeOrdersNet;

        const performanceValue =
          totalContract * (project.progressPercent / 100);
        const performanceValueWithoutChangeOrders =
          project.contractValueNet * (project.progressPercent / 100);

        // Positiv = Überdeckung
        // Negativ = Unterdeckung
        const difference = project.paymentsNet - performanceValue;
        const differenceWithoutChangeOrders =
          project.paymentsNet - performanceValueWithoutChangeOrders;

        return {
          totalContract: sum.totalContract + totalContract,
          performanceValue: sum.performanceValue + performanceValue,
          performanceValueWithoutChangeOrders:
            sum.performanceValueWithoutChangeOrders +
            performanceValueWithoutChangeOrders,
          payments: sum.payments + project.paymentsNet,
          difference: sum.difference + difference,
          differenceWithoutChangeOrders:
            sum.differenceWithoutChangeOrders + differenceWithoutChangeOrders,
        };
      },
      {
        totalContract: 0,
        performanceValue: 0,
        performanceValueWithoutChangeOrders: 0,
        payments: 0,
        difference: 0,
        differenceWithoutChangeOrders: 0,
      }
    );
  }, [projects]);

  function resetForm() {
    setForm(emptyProject);
    setEditingId(null);
    setShowForm(false);
  }

  function startCreate() {
    setForm(emptyProject);
    setEditingId(null);
    setShowForm(true);
    window.setTimeout(() => {
      formRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  }

  function startEdit(project: Project) {
    setForm(project);
    setEditingId(project.id);
    setShowForm(true);
    window.setTimeout(() => {
      formRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  }

  function saveProject() {
    startTransition(async () => {
      try {
        if (editingId) {
          await updateProject({
            ...form,
            id: editingId,
          });
        } else {
          await createProject(form);
        }

        resetForm();
        setFeedbackMessage("Projekt wurde gespeichert.");
        router.refresh();
      } catch (error) {
        alert(error instanceof Error ? error.message : "Fehler beim Speichern.");
      }
    });
  }

  function handleDeleteProject(project: Project) {
    setDeleteCandidate(project);
  }

  function handleCancelProject(project: Project) {
    startTransition(async () => {
      try {
        await cancelProject(project.id);

        if (editingId === project.id) {
          resetForm();
        }

        setDeleteCandidate(null);
        setFeedbackMessage("Projekt wurde inaktiv/storniert gestellt.");
        router.refresh();
      } catch (error) {
        alert(
          error instanceof Error
            ? error.message
            : "Fehler beim Inaktivstellen."
        );
      }
    });
  }

  function handleConfirmDeleteProject(project: Project) {
    startTransition(async () => {
      try {
        await deleteProject(project.id);

        if (editingId === project.id) {
          resetForm();
        }

        setDeleteCandidate(null);
        setFeedbackMessage("Projekt und zugehörige Daten wurden gelöscht.");
        router.refresh();
      } catch (error) {
        alert(error instanceof Error ? error.message : "Fehler beim Löschen.");
      }
    });
  }

  function updateForm<K extends keyof ProjectFormInput>(
    key: K,
    value: ProjectFormInput[K]
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
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

  return (
    <>
      {deleteCandidate ? (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-gray-950/40 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-red-200 bg-white p-6 shadow-2xl">
            <div className="inline-flex rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800">
              Projekt löschen
            </div>

            <h2 className="mt-4 text-xl font-bold text-gray-900">
              Sicher, dass das Projekt gelöscht werden soll?
            </h2>

            <p className="mt-3 text-sm leading-6 text-gray-700">
              Beim endgültigen Löschen von{" "}
              <span className="font-semibold">
                {deleteCandidate.projectNumber} · {deleteCandidate.name}
              </span>{" "}
              werden auch alle dazugehörigen Projektakten-Daten und
              Dispositionen gelöscht, zum Beispiel Fotos, Dokumente,
              Formulare, Bautagesberichte, Wetterprotokolle,
              Asphaltdisposition, LKW-Disposition, Kurzstrecke,
              Sonderfahrzeuge, Kolonnen- und Gerätedisposition.
            </p>

            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950">
              Alternative: Projekt inaktiv/storniert stellen. Dann bleibt alles
              erhalten und das Projekt taucht nicht mehr als aktives Projekt auf.
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteCandidate(null)}
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                disabled={isPending}
              >
                Abbrechen
              </button>

              <button
                type="button"
                onClick={() => handleCancelProject(deleteCandidate)}
                className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-100 disabled:opacity-50"
                disabled={isPending}
              >
                Inaktiv stellen, alles erhalten
              </button>

              <button
                type="button"
                onClick={() => handleConfirmDeleteProject(deleteCandidate)}
                className="rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50"
                disabled={isPending}
              >
                Endgültig löschen
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {feedbackMessage ? (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-green-200 bg-green-50 px-5 py-3 text-sm font-semibold text-green-900">
          <span>{feedbackMessage}</span>
          <button
            type="button"
            onClick={() => setFeedbackMessage(null)}
            className="rounded-lg border border-green-300 bg-white px-3 py-1 text-xs font-semibold text-green-900 hover:bg-green-100"
          >
            Schließen
          </button>
        </div>
      ) : null}

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <SummaryCard
          label="Schnellstand Auftrag inkl. Nachträge"
          value={formatEuro(totals.totalContract)}
        />
        <SummaryCard
          label="Schnellstand Leistung"
          value={formatEuro(totals.performanceValue)}
        />
        <SummaryCard
          label="Schnellstand Abschläge"
          value={formatEuro(totals.payments)}
        />
        <SummaryCard
          label="Über-/Unterdeckung"
          details={[
            {
              label: "ohne Nachträge",
              value: formatEuro(totals.differenceWithoutChangeOrders),
              tone:
                totals.differenceWithoutChangeOrders >= 0
                  ? "positive"
                  : "negative",
            },
            {
              label: "mit Nachträgen",
              value: formatEuro(totals.difference),
              tone: totals.difference >= 0 ? "positive" : "negative",
            },
          ]}
        />
      </div>

      <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-900">
              Bauleiter-Schnellstand
            </div>
            <h2 className="mt-3 text-xl font-semibold text-gray-950">
              Für Bauleitersitzungen schnell Zahlen eintragen
            </h2>
            <p className="mt-1 max-w-4xl text-sm leading-6 text-gray-700">
              Diese Werte sind eine schnelle Projektsicht. Die belastbare
              Auswertung mit iTWO, Disposition, Stunden, Geräten und Material
              bleibt in der Controlling-Leistungsmeldung.
            </p>
          </div>
          <Link
            href="/controlling/performance"
            className="inline-flex items-center justify-center rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-100"
          >
            Controlling öffnen
          </Link>
        </div>
      </div>

      <div className="mb-6 flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Projektliste</h2>
          <p className="mt-1 text-sm text-gray-600">
            Schnellstand pflegen und mit der letzten Leistungsmeldung vergleichen.
          </p>
        </div>

        <button
          onClick={showForm ? resetForm : startCreate}
          className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-700"
        >
          {showForm ? "Formular schließen" : "Projekt anlegen"}
        </button>
      </div>

      {showForm ? (
        <div
          ref={formRef}
          className="mb-6 scroll-mt-28 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
        >
          <h3 className="text-lg font-semibold text-gray-900">
            {editingId ? "Projekt bearbeiten" : "Neues Projekt anlegen"}
          </h3>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <TextField
              label="Projektnummer"
              value={form.projectNumber}
              onChange={(value) => updateForm("projectNumber", value)}
            />
            <TextField
              label="Projektname"
              value={form.name}
              onChange={(value) => updateForm("name", value)}
            />
            <TextField
              label="Bauleiter"
              value={form.constructionManager}
              onChange={(value) => updateForm("constructionManager", value)}
            />

            <TextField
              label="Baubeginn geplant"
              type="date"
              value={form.plannedStart}
              onChange={(value) => updateForm("plannedStart", value)}
            />
            <TextField
              label="Bauende geplant"
              type="date"
              value={form.plannedEnd}
              onChange={(value) => updateForm("plannedEnd", value)}
            />
            <TextField
              label="Baubeginn tatsächlich"
              type="date"
              value={form.actualStart}
              onChange={(value) => updateForm("actualStart", value)}
            />
            <TextField
              label="Bauende tatsächlich"
              type="date"
              value={form.actualEnd}
              onChange={(value) => updateForm("actualEnd", value)}
            />

            <div>
              <label className="text-sm font-medium text-gray-700">
                Status
              </label>
              <select
                value={form.status}
                onChange={(event) =>
                  updateForm("status", event.target.value as ProjectStatus)
                }
                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
              >
                {statusOptions.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>

            <NumberField
              label="Schnellstand Auftrag netto"
              value={form.contractValueNet}
              onChange={(value) => updateForm("contractValueNet", value)}
            />
            <NumberField
              label="Schnellstand Nachträge netto"
              value={form.changeOrdersNet}
              onChange={(value) => updateForm("changeOrdersNet", value)}
            />
            <NumberField
              label="Schnellstand Leistung in %"
              value={form.progressPercent}
              onChange={(value) => updateForm("progressPercent", value)}
            />
            <NumberField
              label="Schnellstand Abschläge netto"
              value={form.paymentsNet}
              onChange={(value) => updateForm("paymentsNet", value)}
            />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <FormMetricCard
              label="Schnellstand Auftrag inkl. Nachträge"
              value={formatEuro(formTotalContract)}
            />
            <FormMetricCard
              label="Schnellstand Leistung in €"
              value={formatEuro(formPerformanceValue)}
              detail={`${formatPercent(form.progressPercent)} Leistungsstand`}
            />
            <FormMetricCard
              label="Abrechnungsstand (IST in %)"
              value={formatPercent(formBillingPercent)}
              detail={formatEuro(form.paymentsNet)}
            />
            <FormMetricCard
              label="Über-/Unterdeckung in %"
              value={formatPercent(formCoveragePercent)}
              detail={formatEuro(formDifference)}
              tone={formCoveragePercent >= 0 ? "positive" : "negative"}
            />
          </div>

          <div className="mt-4">
            <label className="text-sm font-medium text-gray-700">
              Bemerkungen / Notizen
            </label>
            <textarea
              value={form.notes}
              onChange={(event) => updateForm("notes", event.target.value)}
              rows={4}
              className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
            />
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={resetForm}
              className="rounded-xl border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              disabled={isPending}
            >
              Abbrechen
            </button>
            <button
              onClick={saveProject}
              className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-60"
              disabled={isPending}
            >
              {isPending
                ? "Speichert..."
                : editingId
                  ? "Änderungen speichern"
                  : "Projekt speichern"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] border-collapse text-left text-xs">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <TableHead>Aktion</TableHead>
                <TableHead>Projekt</TableHead>
                <TableHead>Bauleiter</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Zeitraum</TableHead>
                <TableHead>Schnellstand</TableHead>
                <TableHead>Controlling</TableHead>
                <TableHead>Abgleich</TableHead>
              </tr>
            </thead>
            <tbody>
              {projects.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500">
                    Noch keine Projekte vorhanden.
                  </td>
                </tr>
              ) : (
                projects.map((project) => {
                  const totalContract =
                    project.contractValueNet + project.changeOrdersNet;

                  const performanceValue =
                    totalContract * (project.progressPercent / 100);

                  // Positiv = Überdeckung
                  // Negativ = Unterdeckung
                  const difference = project.paymentsNet - performanceValue;

                  const coverage =
                    performanceValue > 0
                      ? (difference / performanceValue) * 100
                      : 0;
                  const controlling = project.controllingSummary;
                  const billingDifference =
                    controlling !== null
                      ? project.paymentsNet - controlling.invoiceRevenueNet
                      : null;

                  return (
                    <tr key={project.id} className="border-t border-gray-100">
                      <td className="p-3 align-top">
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEdit(project)}
                            title="Projekt bearbeiten"
                            aria-label="Projekt bearbeiten"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                          >
                            <ActionIcon name="edit" className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => handleDeleteProject(project)}
                            title="Projekt löschen"
                            aria-label="Projekt löschen"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-50 disabled:opacity-50"
                            disabled={isPending}
                          >
                            <ActionIcon name="delete" className="h-4 w-4" />
                          </button>
                        </div>
                      </td>

                      <td className="max-w-52 p-3 align-top">
                        <div className="font-semibold text-gray-900">
                          {project.projectNumber}
                        </div>
                        <div className="mt-0.5 truncate text-gray-600" title={project.name}>
                          {project.name}
                        </div>
                      </td>

                      <td className="max-w-36 truncate p-3 align-top text-gray-700" title={project.constructionManager || undefined}>
                        {project.constructionManager || "-"}
                      </td>

                      <td className="p-3 align-top">
                        <StatusBadge status={project.status} />
                      </td>

                      <td className="whitespace-nowrap p-3 align-top text-gray-700">
                        <div>{formatDate(project.plannedStart)}</div>
                        <div className="text-gray-400">– {formatDate(project.plannedEnd)}</div>
                      </td>

                      <td className="whitespace-nowrap p-3 align-top text-gray-700">
                        <div className="font-semibold text-gray-950">
                          {formatEuro(performanceValue)}
                        </div>
                        <div className="mt-0.5 text-[11px] text-gray-500">
                          {formatPercent(project.progressPercent)} von{" "}
                          {formatEuro(totalContract)}
                        </div>
                        <div className="mt-0.5 text-[11px] text-gray-500">
                          Abschläge {formatEuro(project.paymentsNet)}
                        </div>
                        <span
                          className={
                            coverage >= 0
                              ? "mt-1 inline-flex rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-green-700"
                              : "mt-1 inline-flex rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700"
                          }
                        >
                          {formatEuro(difference)} · {coverage.toFixed(1)} %
                        </span>
                      </td>

                      <td className="p-3 align-top">
                        {controlling ? (
                          <div className="min-w-72">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="font-semibold text-gray-950">
                                {controlling.title}
                              </span>
                              <span className="text-[11px] text-gray-500">
                                {formatDate(controlling.periodStart)}–
                                {formatDate(controlling.periodEnd)}
                              </span>
                              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700">
                              {getReportStatusLabel(controlling.status)}
                              </span>
                            </div>
                            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                              <CompactMetric
                                label="Leistung"
                                title="Leistung"
                                value={formatEuro(controlling.performanceValueNet)}
                              />
                              <CompactMetric
                                label="Istkosten"
                                title="Istkosten"
                                value={formatEuro(controlling.actualCostsNet)}
                              />
                              <CompactMetric
                                label="Abgerechnet"
                                title="Abgerechnet"
                                value={formatEuro(controlling.invoiceRevenueNet)}
                              />
                              <CompactMetric
                                label="Ergebnis"
                                title="Ergebnis"
                                tone={
                                  controlling.resultNet >= 0 ? "positive" : "negative"
                                }
                                value={`${formatEuro(controlling.resultNet)} · ${formatPercent(controlling.resultPercent)}`}
                              />
                            </div>
                            <Link
                              href={`/controlling/performance?projectId=${project.id}&reportId=${controlling.reportId}`}
                              className="mt-2 inline-flex rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-800 hover:bg-gray-50"
                            >
                              Öffnen
                            </Link>
                          </div>
                        ) : (
                          <div className="min-w-48 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-2 text-[11px] text-gray-500">
                            Keine Leistungsmeldung.
                            <Link
                              href={`/controlling/performance?projectId=${project.id}`}
                              className="mt-1 block font-semibold text-gray-900 underline"
                            >
                              Anlegen
                            </Link>
                          </div>
                        )}
                      </td>

                      <td className="w-32 p-3 align-top text-gray-700">
                        {billingDifference !== null ? (
                          <div>
                            <div
                              className={
                                Math.abs(billingDifference) < 1
                                  ? "font-semibold text-gray-700"
                                  : billingDifference > 0
                                    ? "font-semibold text-amber-700"
                                    : "font-semibold text-blue-700"
                              }
                            >
                              {formatEuro(billingDifference)}
                            </div>
                            <div className="mt-0.5 text-[11px] leading-4 text-gray-500">
                              Abschläge vs. abgerechnet
                            </div>
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function SummaryCard({
  label,
  value,
  valueTone = "neutral",
  details,
}: {
  label: string;
  value?: string;
  valueTone?: "negative" | "neutral" | "positive";
  details?: {
    label: string;
    tone?: "negative" | "neutral" | "positive";
    value: string;
  }[];
}) {
  const valueClass = getToneClass(valueTone);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      {value ? (
        <p className={`mt-3 text-xl font-bold ${valueClass}`}>{value}</p>
      ) : null}
      {details?.length ? (
        <div
          className={
            value
              ? "mt-3 space-y-1 border-t border-gray-100 pt-3"
              : "mt-3 space-y-1"
          }
        >
          {details.map((detail) => (
            <div
              key={detail.label}
              className="flex items-center justify-between gap-3 text-xs"
            >
              <span className="font-medium text-gray-500">
                {detail.label}
              </span>
              <span className={`font-semibold ${getToneClass(detail.tone)}`}>
                {detail.value}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FormMetricCard({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "negative" | "neutral" | "positive";
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

function CompactMetric({
  label,
  title,
  tone = "neutral",
  value,
}: {
  label: string;
  title: string;
  tone?: "negative" | "neutral" | "positive";
  value: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2" title={title}>
      <span className="font-semibold uppercase text-gray-500">{label}</span>
      <span className={`truncate font-semibold ${getToneClass(tone)}`}>
        {value}
      </span>
    </div>
  );
}

function getToneClass(tone: "negative" | "neutral" | "positive" = "neutral") {
  if (tone === "positive") {
    return "text-green-700";
  }

  if (tone === "negative") {
    return "text-red-700";
  }

  return "text-gray-900";
}

function getReportStatusLabel(status: string) {
  const statusMap: Record<string, string> = {
    DRAFT: "Entwurf",
    abrechnungsreif: "Abrechnungsreif",
    fertig: "Fertig",
    kritisch: "Kritisch",
    laufend: "Laufend",
  };

  return statusMap[status] ?? status;
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
      />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <input
        inputMode="decimal"
        type="text"
        value={value === 0 ? "" : formatNumberInputValue(value)}
        onChange={(event) => onChange(parseNumberInputValue(event.target.value))}
        className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
      />
    </div>
  );
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

function TableHead({ children }: { children: React.ReactNode }) {
  return <th className="whitespace-nowrap p-3 font-semibold">{children}</th>;
}

function StatusBadge({ status }: { status: ProjectStatus }) {
  const colorMap: Record<ProjectStatus, string> = {
    NOT_STARTED: "bg-gray-100 text-gray-700",
    ACTIVE: "bg-green-100 text-green-800",
    PAUSED: "bg-yellow-100 text-yellow-800",
    FINISHED: "bg-blue-100 text-blue-800",
    CANCELLED: "bg-red-100 text-red-800",
  };

  const labelMap: Record<ProjectStatus, string> = {
    NOT_STARTED: "noch nicht begonnen",
    ACTIVE: "aktiv",
    PAUSED: "ruht",
    FINISHED: "beendet",
    CANCELLED: "storniert",
  };

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${colorMap[status]}`}
    >
      {labelMap[status]}
    </span>
  );
}

function formatEuro(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)} %`;
}

function formatDate(value: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("de-DE").format(new Date(value));
}
