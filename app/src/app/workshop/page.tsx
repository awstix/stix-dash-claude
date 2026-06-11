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

export default async function WorkshopPage({
  searchParams,
}: {
  searchParams: Promise<{
    priority?: string;
    q?: string;
    status?: string;
  }>;
}) {
  const params = await searchParams;
  const q = String(params.q ?? "").trim();
  const statusFilter = String(params.status ?? "").trim();
  const priorityFilter = String(params.priority ?? "").trim();

  const [vehicles, repairOrders] = await Promise.all([
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
  ]);

  const normalizedQuery = normalizeSearchText(q);
  const filteredOrders = repairOrders.filter((order) => {
    if (statusFilter && order.status !== statusFilter) return false;
    if (priorityFilter && order.priority !== priorityFilter) return false;

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

  const openCount = repairOrders.filter((order) => order.status === "OPEN").length;
  const activeCount = repairOrders.filter((order) =>
    ["OPEN", "IN_PROGRESS", "WAITING"].includes(order.status),
  ).length;
  const urgentCount = repairOrders.filter(
    (order) => order.priority === "URGENT" && order.status !== "DONE",
  ).length;
  const doneCount = repairOrders.filter((order) => order.status === "DONE").length;

  return (
    <AppShell
      title="Werkstatt"
      description="Reparaturaufträge und Werkstattvorgänge für Geräte, Fahrzeuge und Sonderfahrzeuge verwalten."
    >
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <SummaryCard label="Aktive Aufträge" value={String(activeCount)} />
        <SummaryCard label="Offen" value={String(openCount)} />
        <SummaryCard label="Dringend" value={String(urgentCount)} />
        <SummaryCard label="Erledigt" value={String(doneCount)} />
      </div>

      <details className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <summary className="cursor-pointer text-xl font-semibold text-gray-900">
          + Reparaturauftrag erstellen
        </summary>

        <WorkshopOrderForm
          action={createWorkshopRepairOrder}
          vehicles={vehicles}
        />
      </details>

      <form
        action="/workshop"
        className="mb-6 grid grid-cols-1 gap-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm md:grid-cols-4"
      >
        <label className="text-sm font-medium text-gray-800 md:col-span-2">
          Suche
          <input
            name="q"
            defaultValue={q}
            placeholder="Gerät, Kennzeichen, Auftrag, Zuständig..."
            className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
          />
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

        <div className="flex flex-wrap items-end gap-3 md:col-span-4">
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

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 bg-gray-50 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Reparaturaufträge
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            {filteredOrders.length} von {repairOrders.length} Aufträgen sichtbar
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
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500">
                    Keine Reparaturaufträge gefunden.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr
                    key={order.id}
                    className={
                      order.status === "DONE"
                        ? "border-t border-green-100 bg-green-50/70"
                        : "border-t border-gray-100"
                    }
                  >
                    <td className="p-3 align-top">
                      <div className="flex gap-2">
                        <WorkshopEditDialog orderTitle={order.title}>
                          <WorkshopOrderForm
                            action={updateWorkshopRepairOrder}
                            id={order.id}
                            vehicles={vehicles}
                            defaultAssignedTo={order.assignedTo ?? ""}
                            defaultCompletedAt={formatDateInput(order.completedAt)}
                            defaultDescription={order.description ?? ""}
                            defaultNotes={order.notes ?? ""}
                            defaultPlannedEnd={formatDateInput(order.plannedEnd)}
                            defaultPlannedStart={formatDateInput(order.plannedStart)}
                            defaultPriority={order.priority}
                            defaultReportedAt={formatDateInput(order.reportedAt)}
                            defaultStatus={order.status}
                            defaultTitle={order.title}
                            defaultVehicleId={order.vehicleId ?? ""}
                          />
                        </WorkshopEditDialog>

                        <form action={deleteWorkshopRepairOrder}>
                          <input type="hidden" name="id" value={order.id} />
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
                          order.status === "DONE"
                            ? "font-semibold text-gray-700"
                            : "font-semibold text-gray-900"
                        }
                      >
                        {order.title}
                      </div>
                      {order.description ? (
                        <div
                          className={
                            order.status === "DONE"
                              ? "mt-1 line-clamp-2 text-gray-500"
                              : "mt-1 line-clamp-2 text-gray-600"
                          }
                        >
                          {order.description}
                        </div>
                      ) : null}
                    </td>
                    <td className="p-3 align-top text-gray-700">
                      {getVehicleLabel(order) || "-"}
                    </td>
                    <td className="p-3 align-top">
                      <div className="flex flex-col items-start gap-1">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${getStatusClass(
                            order.status,
                          )}`}
                        >
                          {getStatusLabel(order.status)}
                        </span>
                        <span
                          className={
                            order.status === "DONE"
                              ? "text-xs font-semibold text-green-800"
                              : "text-xs text-gray-500"
                          }
                        >
                          {order.status === "DONE"
                            ? `Erledigt am ${formatDate(order.completedAt)}`
                            : order.status === "CANCELLED"
                              ? "Abgebrochen"
                              : "Noch nicht erledigt"}
                        </span>
                      </div>
                    </td>
                    <td className="p-3 align-top">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${getPriorityClass(
                          order.priority,
                        )}`}
                      >
                        {getPriorityLabel(order.priority)}
                      </span>
                    </td>
                    <td className="p-3 align-top text-gray-700">
                      {formatDate(order.reportedAt)}
                    </td>
                    <td className="p-3 align-top text-gray-700">
                      {formatDate(order.plannedStart)} -{" "}
                      {formatDate(order.plannedEnd)}
                    </td>
                    <td className="p-3 align-top text-gray-700">
                      {order.assignedTo ?? "-"}
                    </td>
                  </tr>
                ))
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
  vehicles,
  defaultAssignedTo = "",
  defaultCompletedAt = "",
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
  vehicles: {
    id: string;
    licensePlate: string | null;
    vehicleNumber: string;
    vehicleType: string;
  }[];
  defaultAssignedTo?: string;
  defaultCompletedAt?: string;
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
  return (
    <form
      action={action}
      className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"
    >
      {id ? <input type="hidden" name="id" value={id} /> : null}

      <label className="text-sm font-medium text-gray-800 xl:col-span-2">
        Gerät / Fahrzeug
        <select
          name="vehicleId"
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

      <WorkshopStatusFields
        defaultCompletedAt={defaultCompletedAt}
        defaultStatus={defaultStatus}
      />

      <label className="text-sm font-medium text-gray-800">
        Priorität
        <select
          name="priority"
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

      <label className="text-sm font-medium text-gray-800 xl:col-span-4">
        Titel
        <input
          name="title"
          required
          defaultValue={defaultTitle}
          placeholder="z.B. Hydraulikschlauch undicht, Service fällig..."
          className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
        />
      </label>

      <label className="text-sm font-medium text-gray-800 xl:col-span-4">
        Beschreibung
        <textarea
          name="description"
          defaultValue={defaultDescription}
          rows={3}
          className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
        />
      </label>

      <label className="text-sm font-medium text-gray-800">
        Gemeldet am
        <input
          type="date"
          name="reportedAt"
          defaultValue={defaultReportedAt}
          className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
        />
      </label>

      <label className="text-sm font-medium text-gray-800">
        Geplant von
        <input
          type="date"
          name="plannedStart"
          defaultValue={defaultPlannedStart}
          className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
        />
      </label>

      <label className="text-sm font-medium text-gray-800">
        Geplant bis
        <input
          type="date"
          name="plannedEnd"
          defaultValue={defaultPlannedEnd}
          className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
        />
      </label>

      <label className="text-sm font-medium text-gray-800 xl:col-span-2">
        Zuständig
        <input
          name="assignedTo"
          defaultValue={defaultAssignedTo}
          placeholder="Werkstatt, Mitarbeiter, extern..."
          className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
        />
      </label>

      <label className="text-sm font-medium text-gray-800 xl:col-span-2">
        Bemerkung
        <input
          name="notes"
          defaultValue={defaultNotes}
          className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
        />
      </label>

      <div className="flex items-end xl:col-span-4">
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

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-medium text-gray-500">{label}</div>
      <div className="mt-2 text-2xl font-bold text-gray-900">{value}</div>
    </div>
  );
}
