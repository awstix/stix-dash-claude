import Link from "next/link";
import { ActionIcon } from "@/components/ActionIcon";
import { AppShell } from "@/components/AppShell";
import { DismissibleDetails } from "@/components/DismissibleDetails";
import {
  getInventoryCategoryLabel,
  getInventoryCategoryOptionLabel,
  sortInventoryCategoriesForSelect,
} from "@/lib/inventory-categories";
import { prisma } from "@/lib/prisma";
import { DeleteInventoryDialog } from "./DeleteInventoryDialog";
import { ArchiveInventoryItemDialog } from "./ArchiveInventoryItemDialog";
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

function formatCreatedMeta(date: Date, createdByName: string | null) {
  const formattedDate = new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(date);

  return createdByName ? `${formattedDate} von ${createdByName}` : formattedDate;
}

function getInventoryStatusLabel(status: string | null) {
  if (status === "DEFECT") return "Defekt";
  if (status === "LOCKED") return "Gesperrt";
  if (status === "IN_SERVICE") return "In Wartung";
  if (status === "STOLEN") return "Gestohlen";
  if (status === "INACTIVE" || status === "DELETED") return "Archiviert";
  return "Aktiv";
}

function getInventoryStatusClass(status: string | null) {
  if (status === "DEFECT") return "bg-red-100 text-red-900 ring-red-200";
  if (status === "LOCKED") return "bg-orange-100 text-orange-950 ring-orange-200";
  if (status === "IN_SERVICE") return "bg-blue-100 text-blue-900 ring-blue-200";
  if (status === "STOLEN") return "bg-purple-100 text-purple-900 ring-purple-200";
  if (status === "INACTIVE" || status === "DELETED") {
    return "bg-gray-100 text-gray-700 ring-gray-200";
  }
  return "bg-green-100 text-green-900 ring-green-200";
}

function getResponsibleLabel(item: {
  responsibleCrew: { name: string } | null;
  responsibleEmployee: { firstName: string; id: string; lastName: string } | null;
  responsibleType: string | null;
}) {
  const parts = [
    item.responsibleEmployee
      ? `${item.responsibleEmployee.lastName}, ${item.responsibleEmployee.firstName}`
      : null,
    item.responsibleCrew?.name ?? null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : "—";
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
    responsibleType: string | null;
  };
}) {
  if (item.responsibleEmployee) {
    return (
      <span className="space-y-1">
        <Link
          className="font-semibold text-gray-900 hover:underline"
          href={`/employees/certificates/${item.responsibleEmployee.id}`}
        >
          {item.responsibleEmployee.lastName},{" "}
          {item.responsibleEmployee.firstName}
        </Link>
        {item.responsibleCrew ? (
          <span className="block text-xs text-gray-500">
            Kolonne: {item.responsibleCrew.name}
          </span>
        ) : null}
      </span>
    );
  }

  return <>{getResponsibleLabel(item)}</>;
}

function ContainerCell({
  item,
}: {
  item: {
    _count: {
      childItems: number;
    };
    id: string;
    isContainer: boolean;
    parentItem: { id: string; name: string } | null;
  };
}) {
  if (item.isContainer) {
    return (
      <Link
        className="inline-flex rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-900 ring-1 ring-blue-200 hover:bg-blue-200"
        href={`/inventory/${item.id}`}
      >
        Containerobjekt · {item._count.childItems} enthalten
      </Link>
    );
  }

  if (item.parentItem) {
    return (
      <Link
        className="inline-flex rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-bold text-indigo-900 ring-1 ring-indigo-200 hover:bg-indigo-200"
        href={`/inventory/${item.parentItem.id}`}
      >
        Liegt in {item.parentItem.name}
      </Link>
    );
  }

  return <span className="text-gray-400">—</span>;
}

const statusFilterOptions = [
  { label: "Aktiv", value: "ACTIVE" },
  { label: "Defekt", value: "DEFECT" },
  { label: "In Wartung", value: "IN_SERVICE" },
  { label: "Gesperrt", value: "LOCKED" },
  { label: "Gestohlen", value: "STOLEN" },
];

export default async function InventoryPage({
  searchParams,
}: {
  searchParams?: Promise<{
    category?: string;
    project?: string;
    q?: string;
    responsibleEmployee?: string;
    status?: string;
    stockManaged?: string;
    container?: string;
  }>;
}) {
  const params = (await searchParams) ?? {};
  const searchQuery = String(params.q ?? "").trim();
  const categoryFilter = String(params.category ?? "").trim();
  const projectFilter = String(params.project ?? "").trim();
  const responsibleEmployeeFilter = String(params.responsibleEmployee ?? "").trim();
  const statusFilter = String(params.status ?? "").trim();
  const stockManagedFilter = String(params.stockManaged ?? "").trim();
  const containerFilter = String(params.container ?? "").trim();
  const where: Prisma.InventoryItemWhereInput = {
    ...(categoryFilter ? { categoryId: categoryFilter } : {}),
    ...(projectFilter === "__none"
      ? { currentProjectId: null }
      : projectFilter
        ? { currentProjectId: projectFilter }
        : {}),
    ...(responsibleEmployeeFilter
      ? { responsibleEmployeeId: responsibleEmployeeFilter }
      : {}),
    ...(statusFilter
      ? { status: statusFilter }
      : { status: { notIn: ["INACTIVE", "DELETED"] } }),
    ...(stockManagedFilter === "only"
      ? { isStockManaged: true }
      : stockManagedFilter === "exclude"
        ? { isStockManaged: false }
        : {}),
    ...(containerFilter === "only"
      ? { isContainer: true }
      : containerFilter === "contained"
        ? { parentItemId: { not: null } }
        : containerFilter === "exclude"
          ? { isContainer: false }
          : containerFilter === "unassigned"
            ? { isContainer: false, parentItemId: null }
            : {}),
    ...(searchQuery
      ? {
          OR: [
            { name: { contains: searchQuery } },
            { manufacturer: { contains: searchQuery } },
            { model: { contains: searchQuery } },
            { attachmentType: { contains: searchQuery } },
            { objectNumber: { contains: searchQuery } },
            { stixId: { contains: searchQuery } },
            { licensePlate: { contains: searchQuery } },
            { serialNumber: { contains: searchQuery } },
            { vehicleIdentNumber: { contains: searchQuery } },
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
      prisma.inventoryItem.count({
        where: {
          status: {
            notIn: ["INACTIVE", "DELETED"],
          },
        },
      }),
    ]);

  const filteredItems = items;
  const sortedCategories = sortInventoryCategoriesForSelect(categories);
  const activeFilterCount = [
    categoryFilter,
    projectFilter,
    responsibleEmployeeFilter,
    statusFilter,
    stockManagedFilter,
    containerFilter,
  ].filter(Boolean).length;

  const stockManagedCount = await prisma.inventoryItem.count({
    where: {
      isStockManaged: true,
      status: {
        notIn: ["INACTIVE", "DELETED"],
      },
    },
  });
  const containerCount = await prisma.inventoryItem.count({
    where: {
      isContainer: true,
      status: {
        notIn: ["INACTIVE", "DELETED"],
      },
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
              href="/inventory/imports"
            >
              Inventar importieren →
            </Link>
            <Link
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              href="/inventory/archive"
            >
              Inventararchiv
            </Link>
            <DeleteInventoryDialog itemCount={totalItems} />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Inventar
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {filteredItems.length} von {items.length} Objekten sichtbar.
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
            <form className="flex min-w-0 flex-1 gap-2 lg:w-[420px]">
              {categoryFilter ? (
                <input name="category" type="hidden" value={categoryFilter} />
              ) : null}
              {projectFilter ? (
                <input name="project" type="hidden" value={projectFilter} />
              ) : null}
              {responsibleEmployeeFilter ? (
                <input
                  name="responsibleEmployee"
                  type="hidden"
                  value={responsibleEmployeeFilter}
                />
              ) : null}
              {statusFilter ? (
                <input name="status" type="hidden" value={statusFilter} />
              ) : null}
              {stockManagedFilter ? (
                <input
                  name="stockManaged"
                  type="hidden"
                  value={stockManagedFilter}
                />
              ) : null}
              {containerFilter ? (
                <input name="container" type="hidden" value={containerFilter} />
              ) : null}
              <input
                className="min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                defaultValue={searchQuery}
                name="q"
                placeholder="Suche nach Objekt-ID, Name, Kennzeichen..."
              />
              <button
                className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
                type="submit"
              >
                Suchen
              </button>
            </form>

            <DismissibleDetails className="relative inline-block">
              <summary className="inline-flex cursor-pointer list-none items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 [&::-webkit-details-marker]:hidden">
                🔎 Filter
                {activeFilterCount > 0 ? (
                  <span className="rounded-full bg-gray-900 px-2 py-0.5 text-xs text-white">
                    {activeFilterCount}
                  </span>
                ) : null}
              </summary>

              <div className="absolute right-0 top-full z-[var(--z-modal)] mt-2 max-h-[70vh] w-[92vw] max-w-4xl overflow-y-auto rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    Inventar filtern
                  </h3>
                  <p className="mt-1 text-sm text-gray-600">
                    Status, Kategorie, Baustelle, Lager- und Containerobjekte eingrenzen.
                  </p>
                </div>

                <form
                  action="/inventory"
                  className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2"
                >
                  <label className="text-sm font-semibold text-gray-800 md:col-span-2">
                    Suche
                    <input
                      className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                      defaultValue={searchQuery}
                      name="q"
                      placeholder="Name, Objekt-ID, Kennzeichen, Inventarnummer, Seriennummer..."
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
                    Lagerobjekte
                    <select
                      className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                      defaultValue={stockManagedFilter}
                      name="stockManaged"
                    >
                      <option value="">Alle anzeigen</option>
                      <option value="only">Nur Lagerobjekte</option>
                      <option value="exclude">Lagerobjekte ausblenden</option>
                    </select>
                  </label>

                  <label className="text-sm font-semibold text-gray-800">
                    Containerobjekte
                    <select
                      className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                      defaultValue={containerFilter}
                      name="container"
                    >
                      <option value="">Alle anzeigen</option>
                      <option value="only">Nur Containerobjekte</option>
                      <option value="contained">Nur Objekte in Container</option>
                      <option value="exclude">Containerobjekte ausblenden</option>
                      <option value="unassigned">Ohne Containerbezug</option>
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
                      {sortedCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {getInventoryCategoryOptionLabel(category)}
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

                  {responsibleEmployeeFilter ? (
                    <input
                      name="responsibleEmployee"
                      type="hidden"
                      value={responsibleEmployeeFilter}
                    />
                  ) : null}

                  <div className="flex flex-wrap items-end gap-3 md:col-span-2">
                    <button
                      className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-700"
                      type="submit"
                    >
                      Filter anwenden
                    </button>
                    <Link
                      className="rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                      href="/inventory"
                    >
                      Filter zurücksetzen
                    </Link>
                  </div>
                </form>
              </div>
            </DismissibleDetails>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-[1580px] text-left text-sm">
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
                <th className="p-3">Standort / Baustelle</th>
                <th className="p-3">Container</th>
                <th className="p-3">Lager</th>
                <th className="p-3">Satz</th>
                <th className="p-3">Stillgelegt</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td className="p-8 text-center text-gray-500" colSpan={15}>
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
                        <ArchiveInventoryItemDialog
                          itemId={item.id}
                          itemName={item.name}
                          objectNumber={item.objectNumber}
                        />
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
                          item.attachmentType
                            ? `Aufnahme ${item.attachmentType}`
                            : null,
                          item.fuelTankLiters !== null
                            ? `Kraftstofftank ${formatNumber(item.fuelTankLiters)} l`
                            : null,
                          item.workMaterialTankLiters !== null
                            ? `Arbeitsmitteltank ${formatNumber(item.workMaterialTankLiters)} l`
                            : null,
                          item.stixId ? `STIX-ID ${item.stixId}` : null,
                          item.licensePlate ? `Kennz. ${item.licensePlate}` : null,
                          item.inventoryNumber
                            ? `Inventarnr. ${item.inventoryNumber}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {item.isContainer ? (
                          <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-900 ring-1 ring-blue-200">
                            Containerobjekt
                          </span>
                        ) : null}
                        {item.parentItem ? (
                          <span className="inline-flex rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-bold text-indigo-900 ring-1 ring-indigo-200">
                            In Container
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="p-3 text-gray-700">
                      {formatCreatedMeta(item.createdAt, item.createdByName)}
                    </td>
                    <td className="p-3 text-gray-700">
                      {getInventoryCategoryLabel(item.category)}
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
                      <ResponsibleCell item={item} />
                    </td>
                    <td className="p-3 text-gray-700">
                      {item.currentProject
                        ? `${item.currentProject.projectNumber} · ${item.currentProject.name}`
                        : item.currentLocationLabel ?? "—"}
                    </td>
                    <td className="p-3 text-gray-700">
                      <ContainerCell item={item} />
                    </td>
                    <td className="p-3 text-gray-700">
                      {item.isStockManaged
                        ? `${formatNumber(item.currentStock)} ${item.stockUnit}`
                        : "—"}
                    </td>
                    <td className="p-3 text-gray-700">
                      {formatMoney(item.billingRateCents)}
                    </td>
                    <td className="p-3 text-gray-700">
                      {formatMoney(item.idleBillingRateCents)}
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
