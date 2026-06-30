import Link from "next/link";
import { ActionIcon } from "@/components/ActionIcon";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { deleteInventoryItem } from "./actions";
import { InventoryPhotoThumbnailButton } from "./InventoryPhotoGallery";
import { ProjectStatus, type Prisma } from "@prisma/client";

function formatMoney(cents: number | null) {
  if (cents === null) return "—";

  return new Intl.NumberFormat("de-DE", {
    currency: "EUR",
    style: "currency",
  }).format(cents / 100);
}

function formatNumber(value: number | null) {
  if (value === null) return "";

  return new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 3,
  }).format(value);
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

function getResponsibleLabel(item: {
  responsibleCrew: { name: string } | null;
  responsibleEmployee: { firstName: string; lastName: string } | null;
  responsibleType: string | null;
}) {
  if (item.responsibleType === "EMPLOYEE" && item.responsibleEmployee) {
    return `${item.responsibleEmployee.lastName}, ${item.responsibleEmployee.firstName}`;
  }

  if (item.responsibleType === "CREW" && item.responsibleCrew) {
    return item.responsibleCrew.name;
  }

  return "—";
}

const statusFilterOptions = [
  { label: "Aktiv", value: "ACTIVE" },
  { label: "Defekt", value: "DEFECT" },
  { label: "In Wartung", value: "IN_SERVICE" },
  { label: "Gesperrt", value: "LOCKED" },
];

export default async function InventoryPage({
  searchParams,
}: {
  searchParams?: Promise<{
    category?: string;
    project?: string;
    q?: string;
    status?: string;
  }>;
}) {
  const params = (await searchParams) ?? {};
  const searchQuery = String(params.q ?? "").trim();
  const categoryFilter = String(params.category ?? "").trim();
  const projectFilter = String(params.project ?? "").trim();
  const statusFilter = String(params.status ?? "").trim();
  const where: Prisma.InventoryItemWhereInput = {
    ...(categoryFilter ? { categoryId: categoryFilter } : {}),
    ...(projectFilter === "__none"
      ? { currentProjectId: null }
      : projectFilter
        ? { currentProjectId: projectFilter }
        : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
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

  const [categories, projects, items, totalItems] =
    await Promise.all([
      prisma.inventoryCategory.findMany({
        where: {
          isActive: true,
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
      prisma.inventoryItem.findMany({
        where,
        include: {
          category: true,
          currentProject: true,
          parentItem: true,
          photos: {
            orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
          },
          responsibleCrew: true,
          responsibleEmployee: true,
          _count: {
            select: {
              childItems: true,
              photos: true,
            },
          },
        },
        orderBy: [{ updatedAt: "desc" }],
      }),
      prisma.inventoryItem.count(),
    ]);

  const filteredItems = items;

  const stockManagedCount = await prisma.inventoryItem.count({
    where: {
      isStockManaged: true,
    },
  });
  const containerCount = await prisma.inventoryItem.count({
    where: {
      isContainer: true,
    },
  });

  return (
    <AppShell
      title="Inventarverwaltung"
      description="Erste Grundverwaltung für Geräte, Maschinen, Werkzeuge, Containerobjekte und Lagerobjekte."
    >
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <SummaryCard label="Inventarobjekte" value={String(totalItems)} />
        <SummaryCard label="Containerobjekte" value={String(containerCount)} />
        <SummaryCard label="Lagergeführt" value={String(stockManagedCount)} />
        <SummaryCard
          label="Kategorien"
          value={String(categories.length)}
        />
      </div>

      <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Inventar verwalten
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Übersicht aller Inventarobjekte. Neue Objekte werden auf einer
              eigenen Eingabeseite angelegt.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
              href="/inventory/new"
            >
              + Objekt anlegen
            </Link>
            <Link
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              href="/admin/inventory-categories"
            >
              Kategorien pflegen →
            </Link>
            <Link
              className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-900 hover:bg-blue-100"
              href="/inventory/master-data"
            >
              Stammdaten übernehmen →
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Inventar
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {filteredItems.length} von {items.length} Objekten sichtbar.
            </p>
          </div>

          <form className="grid w-full grid-cols-1 gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 md:grid-cols-2 xl:grid-cols-5">
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
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
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
            <div className="flex items-end gap-2 md:col-span-2 xl:col-span-5">
            <button
              className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
              type="submit"
            >
                Filter anwenden
            </button>
              <Link
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                href="/inventory"
              >
                Zurücksetzen
              </Link>
            </div>
          </form>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-[1500px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="w-28 p-3">Aktionen</th>
                <th className="w-20 p-3">Foto</th>
                <th className="p-3">Objekt</th>
                <th className="p-3">Angelegt</th>
                <th className="p-3">Kategorie</th>
                <th className="p-3">Status</th>
                <th className="p-3">Objekt-ID</th>
                <th className="p-3">Kennzeichen</th>
                <th className="p-3">Seriennr.</th>
                <th className="p-3">Verantwortlich</th>
                <th className="p-3">Baustelle</th>
                <th className="p-3">Container</th>
                <th className="p-3">Lager</th>
                <th className="p-3">Satz</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td className="p-8 text-center text-gray-500" colSpan={14}>
                    Noch keine passenden Inventarobjekte vorhanden.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
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
                      <InventoryPhotoThumb
                        name={item.name}
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
                        {[
                          item.manufacturer,
                          item.model,
                          item.licensePlate ? `Kennz. ${item.licensePlate}` : null,
                          item.inventoryNumber
                            ? `Inventarnr. ${item.inventoryNumber}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </div>
                    </td>
                    <td className="p-3 text-gray-700">
                      {formatCreatedMeta(item.createdAt)}
                    </td>
                    <td className="p-3 text-gray-700">
                      {item.category?.name ?? "—"}
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
                    <td className="p-3 text-gray-700">
                      {item.objectNumber ?? "—"}
                    </td>
                    <td className="p-3 text-gray-700">
                      {item.licensePlate ?? "—"}
                    </td>
                    <td className="p-3 text-gray-700">
                      {item.serialNumber ?? "—"}
                    </td>
                    <td className="p-3 text-gray-700">
                      {getResponsibleLabel(item)}
                    </td>
                    <td className="p-3 text-gray-700">
                      {item.currentProject
                        ? `${item.currentProject.projectNumber} · ${item.currentProject.name}`
                        : "—"}
                    </td>
                    <td className="p-3 text-gray-700">
                      {item.isContainer
                        ? `${item._count.childItems} enthalten`
                        : item.parentItem?.name ?? "—"}
                    </td>
                    <td className="p-3 text-gray-700">
                      {item.isStockManaged
                        ? `${formatNumber(item.currentStock)} ${item.stockUnit}`
                        : "—"}
                    </td>
                    <td className="p-3 text-gray-700">
                      {formatMoney(item.billingRateCents)}
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

function InventoryPhotoThumb({
  name,
  photos,
}: {
  name: string;
  photos: {
    createdAt: string;
    fileName: string;
    id: string;
    isPrimary: boolean;
    locationNote: string | null;
    mimeType: string | null;
    originalName: string | null;
    sizeBytes: number | null;
    uploadedBy: string | null;
    url: string;
  }[];
}) {
  return <InventoryPhotoThumbnailButton itemName={name} photos={photos} />;
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-semibold text-gray-500">{label}</div>
      <div className="mt-2 text-3xl font-bold text-gray-900">{value}</div>
    </div>
  );
}
