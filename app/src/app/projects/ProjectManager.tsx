"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  cancelProject,
  createProject,
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

  const totals = useMemo(() => {
    return projects.reduce(
      (sum, project) => {
        const totalContract =
          project.contractValueNet + project.changeOrdersNet;

        const performanceValue =
          totalContract * (project.progressPercent / 100);

        // Positiv = Überdeckung
        // Negativ = Unterdeckung
        const difference = project.paymentsNet - performanceValue;

        return {
          totalContract: sum.totalContract + totalContract,
          performanceValue: sum.performanceValue + performanceValue,
          payments: sum.payments + project.paymentsNet,
          difference: sum.difference + difference,
        };
      },
      {
        totalContract: 0,
        performanceValue: 0,
        payments: 0,
        difference: 0,
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
        router.refresh();
      } catch (error) {
        alert(error instanceof Error ? error.message : "Fehler beim Speichern.");
      }
    });
  }

  function handleCancelProject(id: string) {
    const confirmed = window.confirm(
      "Dieses Projekt wirklich als storniert markieren?"
    );

    if (!confirmed) return;

    startTransition(async () => {
      await cancelProject(id);
      router.refresh();
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

  return (
    <>
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
          value={formatEuro(totals.difference)}
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
              label="Nachträge netto"
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
                <TableHead>Projekt</TableHead>
                <TableHead>Bauleiter</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Zeitraum geplant</TableHead>
                <TableHead>Auftrag</TableHead>
                <TableHead>Nachträge</TableHead>
                <TableHead>Gesamt</TableHead>
                <TableHead>Leistung</TableHead>
                <TableHead>Abschläge</TableHead>
                <TableHead>Differenz</TableHead>
                <TableHead>Über-/Unterdeckung</TableHead>
                <TableHead>Aktionen</TableHead>
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

                      <td className="p-4 align-top">
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEdit(project)}
                            className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                          >
                            Bearbeiten
                          </button>

                          <button
                            onClick={() => handleCancelProject(project.id)}
                            className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                            disabled={project.status === "CANCELLED"}
                          >
                            Stornieren
                          </button>
                        </div>
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

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-3 text-xl font-bold text-gray-900">{value}</p>
    </div>
  );
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

function formatDate(value: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("de-DE").format(new Date(value));
}