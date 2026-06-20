import Link from "next/link";
import { ActionIcon } from "@/components/ActionIcon";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import {
  createWorkshopRepairOrder,
  deleteWorkshopRepairOrder,
  updateWorkshopRepairOrder,
} from "./actions";
import { WorkshopEditDialog } from "./WorkshopEditDialog";
import { WorkshopStatusFields } from "./WorkshopStatusFields";
import { WorkshopFormCenter } from "./WorkshopFormCenter";
import { deleteWorkshopFormSubmission } from "./form-actions";
import {
  BUILT_IN_WORKSHOP_FORMS,
  parseWorkshopFormValues,
  parseWorkshopSnapshotFields,
  type WorkshopFormKind,
} from "./workshopFormTypes";
import {
  getProjectFormPresetOptions,
  parseProjectFormFields,
  type ProjectFormFieldDefinition,
} from "@/app/projects/projectFormTypes";
import {
  ensureWorkshopRepairOrderTemplate,
  WORKSHOP_REPAIR_SYSTEM_FIELD_IDS,
  WORKSHOP_REPAIR_TEMPLATE_ID,
} from "./repairOrderTemplate";

const statusOptions = [
  { label: "Offen", value: "OPEN" },
  { label: "In Arbeit", value: "IN_PROGRESS" },
  { label: "Wartet", value: "WAITING" },
  { label: "Erledigt", value: "DONE" },
  { label: "Abgebrochen", value: "CANCELLED" },
];

const priorityOptions = [
  { label: "Niedrig", value: "LOW" },
  { label: "Normal", value: "NORMAL" },
  { label: "Hoch", value: "HIGH" },
  { label: "Dringend", value: "URGENT" },
];

function formatDateInput(date: Date | null | undefined) {
  return date ? date.toISOString().slice(0, 10) : "";
}

function formatDate(date: Date | null | undefined) {
  if (!date) return "-";

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function getStatusLabel(value: string) {
  return statusOptions.find((option) => option.value === value)?.label ?? value;
}

function getPriorityLabel(value: string) {
  return priorityOptions.find((option) => option.value === value)?.label ?? value;
}

function getStatusClass(value: string) {
  if (value === "DONE") return "bg-green-100 text-green-900";
  if (value === "IN_PROGRESS") return "bg-blue-100 text-blue-900";
  if (value === "WAITING") return "bg-amber-100 text-amber-950";
  if (value === "CANCELLED") return "bg-gray-200 text-gray-700";
  return "bg-red-100 text-red-900";
}

function getPriorityClass(value: string) {
  if (value === "URGENT") return "bg-red-700 text-white";
  if (value === "HIGH") return "bg-orange-100 text-orange-950";
  if (value === "LOW") return "bg-gray-100 text-gray-700";
  return "bg-blue-50 text-blue-900";
}

function getVehicleLabel(vehicle: {
  licensePlate: string | null;
  vehicleNumber: string | null;
  vehicleType: string | null;
}) {
  return [vehicle.vehicleNumber, vehicle.licensePlate, vehicle.vehicleType]
    .filter(Boolean)
    .join(" · ");
}

function normalizeSearchText(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss");
}

function parseRepairCustomValues(value: string | null | undefined) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, boolean | string>)
      : {};
  } catch {
    return {};
  }
}

function compareRepairOrders(
  a: {
    assignedTo: string | null;
    createdAt: Date;
    plannedEnd: Date | null;
    plannedStart: Date | null;
    priority: string;
    reportedAt: Date;
    status: string;
  },
  b: {
    assignedTo: string | null;
    createdAt: Date;
    plannedEnd: Date | null;
    plannedStart: Date | null;
    priority: string;
    reportedAt: Date;
    status: string;
  },
  mode: string,
) {
  const priorityRank: Record<string, number> = {
    URGENT: 4,
    HIGH: 3,
    NORMAL: 2,
    LOW: 1,
  };
  const dateValue = (value: Date | null) =>
    value ? value.getTime() : Number.MAX_SAFE_INTEGER;

  if (mode === "oldest") return a.reportedAt.getTime() - b.reportedAt.getTime();
  if (mode === "priority-desc") {
    return (priorityRank[b.priority] ?? 0) - (priorityRank[a.priority] ?? 0);
  }
  if (mode === "priority-asc") {
    return (priorityRank[a.priority] ?? 0) - (priorityRank[b.priority] ?? 0);
  }
  if (mode === "assigned") {
    return (a.assignedTo ?? "ZZZ").localeCompare(b.assignedTo ?? "ZZZ", "de-DE");
  }
  if (mode === "planned-start") return dateValue(a.plannedStart) - dateValue(b.plannedStart);
  if (mode === "planned-end") return dateValue(a.plannedEnd) - dateValue(b.plannedEnd);
  if (mode === "status") return a.status.localeCompare(b.status, "de-DE");
  return b.reportedAt.getTime() - a.reportedAt.getTime();
}

export default async function WorkshopPage({
  searchParams,
}: {
  searchParams: Promise<{
    archive?: string;
    assigned?: string;
    editForm?: string;
    planned?: string;
    priority?: string;
    q?: string;
    sort?: string;
    status?: string;
  }>;
}) {
  await ensureWorkshopRepairOrderTemplate();
  const params = await searchParams;
  const q = String(params.q ?? "").trim();
  const statusFilter = String(params.status ?? "").trim();
  const priorityFilter = String(params.priority ?? "").trim();
  const assignedFilter = String(params.assigned ?? "").trim();
  const plannedFilter = String(params.planned ?? "").trim();
  const archiveFilter = ["all", "archive"].includes(String(params.archive))
    ? String(params.archive)
    : "active";
  const sortMode = String(params.sort ?? "newest");
  const editFormId = String(params.editForm ?? "").trim();

  const [vehicles, repairOrders, workshopTemplates, workshopSubmissions, employees] = await Promise.all([
    prisma.vehicle.findMany({
      where: {
        isActive: true,
      },
      orderBy: [{ vehicleNumber: "asc" }],
      select: {
        id: true,
        licensePlate: true,
        vehicleNumber: true,
        vehicleType: true,
      },
    }),
    prisma.workshopRepairOrder.findMany({
      orderBy: [{ reportedAt: "desc" }, { createdAt: "desc" }],
    }),
    prisma.workshopFormTemplate.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.workshopFormSubmission.findMany({
      include: { template: true, vehicle: true },
      orderBy: [{ formDate: "desc" }, { createdAt: "desc" }],
      take: 50,
    }),
    prisma.employee.findMany({
      where: { statusValue: "active" },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { firstName: true, id: true, lastName: true },
    }),
  ]);

  const normalizedQuery = normalizeSearchText(q);
  const personnelOptions = employees.map((employee) => ({
    id: employee.id,
    name: `${employee.firstName} ${employee.lastName}`,
  }));
  const repairTemplate =
    workshopTemplates.find(
      (template) => template.id === WORKSHOP_REPAIR_TEMPLATE_ID,
    ) ?? null;
  const repairTemplateFields = parseProjectFormFields(
    repairTemplate?.fieldsJson,
  );
  const assignedOptions = Array.from(
    new Set(
      repairOrders
        .map((order) => order.assignedTo?.trim())
        .concat(
          workshopSubmissions.map((submission) =>
            submission.createdByName?.trim(),
          ),
        )
        .filter((value): value is string => Boolean(value)),
    ),
  ).sort((a, b) => a.localeCompare(b, "de-DE"));
  const filteredOrders = repairOrders.filter((order) => {
    const archived = order.status === "DONE" || order.status === "CANCELLED";
    if (archiveFilter === "active" && archived) return false;
    if (archiveFilter === "archive" && !archived) return false;
    if (statusFilter && order.status !== statusFilter) return false;
    if (priorityFilter && order.priority !== priorityFilter) return false;
    if (assignedFilter && order.assignedTo !== assignedFilter) return false;
    if (plannedFilter === "planned" && !order.plannedStart && !order.plannedEnd) return false;
    if (plannedFilter === "unplanned" && (order.plannedStart || order.plannedEnd)) return false;

    if (!normalizedQuery) return true;

    return normalizeSearchText(
      [
        order.title,
        order.description,
        order.assignedTo,
        order.notes,
        order.vehicleNumber,
        order.licensePlate,
        order.vehicleType,
      ].join(" "),
    ).includes(normalizedQuery);
  });
  const filteredFormSubmissions = workshopSubmissions.filter((submission) => {
    if (archiveFilter === "archive") return false;
    if (statusFilter) return false;
    if (priorityFilter && submission.priority !== priorityFilter) return false;
    if (assignedFilter && submission.createdByName !== assignedFilter) return false;
    if (plannedFilter === "unplanned" && submission.formDate) return false;
    if (plannedFilter === "planned" && !submission.formDate) return false;
    if (!normalizedQuery) return true;

    return normalizeSearchText(
      [
        submission.title,
        submission.template?.name,
        submission.createdByName,
        submission.vehicle?.vehicleNumber,
        submission.vehicle?.licensePlate,
        submission.vehicle?.vehicleType,
      ].join(" "),
    ).includes(normalizedQuery);
  });
  const combinedOrders = [
    ...filteredOrders.map((order) => ({
      assignedTo: order.assignedTo,
      createdAt: order.createdAt,
      item: order,
      plannedEnd: order.plannedEnd,
      plannedStart: order.plannedStart,
      priority: order.priority,
      reportedAt: order.reportedAt,
      status: order.status,
      type: "REPAIR" as const,
    })),
    ...filteredFormSubmissions.map((submission) => ({
      assignedTo: submission.createdByName,
      createdAt: submission.createdAt,
      item: submission,
      plannedEnd: submission.formDate,
      plannedStart: submission.formDate,
      priority: submission.priority,
      reportedAt: submission.formDate ?? submission.createdAt,
      status: "FORM",
      type: "FORM" as const,
    })),
  ].sort((a, b) => compareRepairOrders(a, b, sortMode));

  const openCount = repairOrders.filter((order) => order.status === "OPEN").length;
  const activeCount =
    repairOrders.filter((order) =>
      ["OPEN", "IN_PROGRESS", "WAITING"].includes(order.status),
    ).length + workshopSubmissions.length;
  const urgentCount =
    repairOrders.filter(
      (order) => order.priority === "URGENT" && order.status !== "DONE",
    ).length +
    workshopSubmissions.filter((submission) => submission.priority === "URGENT")
      .length;
  const archiveCount = repairOrders.filter((order) =>
    ["DONE", "CANCELLED"].includes(order.status),
  ).length;
  const workshopFormCenter = (
    <WorkshopFormCenter
      key={editFormId || "new-workshop-form"}
      initialEditingId={editFormId || undefined}
      personnel={personnelOptions}
      repairOrderDescription={
        repairTemplate?.description ??
        "Reparatur, Wartung oder Störung erfassen und einplanen."
      }
      repairOrderForm={
        <WorkshopOrderForm
          action={createWorkshopRepairOrder}
          defaultCustomValues={{}}
          personnel={personnelOptions}
          repairTemplateFields={repairTemplateFields}
          vehicles={vehicles}
        />
      }
      repairOrderTitle={repairTemplate?.name ?? "Reparaturauftrag"}
      vehicles={vehicles}
      templates={[
        ...BUILT_IN_WORKSHOP_FORMS,
        ...workshopTemplates
          .filter((template) => template.id !== WORKSHOP_REPAIR_TEMPLATE_ID)
          .map((template) => ({
          category: template.category,
          description: template.description,
          fields: parseProjectFormFields(template.fieldsJson),
          id: template.id,
          kind: "CUSTOM" as const,
          name: template.name,
          paperOrientation:
            template.paperOrientation === "LANDSCAPE"
              ? ("LANDSCAPE" as const)
              : ("PORTRAIT" as const),
          paperSize: template.paperSize === "A5" ? ("A5" as const) : ("A4" as const),
          })),
      ]}
      submissions={workshopSubmissions.map((submission) => {
        const kind = submission.templateKind as WorkshopFormKind;
        const builtIn = BUILT_IN_WORKSHOP_FORMS.find((item) => item.kind === kind);
        return {
          createdByName: submission.createdByName,
          fields: parseWorkshopSnapshotFields(
            submission.templateSnapshotJson,
            submission.template?.fieldsJson,
          ),
          formDate: formatDateInput(submission.formDate),
          id: submission.id,
          priority: submission.priority,
          templateId: submission.templateId ?? builtIn?.id ?? "",
          templateKind: kind,
          templateName: submission.template?.name ?? builtIn?.name ?? "Werkstattformular",
          title: submission.title,
          values: parseWorkshopFormValues(submission.valuesJson),
          vehicleId: submission.vehicleId ?? "",
        };
      })}
    />
  );

  return (
    <AppShell
      title="Werkstatt"
      description="Reparaturaufträge und Werkstattvorgänge für Geräte, Fahrzeuge und Sonderfahrzeuge verwalten."
    >
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <SummaryCard label="Aktive Aufträge" value={String(activeCount)} />
        <SummaryCard label="Offen" value={String(openCount)} />
        <SummaryCard label="Dringend" value={String(urgentCount)} />
        <SummaryCard label="Archiv" value={String(archiveCount)} />
      </div>

      {workshopFormCenter}

      <details className="mb-6 rounded-2xl border border-gray-200 bg-white shadow-sm">
        <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-gray-900 marker:content-none">
          Filter und Sortierung
          <span className="ml-2 text-xs font-normal text-gray-500">
            Suche, Archiv, Priorität, Zuständigkeit und Planung
          </span>
        </summary>
        <form
          action="/workshop"
          className="grid grid-cols-1 gap-3 border-t border-gray-200 p-5 md:grid-cols-4 xl:grid-cols-6"
        >
        <label className="text-sm font-medium text-gray-800 md:col-span-2 xl:col-span-2">
          Suche
          <input
            name="q"
            defaultValue={q}
            placeholder="Gerät, Kennzeichen, Auftrag, Zuständig..."
            className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
          />
        </label>

        <label className="text-sm font-medium text-gray-800">
          Ansicht
          <select
            name="archive"
            defaultValue={archiveFilter}
            className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          >
            <option value="active">Aktive Aufträge</option>
            <option value="archive">Archiv</option>
            <option value="all">Alle Aufträge</option>
          </select>
        </label>

        <label className="text-sm font-medium text-gray-800">
          Status
          <select
            name="status"
            defaultValue={statusFilter}
            className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          >
            <option value="">Alle Status</option>
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium text-gray-800">
          Priorität
          <select
            name="priority"
            defaultValue={priorityFilter}
            className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          >
            <option value="">Alle Prioritäten</option>
            {priorityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium text-gray-800">
          Zuständig
          <select
            name="assigned"
            defaultValue={assignedFilter}
            className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          >
            <option value="">Alle Zuständigen</option>
            {assignedOptions.map((assigned) => (
              <option key={assigned} value={assigned}>
                {assigned}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium text-gray-800">
          Planung
          <select
            name="planned"
            defaultValue={plannedFilter}
            className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          >
            <option value="">Alle</option>
            <option value="planned">Nur geplante</option>
            <option value="unplanned">Nur ungeplante</option>
          </select>
        </label>

        <label className="text-sm font-medium text-gray-800">
          Sortierung
          <select
            name="sort"
            defaultValue={sortMode}
            className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          >
            <option value="newest">Neueste zuerst</option>
            <option value="oldest">Älteste zuerst</option>
            <option value="priority-desc">Dringend zuerst</option>
            <option value="priority-asc">Nicht dringend zuerst</option>
            <option value="assigned">Nach Zuständigkeit</option>
            <option value="planned-start">Nach geplantem Beginn</option>
            <option value="planned-end">Nach geplantem Ende</option>
            <option value="status">Nach Status</option>
          </select>
        </label>

        <div className="flex flex-wrap items-end gap-3 md:col-span-4 xl:col-span-6">
          <button
            type="submit"
            className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
          >
            Filter anwenden
          </button>
          <Link
            href="/workshop"
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          >
            Filter zurücksetzen
          </Link>
        </div>
        </form>
      </details>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 bg-gray-50 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {archiveFilter === "archive" ? "Archivierte Werkstattaufträge" : "Werkstattaufträge"}
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            {combinedOrders.length} von{" "}
            {repairOrders.length + workshopSubmissions.length} Aufträgen sichtbar
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="bg-gray-50 text-gray-800">
              <tr>
                <th className="w-[92px] p-3 font-semibold">Aktion</th>
                <th className="p-3 font-semibold">Auftrag</th>
                <th className="p-3 font-semibold">Gerät/Fahrzeug</th>
                <th className="p-3 font-semibold">Status</th>
                <th className="p-3 font-semibold">Priorität</th>
                <th className="p-3 font-semibold">Gemeldet</th>
                <th className="p-3 font-semibold">Geplant</th>
                <th className="p-3 font-semibold">Zuständig</th>
              </tr>
            </thead>

            <tbody>
              {combinedOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500">
                    Keine Werkstattaufträge gefunden.
                  </td>
                </tr>
              ) : (
                combinedOrders.map((row) =>
                  row.type === "REPAIR" ? (
                  <tr
                    key={`repair-${row.item.id}`}
                    className={
                      row.item.status === "DONE"
                        ? "border-t border-green-100 bg-green-50/70"
                        : "border-t border-gray-100"
                    }
                  >
                    <td className="p-3 align-top">
                      <div className="flex gap-2">
                        <WorkshopEditDialog orderTitle={row.item.title}>
                          <WorkshopOrderForm
                            action={updateWorkshopRepairOrder}
                            id={row.item.id}
                            personnel={personnelOptions}
                            repairTemplateFields={repairTemplateFields}
                            vehicles={vehicles}
                            defaultAssignedTo={row.item.assignedTo ?? ""}
                            defaultCompletedAt={formatDateInput(row.item.completedAt)}
                            defaultCustomValues={parseRepairCustomValues(
                              row.item.customValuesJson,
                            )}
                            defaultDescription={row.item.description ?? ""}
                            defaultNotes={row.item.notes ?? ""}
                            defaultPlannedEnd={formatDateInput(row.item.plannedEnd)}
                            defaultPlannedStart={formatDateInput(row.item.plannedStart)}
                            defaultPriority={row.item.priority}
                            defaultReportedAt={formatDateInput(row.item.reportedAt)}
                            defaultStatus={row.item.status}
                            defaultTitle={row.item.title}
                            defaultVehicleId={row.item.vehicleId ?? ""}
                          />
                        </WorkshopEditDialog>

                        <a
                          href={`/workshop/repair-orders/${row.item.id}/pdf`}
                          title="Auftrag als PDF herunterladen"
                          aria-label="Auftrag als PDF herunterladen"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                        >
                          <ActionIcon name="download" className="h-4 w-4" />
                        </a>

                        <form action={deleteWorkshopRepairOrder}>
                          <input type="hidden" name="id" value={row.item.id} />
                          <button
                            type="submit"
                            title="Auftrag löschen"
                            aria-label="Auftrag löschen"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-50"
                          >
                            <ActionIcon name="delete" className="h-4 w-4" />
                          </button>
                        </form>
                      </div>
                    </td>
                    <td className="p-3 align-top">
                      <div
                        className={
                          row.item.status === "DONE"
                            ? "font-semibold text-gray-700"
                            : "font-semibold text-gray-900"
                        }
                      >
                        {row.item.title}
                      </div>
                      {row.item.description ? (
                        <div
                          className={
                            row.item.status === "DONE"
                              ? "mt-1 line-clamp-2 text-gray-500"
                              : "mt-1 line-clamp-2 text-gray-600"
                          }
                        >
                          {row.item.description}
                        </div>
                      ) : null}
                    </td>
                    <td className="p-3 align-top text-gray-700">
                      {getVehicleLabel(row.item) || "-"}
                    </td>
                    <td className="p-3 align-top">
                      <div className="flex flex-col items-start gap-1">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${getStatusClass(
                            row.item.status,
                          )}`}
                        >
                          {getStatusLabel(row.item.status)}
                        </span>
                        <span
                          className={
                            row.item.status === "DONE"
                              ? "text-xs font-semibold text-green-800"
                              : "text-xs text-gray-500"
                          }
                        >
                          {row.item.status === "DONE"
                            ? `Erledigt am ${formatDate(row.item.completedAt)}`
                            : row.item.status === "CANCELLED"
                              ? "Abgebrochen"
                              : "Noch nicht erledigt"}
                        </span>
                      </div>
                    </td>
                    <td className="p-3 align-top">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${getPriorityClass(
                          row.item.priority,
                        )}`}
                      >
                        {getPriorityLabel(row.item.priority)}
                      </span>
                    </td>
                    <td className="p-3 align-top text-gray-700">
                      {formatDate(row.item.reportedAt)}
                    </td>
                    <td className="p-3 align-top text-gray-700">
                      {formatDate(row.item.plannedStart)} -{" "}
                      {formatDate(row.item.plannedEnd)}
                    </td>
                    <td className="p-3 align-top text-gray-700">
                      {row.item.assignedTo ?? "-"}
                    </td>
                  </tr>
                  ) : (
                    <tr
                      key={`form-${row.item.id}`}
                      className="border-t border-blue-100 bg-blue-50/40"
                    >
                      <td className="p-3 align-top">
                        <div className="flex gap-2">
                          <Link
                            href={`/workshop?editForm=${row.item.id}`}
                            title="Formular bearbeiten"
                            aria-label="Formular bearbeiten"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                          >
                            <ActionIcon name="edit" className="h-4 w-4" />
                          </Link>
                          <a
                            href={`/workshop/forms/${row.item.id}/pdf`}
                            target="_blank"
                            title="Formular als PDF öffnen"
                            aria-label="Formular als PDF öffnen"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                          >
                            <ActionIcon name="download" className="h-4 w-4" />
                          </a>
                          <form action={deleteWorkshopFormSubmission.bind(null, row.item.id)}>
                            <button
                              type="submit"
                              title="Formular löschen"
                              aria-label="Formular löschen"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-50"
                            >
                              <ActionIcon name="delete" className="h-4 w-4" />
                            </button>
                          </form>
                        </div>
                      </td>
                      <td className="p-3 align-top">
                        <div className="font-semibold text-gray-900">{row.item.title}</div>
                        <div className="mt-1 text-xs font-medium text-blue-800">
                          {row.item.template?.name ??
                            BUILT_IN_WORKSHOP_FORMS.find(
                              (template) => template.kind === row.item.templateKind,
                            )?.name ??
                            "Werkstattformular"}
                        </div>
                      </td>
                      <td className="p-3 align-top text-gray-700">
                        {row.item.vehicle ? getVehicleLabel(row.item.vehicle) : "-"}
                      </td>
                      <td className="p-3 align-top">
                        <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-900">
                          Ausgefülltes Formular
                        </span>
                      </td>
                      <td className="p-3 align-top">
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${getPriorityClass(row.item.priority)}`}>
                          {getPriorityLabel(row.item.priority)}
                        </span>
                      </td>
                      <td className="p-3 align-top text-gray-700">
                        {formatDate(row.item.formDate ?? row.item.createdAt)}
                      </td>
                      <td className="p-3 align-top text-gray-700">
                        {formatDate(row.item.formDate)}
                      </td>
                      <td className="p-3 align-top text-gray-700">
                        {row.item.createdByName ?? "-"}
                      </td>
                    </tr>
                  ),
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}

function WorkshopOrderForm({
  action,
  id,
  personnel,
  repairTemplateFields,
  vehicles,
  defaultAssignedTo = "",
  defaultCompletedAt = "",
  defaultCustomValues,
  defaultDescription = "",
  defaultNotes = "",
  defaultPlannedEnd = "",
  defaultPlannedStart = "",
  defaultPriority = "NORMAL",
  defaultReportedAt = formatDateInput(new Date()),
  defaultStatus = "OPEN",
  defaultTitle = "",
  defaultVehicleId = "",
}: {
  action: (formData: FormData) => void | Promise<void>;
  id?: string;
  personnel: { id: string; name: string }[];
  repairTemplateFields: ProjectFormFieldDefinition[];
  vehicles: {
    id: string;
    licensePlate: string | null;
    vehicleNumber: string;
    vehicleType: string;
  }[];
  defaultAssignedTo?: string;
  defaultCompletedAt?: string;
  defaultCustomValues: Record<string, boolean | string>;
  defaultDescription?: string;
  defaultNotes?: string;
  defaultPlannedEnd?: string;
  defaultPlannedStart?: string;
  defaultPriority?: string;
  defaultReportedAt?: string;
  defaultStatus?: string;
  defaultTitle?: string;
  defaultVehicleId?: string;
}) {
  const templateFields =
    repairTemplateFields.length > 0
      ? repairTemplateFields
      : [];
  const layout = (id: string, fallbackWidth: number) => {
    const index = templateFields.findIndex((field) => field.id === id);
    const field = index >= 0 ? templateFields[index] : null;
    return {
      field,
      style: {
        gridColumn: `span ${field?.width ?? fallbackWidth}`,
        order: index >= 0 ? index : 100,
      },
    };
  };
  const vehicleLayout = layout("vehicleId", 3);
  const statusLayout = layout("status", 2);
  const priorityLayout = layout("priority", 1);
  const titleLayout = layout("title", 6);
  const descriptionLayout = layout("description", 6);
  const reportedLayout = layout("reportedAt", 2);
  const plannedStartLayout = layout("plannedStart", 2);
  const plannedEndLayout = layout("plannedEnd", 2);
  const assignedLayout = layout("assignedTo", 3);
  const notesLayout = layout("notes", 3);
  const customFields = templateFields.filter(
    (field) => !WORKSHOP_REPAIR_SYSTEM_FIELD_IDS.has(field.id),
  );

  return (
    <form
      action={action}
      className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6"
    >
      {id ? <input type="hidden" name="id" value={id} /> : null}

      <label className="text-sm font-medium text-gray-800" style={vehicleLayout.style}>
        {vehicleLayout.field?.label ?? "Gerät / Fahrzeug"}
        <select
          name="vehicleId"
          required={vehicleLayout.field?.required}
          defaultValue={defaultVehicleId}
          className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
        >
          <option value="">Ohne Zuordnung</option>
          {vehicles.map((vehicle) => (
            <option key={vehicle.id} value={vehicle.id}>
              {getVehicleLabel(vehicle)}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-4" style={statusLayout.style}>
        <WorkshopStatusFields
          defaultCompletedAt={defaultCompletedAt}
          defaultStatus={defaultStatus}
          statusLabel={statusLayout.field?.label}
        />
      </div>

      <label className="text-sm font-medium text-gray-800" style={priorityLayout.style}>
        {priorityLayout.field?.label ?? "Priorität"}
        <select
          name="priority"
          required={priorityLayout.field?.required}
          defaultValue={defaultPriority}
          className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
        >
          {priorityOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm font-medium text-gray-800" style={titleLayout.style}>
        {titleLayout.field?.label ?? "Titel"}
        <input
          name="title"
          required={titleLayout.field?.required ?? true}
          defaultValue={defaultTitle}
          placeholder="z.B. Hydraulikschlauch undicht, Service fällig..."
          className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
        />
      </label>

      <label className="text-sm font-medium text-gray-800" style={descriptionLayout.style}>
        {descriptionLayout.field?.label ?? "Beschreibung"}
        <textarea
          name="description"
          required={descriptionLayout.field?.required}
          defaultValue={defaultDescription}
          rows={3}
          className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
        />
      </label>

      <label className="text-sm font-medium text-gray-800" style={reportedLayout.style}>
        {reportedLayout.field?.label ?? "Gemeldet am"}
        <input
          type="date"
          name="reportedAt"
          required={reportedLayout.field?.required}
          defaultValue={defaultReportedAt}
          className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
        />
      </label>

      <label className="text-sm font-medium text-gray-800" style={plannedStartLayout.style}>
        {plannedStartLayout.field?.label ?? "Geplant von"}
        <input
          type="date"
          name="plannedStart"
          required={plannedStartLayout.field?.required}
          defaultValue={defaultPlannedStart}
          className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
        />
      </label>

      <label className="text-sm font-medium text-gray-800" style={plannedEndLayout.style}>
        {plannedEndLayout.field?.label ?? "Geplant bis"}
        <input
          type="date"
          name="plannedEnd"
          required={plannedEndLayout.field?.required}
          defaultValue={defaultPlannedEnd}
          className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
        />
      </label>

      <label className="text-sm font-medium text-gray-800" style={assignedLayout.style}>
        {assignedLayout.field?.label ?? "Zuständig"}
        <input
          list={`workshop-personnel-${id ?? "new"}`}
          name="assignedTo"
          required={assignedLayout.field?.required}
          defaultValue={defaultAssignedTo}
          placeholder="Werkstatt, Mitarbeiter, extern..."
          className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
        />
        <datalist id={`workshop-personnel-${id ?? "new"}`}>
          {personnel.map((person) => (
            <option key={person.id} value={person.name} />
          ))}
        </datalist>
      </label>

      <label className="text-sm font-medium text-gray-800" style={notesLayout.style}>
        {notesLayout.field?.label ?? "Bemerkung"}
        <input
          name="notes"
          required={notesLayout.field?.required}
          defaultValue={defaultNotes}
          className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
        />
      </label>

      {customFields.map((field) => (
        <RepairCustomField
          field={field}
          key={field.id}
          value={defaultCustomValues[field.id]}
          order={templateFields.findIndex((item) => item.id === field.id)}
        />
      ))}

      <div className="flex items-end xl:col-span-6" style={{ order: 1000 }}>
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-700"
        >
          <ActionIcon name="save" className="h-4 w-4" />
          Speichern
        </button>
      </div>
    </form>
  );
}

function RepairCustomField({
  field,
  order,
  value,
}: {
  field: ProjectFormFieldDefinition;
  order: number;
  value: boolean | string | undefined;
}) {
  const style = {
    gridColumn: `span ${field.width}`,
    order,
  };
  const className =
    "mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900";

  if (field.type === "divider" || field.type === "companydata") {
    return (
      <div className="border-b border-gray-300 pb-2 font-semibold text-gray-900" style={style}>
        {field.label}
      </div>
    );
  }

  if (field.type === "checkbox") {
    return (
      <label className="flex items-center gap-3 pt-7 text-sm font-medium text-gray-800" style={style}>
        <input
          type="checkbox"
          name={`custom:${field.id}`}
          defaultChecked={value === true}
          className="h-5 w-5"
        />
        {field.label}
      </label>
    );
  }

  if (
    field.type === "select" ||
    field.type === "masterdata" ||
    field.type === "trafficlight" ||
    field.type === "grade"
  ) {
    const options =
      field.options.length > 0
        ? field.options
        : getProjectFormPresetOptions(field.type);
    return (
      <label className="text-sm font-medium text-gray-800" style={style}>
        {field.label}
        <select
          name={`custom:${field.id}`}
          defaultValue={String(value ?? "")}
          required={field.required}
          className={className}
        >
          <option value="">Bitte auswählen</option>
          {options.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </label>
    );
  }

  if (
    field.type === "textarea" ||
    field.type === "chart" ||
    field.type === "subform"
  ) {
    return (
      <label className="text-sm font-medium text-gray-800" style={style}>
        {field.label}
        <textarea
          name={`custom:${field.id}`}
          defaultValue={String(value ?? "")}
          required={field.required}
          rows={3}
          className={className}
        />
      </label>
    );
  }

  const inputType = ["date", "time", "number"].includes(field.type)
    ? field.type
    : "text";
  return (
    <label className="text-sm font-medium text-gray-800" style={style}>
      {field.label}
      <input
        type={inputType}
        name={`custom:${field.id}`}
        defaultValue={String(value ?? "")}
        required={field.required}
        className={className}
      />
    </label>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-medium text-gray-500">{label}</div>
      <div className="mt-2 text-2xl font-bold text-gray-900">{value}</div>
    </div>
  );
}
