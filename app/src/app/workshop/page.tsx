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
import { WorkshopFormCenter } from "./WorkshopFormCenter";
import { WorkshopOrderForm } from "./WorkshopOrderForm";
import { deleteWorkshopFormSubmission } from "./form-actions";
import {
  BUILT_IN_WORKSHOP_FORMS,
  parseWorkshopFormValues,
  parseWorkshopSnapshotFields,
  type WorkshopFormKind,
} from "./workshopFormTypes";
import {
  parseProjectFormFields,
} from "@/app/projects/projectFormTypes";
import {
  ensureWorkshopRepairOrderTemplate,
  WORKSHOP_REPAIR_TEMPLATE_ID,
} from "./repairOrderTemplate";

const statusOptions = [
  { label: "Offen", value: "OPEN" },
  { label: "In Arbeit", value: "IN_PROGRESS" },
  { label: "Wartet", value: "WAITING" },
  { label: "Defekt", value: "DEFECT" },
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

function formatDateTimeInput(date: Date | null | undefined) {
  if (!date) return "";

  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function formatDate(date: Date | null | undefined) {
  if (!date) return "-";

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatDateTime(date: Date | null | undefined) {
  if (!date) return "-";

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
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
  if (value === "DONE") return "bg-gray-100 text-gray-700";
  if (value === "IN_PROGRESS") return "bg-blue-100 text-blue-900";
  if (value === "WAITING") return "bg-amber-100 text-amber-950";
  if (value === "DEFECT") return "bg-red-100 text-red-900";
  if (value === "CANCELLED") return "bg-gray-200 text-gray-700";
  return "bg-red-100 text-red-900";
}

function getWorkshopSubmissionStatus(completedAt: Date | null) {
  return completedAt ? "DONE" : "DEFECT";
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

function getWorkshopObjectLabel(order: {
  inventoryItem?: {
    inventoryNumber: string | null;
    name: string;
  } | null;
  licensePlate: string | null;
  vehicleNumber: string | null;
  vehicleType: string | null;
}) {
  if (order.inventoryItem) {
    return [order.inventoryItem.inventoryNumber, order.inventoryItem.name]
      .filter(Boolean)
      .join(" · ");
  }

  return getVehicleLabel(order);
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
      include: {
        inventoryItem: true,
      },
      orderBy: [{ reportedAt: "desc" }, { createdAt: "desc" }],
    }),
    prisma.workshopFormTemplate.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.workshopFormSubmission.findMany({
      include: { inventoryItem: true, template: true, vehicle: true },
      orderBy: [{ formDate: "desc" }, { createdAt: "desc" }],
      take: 50,
    }),
    prisma.employee.findMany({
      where: {
        departmentValue: "werkstatt",
        statusValue: "active",
      },
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
        order.inventoryItem?.inventoryNumber,
        order.inventoryItem?.name,
      ].join(" "),
    ).includes(normalizedQuery);
  });
  const filteredFormSubmissions = workshopSubmissions.filter((submission) => {
    const submissionStatus = getWorkshopSubmissionStatus(submission.completedAt);
    const archived = submissionStatus === "DONE";
    if (archiveFilter === "active" && archived) return false;
    if (archiveFilter === "archive" && !archived) return false;
    if (statusFilter && submissionStatus !== statusFilter) return false;
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
        submission.inventoryItem?.inventoryNumber,
        submission.inventoryItem?.name,
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
      completedAt: submission.completedAt,
      createdAt: submission.createdAt,
      item: submission,
      plannedEnd: submission.formDate,
      plannedStart: submission.formDate,
      priority: submission.priority,
      reportedAt: submission.createdAt,
      status: getWorkshopSubmissionStatus(submission.completedAt),
      type: "FORM" as const,
    })),
  ].sort((a, b) => compareRepairOrders(a, b, sortMode));

  const openCount = repairOrders.filter((order) => order.status === "OPEN").length;
  const activeCount =
    repairOrders.filter((order) =>
      ["OPEN", "IN_PROGRESS", "WAITING"].includes(order.status),
    ).length +
    workshopSubmissions.filter((submission) => !submission.completedAt).length;
  const urgentCount =
    repairOrders.filter(
      (order) => order.priority === "URGENT" && order.status !== "DONE",
    ).length +
    workshopSubmissions.filter(
      (submission) => submission.priority === "URGENT" && !submission.completedAt,
    ).length;
  const archiveCount =
    repairOrders.filter((order) =>
      ["DONE", "CANCELLED"].includes(order.status),
    ).length +
    workshopSubmissions.filter((submission) => submission.completedAt).length;
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
          completedAt: formatDateInput(submission.completedAt),
          completedByName: submission.completedByName,
          fields: parseWorkshopSnapshotFields(
            submission.templateSnapshotJson,
            submission.template?.fieldsJson,
          ),
          formDate: formatDateInput(submission.formDate),
          id: submission.id,
          inventoryItemId: submission.inventoryItemId ?? "",
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
                <th className="p-3 font-semibold">Inventar/Gerät</th>
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
                    className="border-t border-gray-100"
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
                            defaultCompletedByName={row.item.completedByName ?? ""}
                            defaultCustomValues={parseRepairCustomValues(
                              row.item.customValuesJson,
                            )}
                            defaultDescription={row.item.description ?? ""}
                            defaultInventoryItemId={row.item.inventoryItemId ?? ""}
                            defaultNotes={row.item.notes ?? ""}
                            defaultPlannedEnd={formatDateInput(row.item.plannedEnd)}
                            defaultPlannedStart={formatDateInput(row.item.plannedStart)}
                            defaultPriority={row.item.priority}
                            defaultReportedAt={formatDateTimeInput(row.item.reportedAt)}
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
                        className="font-semibold text-gray-900"
                      >
                        {row.item.title}
                      </div>
                      {row.item.description ? (
                        <div
                          className="mt-1 line-clamp-2 text-gray-600"
                        >
                          {row.item.description}
                        </div>
                      ) : null}
                    </td>
                    <td className="p-3 align-top text-gray-700">
                      {getWorkshopObjectLabel(row.item) || "-"}
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
                          className="text-xs text-gray-500"
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
                      {formatDateTime(row.item.reportedAt)}
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
                      className="border-t border-gray-100"
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
                        {row.item.inventoryItem
                          ? [
                              row.item.inventoryItem.inventoryNumber,
                              row.item.inventoryItem.name,
                            ]
                              .filter(Boolean)
                              .join(" · ")
                          : row.item.vehicle
                            ? getVehicleLabel(row.item.vehicle)
                            : "-"}
                      </td>
                      <td className="p-3 align-top">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${getStatusClass(
                            row.status,
                          )}`}
                        >
                          {getStatusLabel(row.status)}
                        </span>
                        {row.item.completedAt ? (
                          <span className="mt-1 block text-xs text-gray-500">
                            {formatDate(row.item.completedAt)}
                            {row.item.completedByName
                              ? ` · ${row.item.completedByName}`
                              : ""}
                          </span>
                        ) : null}
                      </td>
                      <td className="p-3 align-top">
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${getPriorityClass(row.item.priority)}`}>
                          {getPriorityLabel(row.item.priority)}
                        </span>
                      </td>
                      <td className="p-3 align-top text-gray-700">
                        {formatDateTime(row.reportedAt)}
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

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-medium text-gray-500">{label}</div>
      <div className="mt-2 text-2xl font-bold text-gray-900">{value}</div>
    </div>
  );
}
