import Link from "next/link";
import { ActionIcon } from "@/components/ActionIcon";
import { AppShell } from "@/components/AppShell";
import {
  getInventoryCategoryLabel,
  getInventoryCategoryOptionLabel,
  sortInventoryCategoriesForSelect,
} from "@/lib/inventory-categories";
import { prisma } from "@/lib/prisma";
import { deleteInventoryItem } from "../actions";
import { InventoryPhotoThumbnailButton } from "../InventoryPhotoGallery";
import { InventoryStockMovementDialog } from "../InventoryStockMovementDialog";
import { ProjectStatus, type Prisma } from "@prisma/client";

function formatStock(value: number | null, unit: string) {
  if (value === null) return "—";

  return `${new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 3,
  }).format(value)} ${unit}`;
}

function formatCreatedMeta(date: Date) {
  return `${new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(date)} von Benutzer`;
}

const statusFilterOptions = [
  { label: "Aktiv", value: "ACTIVE" },
  { label: "Defekt", value: "DEFECT" },
  { label: "In Wartung", value: "IN_SERVICE" },
  { label: "Gesperrt", value: "LOCKED" },
];

const stockFilterOptions = [
  { label: "Mit Bestand", value: "in-stock" },
  { label: "Leer / 0", value: "empty" },
  { label: "Negativ", value: "negative" },
];

function getInventoryStatusLabel(status: string | null) {
  if (status === "DEFECT") return "Defekt";
  if (status === "LOCKED") return "Gesperrt";
  if (status === "IN_SERVICE") return "In Wartung";
  return "Aktiv";
}

function getInventoryStatusClass(status: string | null) {
  if (status === "DEFECT") return "bg-red-100 text-red-900 ring-red-200";
  if (status === "LOCKED") return "bg-orange-100 text-orange-950 ring-orange-200";
  if (status === "IN_SERVICE") return "bg-blue-100 text-blue-900 ring-blue-200";
  return "bg-green-100 text-green-900 ring-green-200";
}

function ResponsibleCell({
  item,
}: {
  item: {
    responsibleCrew: { name: string } | null;
    responsibleEmployee: {
      firstName: string;
      id: string;
      lastName: string;
    } | null;
  };
}) {
  if (item.responsibleEmployee) {
    return (
      <Link
        className="font-semibold text-gray-900 hover:underline"
        href={`/employees/certificates/${item.responsibleEmployee.id}`}
      >
        {item.responsibleEmployee.lastName},{" "}
        {item.responsibleEmployee.firstName}
      </Link>
    );
  }

  return <>{item.responsibleCrew?.name ?? "—"}</>;
}

function getStockWhere(filter: string): Prisma.InventoryItemWhereInput {
  if (filter === "in-stock") return { currentStock: { gt: 0 } };
  if (filter === "empty") return { currentStock: { equals: 0 } };
  if (filter === "negative") return { currentStock: { lt: 0 } };
  return {};
}

export default async function InventoryStoragePage({
  searchParams,
}: {
  searchParams?: Promise<{
    category?: string;
    project?: string;
    q?: string;
    status?: string;
    stock?: string;
  }>;
}) {
  const params = (await searchParams) ?? {};
  const searchQuery = String(params.q ?? "").trim();
  const categoryFilter = String(params.category ?? "").trim();
  const projectFilter = String(params.project ?? "").trim();
  const statusFilter = String(params.status ?? "").trim();
  const stockFilter = String(params.stock ?? "").trim();
  const where: Prisma.InventoryItemWhereInput = {
      isStockManaged: true,
    ...(categoryFilter ? { categoryId: categoryFilter } : {}),
    ...(projectFilter === "__none"
      ? { currentProjectId: null }
      : projectFilter
        ? { currentProjectId: projectFilter }
        : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
    ...getStockWhere(stockFilter),
    ...(searchQuery
      ? {
          OR: [
            { name: { contains: searchQuery } },
            { manufacturer: { contains: searchQuery } },
            { model: { contains: searchQuery } },
            { objectNumber: { contains: searchQuery } },
            { licensePlate: { contains: searchQuery } },
            { serialNumber: { contains: searchQuery } },
            { inventoryNumber: { contains: searchQuery } },
            { category: { name: { contains: searchQuery } } },
            { currentProject: { name: { contains: searchQuery } } },
            { currentProject: { projectNumber: { contains: searchQuery } } },
          ],
        }
      : {}),
  };

  const [categories, projects, employees, items, totalItems] = await Promise.all([
    prisma.inventoryCategory.findMany({
      where: {
        isActive: true,
      },
      include: {
        parentCategory: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.project.findMany({
      where: {
        status: {
          in: [
            ProjectStatus.ACTIVE,
            ProjectStatus.NOT_STARTED,
            ProjectStatus.PAUSED,
          ],
        },
      },
      orderBy: [{ projectNumber: "desc" }],
      select: {
        id: true,
        name: true,
        projectNumber: true,
      },
    }),
    prisma.employee.findMany({
      where: {
        statusValue: "active",
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        firstName: true,
        id: true,
        lastName: true,
      },
    }),
    prisma.inventoryItem.findMany({
      where,
    include: {
      category: {
        include: {
          parentCategory: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      currentProject: true,
      photos: {
        orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
      },
      responsibleCrew: true,
      responsibleEmployee: true,
    },
    orderBy: [{ name: "asc" }],
    }),
    prisma.inventoryItem.count({
      where: {
        isStockManaged: true,
      },
    }),
  ]);

  return (
    <AppShell
      title="Lagerverwaltung"
      description="Erste Übersicht für lagergeführte Inventarobjekte. Ausgabe, Rücknahme und Mitarbeiterhistorie folgen als nächster sauberer Schritt."
    >
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Lagerobjekte
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {items.length} von {totalItems} lagergeführten Objekten sichtbar.
            </p>
          </div>
          <Link
            className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
            href="/inventory"
          >
            Inventar öffnen
          </Link>
        </div>

        <form className="mt-5 grid grid-cols-1 gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 md:grid-cols-2 xl:grid-cols-6">
          <label className="text-sm font-semibold text-gray-800 md:col-span-2">
            Suche
            <input
              className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              defaultValue={searchQuery}
              name="q"
              placeholder="Suche nach Name, Objekt-ID, Kennzeichen, Inventarnummer, Seriennummer..."
            />
          </label>
          <label className="text-sm font-semibold text-gray-800">
            Status
            <select
              className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              defaultValue={statusFilter}
              name="status"
            >
              <option value="">Alle Status</option>
              {statusFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-gray-800">
            Kategorie
            <select
              className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              defaultValue={categoryFilter}
              name="category"
            >
              <option value="">Alle Kategorien</option>
              {sortInventoryCategoriesForSelect(categories).map((category) => (
                <option key={category.id} value={category.id}>
                  {getInventoryCategoryOptionLabel(category)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-gray-800">
            Lagerbestand
            <select
              className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              defaultValue={stockFilter}
              name="stock"
            >
              <option value="">Alle</option>
              {stockFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-gray-800">
            Baustelle
            <select
              className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              defaultValue={projectFilter}
              name="project"
            >
              <option value="">Alle Baustellen</option>
              <option value="__none">Ohne Baustelle</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.projectNumber} · {project.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-2 md:col-span-2 xl:col-span-6">
            <button
              className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
              type="submit"
            >
              Filter anwenden
            </button>
            <Link
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              href="/inventory/storage"
            >
              Zurücksetzen
            </Link>
          </div>
        </form>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-[1320px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="w-44 p-3">Aktionen</th>
                <th className="w-20 p-3">Foto</th>
                <th className="p-3">Objekt</th>
                <th className="p-3">Angelegt</th>
                <th className="p-3">Kategorie</th>
                <th className="p-3">Anfangsbestand</th>
                <th className="p-3">Aktueller Bestand</th>
                <th className="p-3">Verantwortlich</th>
                <th className="p-3">Standort / Baustelle</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td className="p-8 text-center text-gray-500" colSpan={10}>
                    Noch keine lagergeführten Inventarobjekte vorhanden.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr className="border-t border-gray-100" key={item.id}>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <Link
                          aria-label={`${item.name} öffnen`}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                          href={`/inventory/${item.id}`}
                          title="Öffnen"
                        >
                          <ActionIcon name="open" className="h-4 w-4" />
                        </Link>
                        <Link
                          aria-label={`${item.name} bearbeiten`}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                          href={`/inventory/${item.id}/edit`}
                          title="Bearbeiten"
                        >
                          <ActionIcon name="edit" className="h-4 w-4" />
                        </Link>
                        <InventoryStockMovementDialog
                          currentProjectId={item.currentProjectId}
                          currentStockLabel={formatStock(
                            item.currentStock,
                            item.stockUnit,
                          )}
                          employees={employees}
                          itemId={item.id}
                          itemName={item.name}
                          projects={projects}
                          stockUnit={item.stockUnit}
                        />
                        <form action={deleteInventoryItem}>
                          <input name="id" type="hidden" value={item.id} />
                          <button
                            aria-label={`${item.name} löschen`}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-50"
                            title="Löschen"
                            type="submit"
                          >
                            <ActionIcon name="delete" className="h-4 w-4" />
                          </button>
                        </form>
                      </div>
                    </td>
                    <td className="p-3">
                      <InventoryPhotoThumbnailButton
                        itemName={item.name}
                        photos={item.photos.map((photo) => ({
                          createdAt: photo.createdAt.toISOString(),
                          fileName: photo.fileName,
                          id: photo.id,
                          isPrimary: photo.isPrimary,
                          locationNote: photo.locationNote,
                          mimeType: photo.mimeType,
                          originalName: photo.originalName,
                          sizeBytes: photo.sizeBytes,
                          uploadedBy: photo.uploadedBy,
                          url: photo.url,
                        }))}
                      />
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-gray-900">
                        <Link className="hover:underline" href={`/inventory/${item.id}`}>
                          {item.name}
                        </Link>
                      </div>
                      <div className="text-xs text-gray-500">
                        {[item.objectNumber, item.inventoryNumber
                          ? `Inventarnr. ${item.inventoryNumber}`
                          : null]
                          .filter(Boolean)
                          .join(" · ") || "ohne Objekt-ID"}
                      </div>
                    </td>
                    <td className="p-3 text-gray-700">
                      {formatCreatedMeta(item.createdAt)}
                    </td>
                    <td className="p-3 text-gray-700">
                      {getInventoryCategoryLabel(item.category)}
                    </td>
                    <td className="p-3 text-gray-700">
                      {formatStock(item.openingStock, item.stockUnit)}
                    </td>
                    <td className="p-3 font-semibold text-gray-900">
                      {formatStock(item.currentStock, item.stockUnit)}
                    </td>
                    <td className="p-3 text-gray-700">
                      <ResponsibleCell item={item} />
                    </td>
                    <td className="p-3 text-gray-700">
                      {item.currentProject
                        ? `${item.currentProject.projectNumber} · ${item.currentProject.name}`
                        : item.currentLocationLabel ?? "—"}
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${getInventoryStatusClass(
                          item.status,
                        )}`}
                      >
                        {getInventoryStatusLabel(item.status)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
