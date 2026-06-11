"use client";

import { useMemo, useState, useTransition } from "react";
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
  id: string;
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
  }

  function startEdit(project: Project) {
    setForm(project);
    setEditingId(project.id);
    setShowForm(true);
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
          label="Auftragssumme inkl. Nachträge"
          value={formatEuro(totals.totalContract)}
        />
        <SummaryCard
          label="Leistungsstand IST"
          value={formatEuro(totals.performanceValue)}
        />
        <SummaryCard
          label="Abschläge gesamt"
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

      <div className="mb-6 flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Projektliste</h2>
          <p className="mt-1 text-sm text-gray-600">
            Projekte werden jetzt dauerhaft in der lokalen Datenbank gespeichert.
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
        <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
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
              label="Auftragssumme netto"
              value={form.contractValueNet}
              onChange={(value) => updateForm("contractValueNet", value)}
            />
            <NumberField
              label="Nachträge (beauftragt) netto"
              value={form.changeOrdersNet}
              onChange={(value) => updateForm("changeOrdersNet", value)}
            />
            <NumberField
              label="Leistungsstand IST in %"
              value={form.progressPercent}
              onChange={(value) => updateForm("progressPercent", value)}
            />
            <NumberField
              label="Summe Abschläge netto"
              value={form.paymentsNet}
              onChange={(value) => updateForm("paymentsNet", value)}
            />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <FormMetricCard
              label="Auftragssumme inkl. Nachträge"
              value={formatEuro(formTotalContract)}
            />
            <FormMetricCard
              label="Leistungsstand IST in €"
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
          <table className="w-full min-w-[1300px] border-collapse text-left text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <TableHead>Aktion</TableHead>
                <TableHead>Projekt</TableHead>
                <TableHead>Bauleiter</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Zeitraum geplant</TableHead>
                <TableHead>Auftrag</TableHead>
                <TableHead>Nachträge (beauftragt)</TableHead>
                <TableHead>Gesamt</TableHead>
                <TableHead>Leistung</TableHead>
                <TableHead>Abschläge</TableHead>
                <TableHead>Differenz</TableHead>
                <TableHead>Über-/Unterdeckung</TableHead>
              </tr>
            </thead>
            <tbody>
              {projects.length === 0 ? (
                <tr>
                  <td colSpan={12} className="p-8 text-center text-gray-500">
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

                  return (
                    <tr key={project.id} className="border-t border-gray-100">
                      <td className="p-4 align-top">
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEdit(project)}
                            title="Projekt bearbeiten"
                            aria-label="Projekt bearbeiten"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                          >
                            <ActionIcon name="edit" className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => handleDeleteProject(project)}
                            title="Projekt löschen"
                            aria-label="Projekt löschen"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-50 disabled:opacity-50"
                            disabled={isPending}
                          >
                            <ActionIcon name="delete" className="h-4 w-4" />
                          </button>
                        </div>
                      </td>

                      <td className="p-4 align-top">
                        <div className="font-semibold text-gray-900">
                          {project.projectNumber}
                        </div>
                        <div className="mt-1 text-gray-600">
                          {project.name}
                        </div>
                      </td>

                      <td className="p-4 align-top text-gray-700">
                        {project.constructionManager || "-"}
                      </td>

                      <td className="p-4 align-top">
                        <StatusBadge status={project.status} />
                      </td>

                      <td className="p-4 align-top text-gray-700">
                        {formatDate(project.plannedStart)} –{" "}
                        {formatDate(project.plannedEnd)}
                      </td>

                      <td className="p-4 align-top text-gray-700">
                        {formatEuro(project.contractValueNet)}
                      </td>

                      <td className="p-4 align-top text-gray-700">
                        {formatEuro(project.changeOrdersNet)}
                      </td>

                      <td className="p-4 align-top font-semibold text-gray-900">
                        {formatEuro(totalContract)}
                      </td>

                      <td className="p-4 align-top text-gray-700">
                        <div>{project.progressPercent} %</div>
                        <div className="text-xs text-gray-500">
                          {formatEuro(performanceValue)}
                        </div>
                      </td>

                      <td className="p-4 align-top text-gray-700">
                        {formatEuro(project.paymentsNet)}
                      </td>

                      <td className="p-4 align-top font-semibold text-gray-900">
                        {formatEuro(difference)}
                      </td>

                      <td className="p-4 align-top">
                        <span
                          className={
                            coverage >= 0
                              ? "font-semibold text-green-700"
                              : "font-semibold text-red-700"
                          }
                        >
                          {coverage.toFixed(1)} %
                        </span>
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

function getToneClass(tone: "negative" | "neutral" | "positive" = "neutral") {
  if (tone === "positive") {
    return "text-green-700";
  }

  if (tone === "negative") {
    return "text-red-700";
  }

  return "text-gray-900";
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
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
      />
    </div>
  );
}

function TableHead({ children }: { children: React.ReactNode }) {
  return <th className="whitespace-nowrap p-4 font-semibold">{children}</th>;
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
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${colorMap[status]}`}
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
