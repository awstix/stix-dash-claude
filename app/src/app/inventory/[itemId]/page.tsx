import Link from "next/link";
/* eslint-disable @next/next/no-img-element */
import { notFound } from "next/navigation";
import { ProjectStatus } from "@prisma/client";
import { AppShell } from "@/components/AppShell";
import {
  DismissibleDetails,
  DismissibleDetailsCloseButton,
} from "@/components/DismissibleDetails";
import {
  inventoryItemToVehicleWithInventoryLink,
  inventoryVehicleBridgeInclude,
} from "@/lib/inventory-vehicle-links";
import { getInventoryCategoryLabel } from "@/lib/inventory-categories";
import { prisma } from "@/lib/prisma";
import { parseProjectFormFields } from "@/app/projects/projectFormTypes";
import { createWorkshopRepairOrder } from "../../workshop/actions";
import {
  ensureWorkshopRepairOrderTemplate,
  WORKSHOP_REPAIR_TEMPLATE_ID,
} from "../../workshop/repairOrderTemplate";
import { WorkshopOrderForm } from "../../workshop/WorkshopOrderForm";
import { BUILT_IN_WORKSHOP_FORMS } from "../../workshop/workshopFormTypes";
import { InventoryContainerManager } from "../InventoryContainerManager";
import { InventoryIdlePeriodsDialog } from "../InventoryIdlePeriodsDialog";
import { InventoryPhotoPreviewPanel } from "../InventoryPhotoGallery";
import { InventoryStockMovementForm } from "../InventoryStockMovementForm";
import { PersonalInventoryPanel } from "../PersonalInventoryPanel";
import { InventoryWorkshopFormDialog } from "../InventoryWorkshopFormDialog";
import {
  returnInventoryItemToBaseLocation,
  updateInventoryAssignment,
} from "../actions";

function formatDate(date: Date | null) {
  if (!date) return "—";

  return new Intl.DateTimeFormat("de-DE").format(date);
}

function formatCreatedAt(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(date);
}

function formatMoney(cents: number | null) {
  if (cents === null) return "—";

  return new Intl.NumberFormat("de-DE", {
    currency: "EUR",
    style: "currency",
  }).format(cents / 100);
}

function formatStock(value: number | null, unit: string) {
  if (value === null) return "—";

  return `${new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 3,
  }).format(value)} ${unit}`;
}

function formatStockChange(
  quantity: number | null,
  stockBefore: number | null,
  stockAfter: number | null,
  unit: string,
) {
  const parts = [];

  if (quantity !== null) {
    parts.push(`Menge: ${formatStock(quantity, unit)}`);
  }

  if (stockBefore !== null || stockAfter !== null) {
    parts.push(
      `Bestand: ${formatStock(stockBefore, unit)} → ${formatStock(stockAfter, unit)}`,
    );
  }

  return parts.join(" · ");
}

function formatNumber(value: number | null) {
  if (value === null) return "—";

  return new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatCoordinate(value: number | null) {
  if (value === null) return "—";

  return new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 6,
  }).format(value);
}

function getOpenStreetMapEmbedUrl(latitude: number, longitude: number) {
  const latDelta = 0.003;
  const lonDelta = 0.004;
  const bbox = [
    longitude - lonDelta,
    latitude - latDelta,
    longitude + lonDelta,
    latitude + latDelta,
  ].join(",");

  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(
    bbox,
  )}&layer=mapnik&marker=${encodeURIComponent(`${latitude},${longitude}`)}`;
}

function getOpenStreetMapUrl(latitude: number, longitude: number) {
  return `https://www.openstreetmap.org/?mlat=${encodeURIComponent(
    latitude,
  )}&mlon=${encodeURIComponent(longitude)}#map=18/${encodeURIComponent(
    latitude,
  )}/${encodeURIComponent(longitude)}`;
}

function formatScanLocationAddress(scan: {
  latitude: number | null;
  locationAddressLabel: string | null;
  locationCity: string | null;
  locationHouseNumber: string | null;
  locationPostcode: string | null;
  locationStreet: string | null;
  longitude: number | null;
}) {
  const streetLine = [scan.locationStreet, scan.locationHouseNumber]
    .filter(Boolean)
    .join(" ");
  const cityLine = [scan.locationPostcode, scan.locationCity]
    .filter(Boolean)
    .join(" ");
  const compactAddress = [streetLine, cityLine].filter(Boolean).join(", ");

  if (compactAddress) return compactAddress;

  if (scan.locationAddressLabel) return scan.locationAddressLabel;

  if (scan.latitude !== null && scan.longitude !== null) {
    return `${formatCoordinate(scan.latitude)}, ${formatCoordinate(scan.longitude)}`;
  }

  return "nicht erfasst";
}

function formatKilograms(value: number | null) {
  if (value === null) return "—";

  return `${new Intl.NumberFormat("de-DE").format(value)} kg`;
}

function formatTonsFromKilograms(value: number | null) {
  if (value === null) return "—";

  return `${new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 3,
  }).format(value / 1000)} t`;
}

function getDriveTypeLabel(value: string | null) {
  if (value === "WHEEL") return "Rad";
  if (value === "TRACK") return "Kette";
  if (value === "WHEEL_AND_TRACK") return "Rad/Kette";
  if (value === "TRAILER") return "Anhänger / gezogen";
  if (value === "OTHER") return "Sonstiges";

  return "—";
}

function getInventoryStatusLabel(status: string | null) {
  if (status === "DEFECT") return "Defekt";
  if (status === "LOCKED") return "Gesperrt";
  if (status === "IN_SERVICE") return "In Wartung";
  if (status === "INACTIVE" || status === "DELETED") return "Archiviert";
  return "Aktiv";
}

function getInventoryStatusClass(status: string | null) {
  if (status === "DEFECT") return "border-red-200 bg-red-50 text-red-900";
  if (status === "LOCKED") return "border-orange-200 bg-orange-50 text-orange-950";
  if (status === "IN_SERVICE") return "border-blue-200 bg-blue-50 text-blue-900";
  if (status === "INACTIVE" || status === "DELETED") {
    return "border-gray-200 bg-gray-50 text-gray-700";
  }
  return "border-green-200 bg-green-50 text-green-900";
}

function getResponsibleLabel(item: {
  responsibleCrew: { name: string } | null;
  responsibleEmployee: { firstName: string; id?: string; lastName: string } | null;
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

function getCurrentLocationLabel(item: {
  currentLocationLabel: string | null;
  currentProject: { name: string; projectNumber: string } | null;
  responsibleCrew: { name: string } | null;
  responsibleEmployee: { firstName: string; id?: string; lastName: string } | null;
  responsibleType: string | null;
}) {
  if (item.currentProject) {
    const responsible = getResponsibleLabel(item);
    return [
      `${item.currentProject.projectNumber} · ${item.currentProject.name}`,
      responsible !== "—" ? responsible : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  const responsible = getResponsibleLabel(item);

  return [item.currentLocationLabel ?? "Kein Standort zugewiesen", responsible !== "—" ? responsible : null]
    .filter(Boolean)
    .join(" · ");
}

function getHistoryEventLabel(eventType: string) {
  if (eventType === "ASSIGNMENT") return "Zuordnung";
  if (eventType === "ISSUE") return "Ausgabe";
  if (eventType === "RETURN") return "Rücknahme";
  if (eventType === "PERSONAL_ISSUE") return "Persönliche Ausgabe";
  if (eventType === "PERSONAL_RETURN") return "Persönliche Rücknahme";
  if (eventType === "ADJUSTMENT") return "Bestandskorrektur";
  if (eventType === "DEFECT") return "Defekt";
  if (eventType === "WORKSHOP_FORM") return "Werkstattformular";
  if (eventType === "RETURN_TO_BASE") return "Rückgabe";
  return eventType;
}

function getHistoryEventClass(eventType: string) {
  if (eventType === "ISSUE") return "bg-red-100 text-red-900";
  if (eventType === "RETURN") return "bg-green-100 text-green-900";
  if (eventType === "PERSONAL_ISSUE") return "bg-amber-100 text-amber-950";
  if (eventType === "PERSONAL_RETURN") return "bg-emerald-100 text-emerald-900";
  if (eventType === "ADJUSTMENT") return "bg-amber-100 text-amber-950";
  if (eventType === "ASSIGNMENT") return "bg-blue-100 text-blue-900";
  if (eventType === "DEFECT") return "bg-red-100 text-red-900";
  if (eventType === "RETURN_TO_BASE") return "bg-emerald-100 text-emerald-900";
  return "bg-gray-100 text-gray-800";
}

export default async function InventoryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ itemId: string }>;
  searchParams?: Promise<{
    locationAlert?: string;
    notice?: string;
    noticeType?: string;
  }>;
}) {
  const { itemId } = await params;
  const currentSearchParams = (await searchParams) ?? {};
  const locationAlertWasCreated = currentSearchParams.locationAlert === "1";
  const notice = currentSearchParams.notice?.trim() ?? "";
  const noticeType = currentSearchParams.noticeType === "error" ? "error" : "success";

  const item = await prisma.inventoryItem.findUnique({
    where: {
      id: itemId,
    },
    include: {
      category: {
        include: {
          parentCategory: {
            select: {
              id: true,
              isPersonalInventory: true,
              name: true,
            },
          },
        },
      },
      childItems: {
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
          photos: {
            orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
            take: 1,
          },
        },
        orderBy: [{ name: "asc" }],
      },
      contacts: {
        orderBy: [
          { role: "asc" },
          { lastName: "asc" },
          { firstName: "asc" },
          { name: "asc" },
        ],
      },
      currentProject: true,
      employeeAssignments: {
        include: {
          employee: true,
        },
        orderBy: {
          employee: {
            lastName: "asc",
          },
        },
      },
      idlePeriods: {
        orderBy: [{ startsAt: "desc" }],
      },
      parentItem: true,
      photos: {
        orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
      },
      personalAssignments: {
        include: { employee: true },
        orderBy: { issuedAt: "desc" },
      },
      responsibleCrew: true,
      responsibleEmployee: true,
      scanLogs: {
        orderBy: [{ createdAt: "desc" }],
        take: 10,
      },
      usageHistory: {
        include: {
          employee: true,
          project: true,
          transportedByEmployee: true,
        },
        orderBy: [{ createdAt: "desc" }],
        take: 20,
      },
      vehicle: true,
    },
  });

  if (!item) {
    notFound();
  }

  await ensureWorkshopRepairOrderTemplate();

  const [
    workshopTemplates,
    workshopEmployees,
    workshopVehicleItems,
    allEmployees,
    crews,
    projects,
  ] = await Promise.all([
    prisma.workshopFormTemplate.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.employee.findMany({
      where: {
        departmentValue: "werkstatt",
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
      where: {
        status: {
          not: "INACTIVE",
        },
        vehicleId: {
          not: null,
        },
      },
      include: inventoryVehicleBridgeInclude,
      orderBy: [
        { category: { sortOrder: "asc" } },
        { category: { name: "asc" } },
        { objectNumber: "asc" },
        { name: "asc" },
      ],
    }),
    prisma.employee.findMany({
      where: {
        statusValue: "active",
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        canManagePersonalInventory: true,
        firstName: true,
        id: true,
        isLeadership: true,
        lastName: true,
      },
    }),
    prisma.crew.findMany({
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
      },
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
  ]);
  const repairTemplate =
    workshopTemplates.find((template) => template.id === WORKSHOP_REPAIR_TEMPLATE_ID) ??
    null;
  const inventoryManagers = allEmployees.filter(
    (employee) => employee.canManagePersonalInventory,
  );
  const repairTemplateFields = parseProjectFormFields(repairTemplate?.fieldsJson);
  const workshopFormTemplates = [
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
  ];
  const workshopPersonnelOptions = workshopEmployees.map((employee) => ({
    id: employee.id,
    name: `${employee.firstName} ${employee.lastName}`,
  }));
  const workshopVehicles = workshopVehicleItems.flatMap((vehicleItem) => {
    const vehicle = inventoryItemToVehicleWithInventoryLink(vehicleItem);
    return vehicle ? [vehicle] : [];
  });
  const itemLabel = [item.objectNumber, item.inventoryNumber, item.stixId, item.name]
    .filter(Boolean)
    .join(" · ");
  const inventoryPhotos = item.photos.map((photo) => ({
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
  }));
  const idlePeriods = item.idlePeriods.map((period) => ({
    endsAt: period.endsAt ? period.endsAt.toISOString().slice(0, 10) : "",
    id: period.id,
    notes: period.notes ?? "",
    startsAt: period.startsAt.toISOString().slice(0, 10),
  }));
  const defaultRepairDescription = [
    "",
    `Inventarobjekt: ${itemLabel || item.name}`,
    item.serialNumber ? `Seriennummer: ${item.serialNumber}` : null,
    item.currentProject
      ? `Aktuelle Baustelle: ${item.currentProject.projectNumber} · ${item.currentProject.name}`
      : null,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  const assignableContainerItems = item.isContainer
    ? await prisma.inventoryItem.findMany({
        where: {
          id: {
            notIn: [item.id, ...item.childItems.map((child) => child.id)],
          },
        },
        orderBy: [{ name: "asc" }],
        select: {
          id: true,
          inventoryNumber: true,
          name: true,
          objectNumber: true,
          parentItem: {
            select: {
              name: true,
            },
          },
          photos: {
            orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
            take: 1,
            select: {
              url: true,
            },
          },
        },
      })
    : [];

  return (
    <AppShell
      title={item.name}
      description="Inventarobjekt mit Objektdaten, Zuordnung, Fotos, Ansprechpartnern und Historie."
    >
      {locationAlertWasCreated ? (
        <section className="mb-6 rounded-2xl border border-orange-200 bg-orange-50 p-5 text-sm text-orange-950 shadow-sm">
          <p className="font-bold">Standortmeldung wurde angelegt.</p>
          <p className="mt-1">
            Der letzte Scan passt nicht eindeutig zum aktuellen Dispo-Standort.
            Admin, Disponent oder Bauleiter können das Objekt unter{" "}
            <Link
              className="font-bold underline"
              href="/inventory/location-alerts"
            >
              Inventar · Standortmeldungen
            </Link>{" "}
            final einer Baustelle zuweisen.
          </p>
        </section>
      ) : null}

      {notice ? (
        <section
          className={`mb-6 rounded-2xl border p-5 text-sm font-semibold shadow-sm ${
            noticeType === "error"
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-green-200 bg-green-50 text-green-800"
          }`}
        >
          {notice}
        </section>
      ) : null}

      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          href="/inventory"
        >
          ← Inventar
        </Link>
        <Link
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          href="/inventory/storage"
        >
          Lagerverwaltung
        </Link>
        <Link
          className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
          href={`/inventory/${item.id}/edit`}
        >
          Bearbeiten
        </Link>
        <Link
          className="rounded-xl border border-yellow-300 bg-yellow-50 px-4 py-2 text-sm font-semibold text-yellow-950 hover:bg-yellow-100"
          href={`/inventory/${item.id}/label`}
        >
          Etikett
        </Link>
        <InventoryIdlePeriodsDialog itemId={item.id} periods={idlePeriods} />
        <DismissibleDetails className="relative inline-block">
          <summary className="inline-flex cursor-pointer list-none items-center justify-center rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-100 [&::-webkit-details-marker]:hidden">
            Rückgabe
          </summary>
          <div className="absolute right-0 top-full z-[var(--z-modal)] mt-2 max-h-[70vh] w-[92vw] max-w-3xl overflow-y-auto rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Objekt zurückgeben
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  Das Objekt wird von Baustelle/Person gelöst und dem gewählten
                  Standort zugeordnet.
                </p>
              </div>
              <DismissibleDetailsCloseButton />
            </div>
            <form
              action={returnInventoryItemToBaseLocation}
              className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2"
            >
              <input name="id" type="hidden" value={item.id} />
              <label className="text-sm font-semibold text-gray-800">
                Zielstandort
                <select
                  className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                  name="locationType"
                  required
                >
                  <option value="">Bitte wählen</option>
                  <option value="BAUHOF">Bauhof</option>
                  <option value="WERKSTATT">Werkstatt</option>
                  <option value="MISCHANLAGE">Mischanlage</option>
                </select>
              </label>
              <label className="text-sm font-semibold text-gray-800">
                Transportiert von
                <select
                  className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                  defaultValue="__none"
                  name="transportedByEmployeeId"
                >
                  <option value="__none">Nicht angegeben</option>
                  {allEmployees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.lastName}, {employee.firstName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold text-gray-800 md:col-span-2">
                Bemerkung
                <input
                  className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
                  name="notes"
                  placeholder="z.B. zurückgebracht, abgestellt, geprüft..."
                />
              </label>
              <div className="flex flex-wrap gap-3 md:col-span-2">
                <button
                  className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800"
                  type="submit"
                >
                  Rückgabe speichern
                </button>
              </div>
            </form>
          </div>
        </DismissibleDetails>
        <DismissibleDetails className="relative inline-block">
          <summary className="inline-flex cursor-pointer list-none items-center justify-center rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-900 hover:bg-blue-100 [&::-webkit-details-marker]:hidden">
            Umdisponieren
          </summary>
          <div className="absolute right-0 top-full z-[var(--z-modal)] mt-2 max-h-[70vh] w-[92vw] max-w-3xl overflow-y-auto rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Objekt umdisponieren
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  Die Umdisponierung auf der Objektseite hat Vorrang und bleibt
                  aktiv, bis das Objekt später über Planung, Gerätedisposition,
                  LKW-Disposition oder wieder hier umgebucht wird.
                </p>
              </div>
              <DismissibleDetailsCloseButton />
            </div>
            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
              <Link
                className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 hover:bg-emerald-100"
                href="/crew-dispatch"
              >
                <div className="font-bold text-emerald-950">
                  Planung / Kolonnen
                </div>
                <div className="mt-1 text-sm text-emerald-800">
                  Zuordnung über Baustelle, Kolonne, Mitarbeiter und Geräte.
                </div>
              </Link>
              <Link
                className="rounded-2xl border border-blue-200 bg-blue-50 p-4 hover:bg-blue-100"
                href="/equipment-dispatch"
              >
                <div className="font-bold text-blue-950">Gerätedisposition</div>
                <div className="mt-1 text-sm text-blue-800">
                  Geräte gezielt im Zeitstrahl disponieren.
                </div>
              </Link>
              <Link
                className="rounded-2xl border border-orange-200 bg-orange-50 p-4 hover:bg-orange-100"
                href="/truck-dispatch"
              >
                <div className="font-bold text-orange-950">LKW-Disposition</div>
                <div className="mt-1 text-sm text-orange-800">
                  LKW, Anhänger und Transporte disponieren.
                </div>
              </Link>
              <a
                className="rounded-2xl border border-gray-200 bg-gray-50 p-4 hover:bg-gray-100"
                href="#inventory-assignment"
              >
                <div className="font-bold text-gray-950">
                  Manuelle Zuordnung
                </div>
                <div className="mt-1 text-sm text-gray-700">
                  Legt fest, welcher Kolonne oder welchem Mitarbeiter das
                  Objekt grundsätzlich zugeordnet ist.
                </div>
              </a>
            </div>
          </div>
        </DismissibleDetails>
        <span className="inline-flex items-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700">
          Standort: {getCurrentLocationLabel(item)}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm xl:col-span-2">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                Inventarobjekt
              </p>
              <h2 className="mt-1 text-2xl font-bold text-gray-950">
                {item.name}
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                {[item.manufacturer, item.model].filter(Boolean).join(" · ") ||
                  "Keine Hersteller-/Modellangaben"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {item.isContainer ? (
                <Badge tone="blue">Containerobjekt</Badge>
              ) : null}
              {item.isStockManaged ? (
                <Badge tone="yellow">Lagergeführt</Badge>
              ) : null}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
            <Info label="Kategorie" value={getInventoryCategoryLabel(item.category)} />
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                Status
              </dt>
              <dd className="mt-1">
                <span
                  className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${getInventoryStatusClass(
                    item.status,
                  )}`}
                >
                  {getInventoryStatusLabel(item.status)}
                </span>
              </dd>
            </div>
            <Info label="Objekt-ID" value={item.objectNumber ?? "—"} />
            <Info label="Inventarnummer" value={item.inventoryNumber ?? "—"} />
            <Info label="STIX-ID" value={item.stixId ?? "—"} />
            <Info label="Kennzeichen" value={item.licensePlate ?? "—"} />
            <Info label="Seriennummer" value={item.serialNumber ?? "—"} />
            <Info label="Hersteller" value={item.manufacturer ?? "—"} />
            <Info label="Typ/Modell" value={item.model ?? "—"} />
            <Info
              label="Anzahl Achsen"
              value={item.axleCount !== null ? String(item.axleCount) : "—"}
            />
            <Info
              label="Zul. Gesamtgewicht"
              value={formatKilograms(item.grossWeightKg)}
            />
            <Info label="Nutzlast" value={formatTonsFromKilograms(item.payloadKg)} />
            <Info
              label="Antrieb / Fahrwerk"
              value={getDriveTypeLabel(item.driveType)}
            />
            <Info label="Aufnahmetyp" value={item.attachmentType ?? "—"} />
            <Info
              label="Kraftstofftank"
              value={
                item.fuelTankLiters !== null
                  ? `${formatNumber(item.fuelTankLiters)} l`
                  : "—"
              }
            />
            <Info
              label="Arbeitsmitteltank"
              value={
                item.workMaterialTankLiters !== null
                  ? `${formatNumber(item.workMaterialTankLiters)} l`
                  : "—"
              }
            />
            <Info
              label="Baujahr"
              value={
                item.constructionYear
                  ? String(item.constructionYear)
                  : formatDate(item.constructionDate)
              }
            />
            <Info label="Erhalten am" value={formatDate(item.receivedAt)} />
            <Info label="Gekauft am" value={formatDate(item.purchasedAt)} />
            <Info label="Gekauft bei" value={item.purchasedFrom ?? "—"} />
            <Info
              label="Rechnungsnummer"
              value={item.invoiceNumber ?? "—"}
            />
            <Info
              label="Lieferscheinnummer"
              value={item.deliveryNoteNumber ?? "—"}
            />
            <Info
              label="Verrechnungssatz €/Einheit"
              value={formatMoney(item.billingRateCents)}
            />
            <Info
              label="Verrechnungssatz stillgelegt €/Einheit"
              value={formatMoney(item.idleBillingRateCents)}
            />
            <Info
              label="Aktueller Standort"
              value={getCurrentLocationLabel(item)}
            />
            <Info label="Verantwortlich" value={getResponsibleLabel(item)} />
            {item.employeeAssignments.length > 0 ? (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Weitere Mitarbeiter / Fahrer
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {item.employeeAssignments.map((assignment) => (
                    <a
                      className="rounded-full bg-blue-50 px-2.5 py-1 text-sm font-semibold text-blue-900 hover:bg-blue-100"
                      href={`/employees/certificates/${assignment.employee.id}`}
                      key={assignment.id}
                    >
                      {assignment.employee.lastName},{" "}
                      {assignment.employee.firstName}
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
            <Info
              label="Aktuelle Baustelle"
              value={
                item.currentProject
                  ? `${item.currentProject.projectNumber} · ${item.currentProject.name}`
                  : "—"
              }
            />
            <Info
              label="Verknüpftes Fahrzeug/Gerät"
              value={
                item.vehicle
                  ? [
                      item.vehicle.vehicleNumber,
                      item.vehicle.licensePlate,
                      item.vehicle.vehicleType,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : "—"
              }
            />
            <Info
              label="Liegt in Container"
              value={
                item.parentItem
                  ? [
                      item.parentItem.objectNumber,
                      item.parentItem.inventoryNumber,
                      item.parentItem.name,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : "—"
              }
            />
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 md:col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                Containerstatus
              </dt>
              <dd className="mt-2 flex flex-wrap gap-2">
                {item.isContainer ? (
                  <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-900 ring-1 ring-blue-200">
                    Containerobjekt · {item.childItems.length} enthalten
                  </span>
                ) : null}
                {item.parentItem ? (
                  <Link
                    className="inline-flex rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-900 ring-1 ring-indigo-200 hover:bg-indigo-200"
                    href={`/inventory/${item.parentItem.id}`}
                  >
                    Liegt in Containerobjekt:{" "}
                    {[item.parentItem.objectNumber, item.parentItem.inventoryNumber, item.parentItem.name]
                      .filter(Boolean)
                      .join(" · ")}
                  </Link>
                ) : null}
                {!item.isContainer && !item.parentItem ? (
                  <span className="text-sm text-gray-500">
                    Kein Containerobjekt und keinem Container zugewiesen.
                  </span>
                ) : null}
              </dd>
            </div>
          </div>

          {item.parentItem ? (
            <Link
              className="mt-5 block rounded-2xl border border-blue-100 bg-blue-50 p-4 hover:border-blue-200 hover:bg-blue-100"
              href={`/inventory/${item.parentItem.id}`}
            >
              <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                Gehört zu Containerobjekt
              </div>
              <div className="mt-1 text-lg font-bold text-blue-950">
                {[item.parentItem.objectNumber, item.parentItem.inventoryNumber, item.parentItem.name]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
              <div className="mt-1 text-sm text-blue-800">
                Container öffnen →
              </div>
            </Link>
          ) : null}

          {item.notes ? (
            <div className="mt-5 rounded-2xl bg-gray-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Notizen
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-800">
                {item.notes}
              </p>
            </div>
          ) : null}
        </section>

        <div className="space-y-6">
          <InventoryPhotoPreviewPanel itemName={item.name} photos={inventoryPhotos} />

          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  ECC200 / DataMatrix
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  Kurzer Codeinhalt für robuste Handy-Scans und spätere Etiketten.
                </p>
              </div>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-700">
                ECC200
              </span>
            </div>

            <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <img
                alt={`ECC200 DataMatrix-Code für ${item.name}`}
                className="mx-auto h-auto w-full max-w-64 rounded-xl bg-white p-3"
                src={`/inventory/${item.id}/qr`}
              />
            </div>

            <div className="mt-4 rounded-xl bg-gray-50 p-3 text-xs text-gray-600">
              Objekt-ID:{" "}
              <span className="font-mono font-semibold text-gray-900">
                {item.objectNumber ?? "noch nicht vergeben"}
              </span>
              <br />
              Codeinhalt:{" "}
              <span className="break-all font-mono text-gray-900">
                {item.objectNumber ?? item.inventoryNumber ?? item.id}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <a
                className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                href={`/inventory/${item.id}/qr?download=1`}
              >
                ECC200 SVG laden
              </a>
              <a
                className="inline-flex items-center justify-center rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
                href={`/inventory/${item.id}/qr?format=png&download=1`}
              >
                ECC200 PNG laden
              </a>
              <a
                className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                href={`/inventory/${item.id}/qr?type=qr&download=1`}
              >
                QR SVG laden
              </a>
              <a
                className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                href={`/inventory/${item.id}/qr?type=qr&format=png&download=1`}
              >
                QR PNG laden
              </a>
            </div>
          </section>
        </div>
      </div>

      {item.isStockManaged ? (
        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">Lagerstatus</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Info
              label="Anfangsbestand"
              value={formatStock(item.openingStock, item.stockUnit)}
            />
            <Info
              label="Aktueller Bestand"
              value={formatStock(item.currentStock, item.stockUnit)}
            />
            <Info label="Einheit" value={item.stockUnit} />
            <Info
              label="Lagerobjekt"
              value={item.isStockManaged ? "Ja" : "Nein"}
            />
          </div>
        </section>
      ) : null}

      {item.category?.isPersonalInventory ||
      item.category?.parentCategory?.isPersonalInventory ? (
        <PersonalInventoryPanel
          assignments={item.personalAssignments
            .filter((assignment) => assignment.status === "ISSUED")
            .map((assignment) => ({
              employeeName: `${assignment.employee.lastName}, ${assignment.employee.firstName}`,
              id: assignment.id,
              issuedAt: formatDate(assignment.issuedAt),
              quantity: assignment.quantity,
              returnedQuantity: assignment.returnedQuantity,
            }))}
          currentStock={item.currentStock}
          employees={allEmployees}
          inventoryManagers={inventoryManagers}
          isStockManaged={item.isStockManaged}
          itemId={item.id}
          stockUnit={item.stockUnit}
        />
      ) : null}

      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Stilllegungszeiträume
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Für diese Zeiträume wird später in der Leistungsmeldung der
              reduzierte Stilllegungs-Verrechnungssatz verwendet.
            </p>
          </div>
          <InventoryIdlePeriodsDialog itemId={item.id} periods={idlePeriods} />
        </div>

        {item.idlePeriods.length > 0 ? (
          <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="p-3">Von</th>
                  <th className="p-3">Bis</th>
                  <th className="p-3">Bemerkung</th>
                  <th className="p-3">Satz</th>
                </tr>
              </thead>
              <tbody>
                {item.idlePeriods.map((period) => (
                  <tr className="border-t border-gray-100" key={period.id}>
                    <td className="p-3 text-gray-900">
                      {formatDate(period.startsAt)}
                    </td>
                    <td className="p-3 text-gray-900">
                      {formatDate(period.endsAt)}
                    </td>
                    <td className="p-3 text-gray-700">
                      {period.notes ?? "—"}
                    </td>
                    <td className="p-3 font-semibold text-gray-900">
                      {formatMoney(item.idleBillingRateCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-5 text-sm text-gray-500">
            Noch keine Stilllegungszeiträume erfasst.
          </div>
        )}
      </section>

      <section
        className="mt-6 scroll-mt-28 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
        id="inventory-assignment"
      >
        <h2 className="text-xl font-semibold text-gray-900">
          Zuweisung
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Hier wird gepflegt, ob das Objekt grundsätzlich zu einer Kolonne oder
          zu einem Mitarbeiter gehört. Die Baustelle ergibt sich aus Planung,
          Kolonnenzuordnung, Gerätedisposition oder LKW-Disposition.
        </p>

        <form
          action={updateInventoryAssignment}
          className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"
        >
          <input name="id" type="hidden" value={item.id} />
          <label className="text-sm font-semibold text-gray-800">
            Verantwortlicher Mitarbeiter/Fahrer
            <select
              className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              defaultValue={item.responsibleEmployeeId ?? "__none"}
              name="responsibleEmployeeId"
            >
              <option value="__none">Kein Mitarbeiter</option>
              {allEmployees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.lastName}, {employee.firstName}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-gray-800">
            Zugeordnete Kolonne
            <select
              className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              defaultValue={item.responsibleCrewId ?? "__none"}
              name="responsibleCrewId"
            >
              <option value="__none">Keine Kolonne</option>
              {crews.map((crew) => (
                <option key={crew.id} value={crew.id}>
                  {crew.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-gray-800 md:col-span-2">
            Bemerkung
            <input
              className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
              name="notes"
              placeholder="z.B. gehört dauerhaft zur Kolonne Asphalt, persönliches Werkzeug..."
            />
          </label>
          <div className="flex items-end">
            <button
              className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
              type="submit"
            >
              Zuweisung speichern
            </button>
          </div>
        </form>
      </section>

      {item.isStockManaged &&
      !item.category?.isPersonalInventory &&
      !item.category?.parentCategory?.isPersonalInventory ? (
        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">
            Lagerbewegung
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Ausgabe, Rücknahme oder Bestandskorrektur für dieses Lagerobjekt.
          </p>
          <InventoryStockMovementForm
            currentProjectId={item.currentProjectId}
            employees={allEmployees}
            itemId={item.id}
            projects={projects}
            stockUnit={item.stockUnit}
          />
        </section>
      ) : null}

      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">
          Werkstatt / Wartung
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
            <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-gray-700">
              Letzter Service
            </h3>
            <div className="mt-3 space-y-2">
              <Info
                label="Betriebsstunden"
                value={formatNumber(item.lastServiceOperatingHours)}
              />
              <Info
                label="Kilometer"
                value={formatNumber(item.lastServiceMileageKm)}
              />
              <Info label="Datum" value={formatDate(item.lastServiceAtDate)} />
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
            <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-gray-700">
              Nächster Service
            </h3>
            <div className="mt-3 space-y-2">
              <Info
                label="Betriebsstunden"
                value={formatNumber(item.nextServiceOperatingHours)}
              />
              <Info
                label="Kilometer"
                value={formatNumber(item.nextServiceMileageKm)}
              />
              <Info label="Datum" value={formatDate(item.nextServiceAtDate)} />
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 md:col-span-2">
            <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-gray-700">
              Prüfungen
            </h3>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <InspectionInfo
                lastDate={item.lastDguvInspectionDate}
                nextDate={item.nextDguvInspectionDate}
                title="DGUV"
              />
              <InspectionInfo
                lastDate={item.lastTuvInspectionDate}
                nextDate={item.nextTuvInspectionDate}
                title="TÜV"
              />
              <InspectionInfo
                lastDate={item.lastTachographInspectionDate}
                nextDate={item.nextTachographInspectionDate}
                title="Tachoprüfung"
              />
              <InspectionInfo
                lastDate={item.lastSafetyInspectionDate}
                nextDate={item.nextSafetyInspectionDate}
                title="SP"
              />
              <InspectionInfo
                lastDate={item.lastAdrInspectionDate}
                nextDate={item.nextAdrInspectionDate}
                title="ADR"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-red-100 bg-red-50/40 p-6 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-950">
              Defekt / Werkstattauftrag
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Wähle zuerst eine aktuelle Vorlage aus dem Bereich Werkstatt.
              Neue oder gelöschte Werkstattformulare werden hier automatisch
              übernommen.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <InventoryWorkshopFormDialog
              defaultVehicleId={item.vehicleId ?? ""}
              inventoryItemId={item.id}
              itemLabel={itemLabel || item.name}
              personnel={workshopPersonnelOptions}
              repairOrderDescription={
                repairTemplate?.description ??
                "Reparatur, Wartung oder Störung erfassen und einplanen."
              }
              repairOrderForm={
                <WorkshopOrderForm
                  action={createWorkshopRepairOrder}
                  allowCompletionFields={false}
                  defaultCustomValues={{}}
                  defaultDescription={defaultRepairDescription}
                  defaultInventoryItemId={item.id}
                  defaultPriority="HIGH"
                  defaultTitle={`Defekt: ${itemLabel || item.name}`}
                  defaultVehicleId={item.vehicleId ?? ""}
                  personnel={workshopPersonnelOptions}
                  repairTemplateFields={repairTemplateFields}
                  vehicles={workshopVehicles}
                />
              }
              repairOrderTitle={repairTemplate?.name ?? "Reparaturauftrag"}
              templates={workshopFormTemplates}
              vehicles={workshopVehicles}
            />
            <Link
              className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              href="/workshop"
            >
              Werkstatt öffnen →
            </Link>
          </div>
        </div>
      </section>

      {item.isContainer ? (
        <InventoryContainerManager
          assignableItems={assignableContainerItems}
          childItems={item.childItems}
          container={{
            id: item.id,
            inventoryNumber: item.inventoryNumber,
            name: item.name,
            objectNumber: item.objectNumber,
          }}
        />
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">
            Kontakte / Ansprechpartner
          </h2>
          {item.contacts.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">
              Noch keine Ansprechpartner hinterlegt.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {item.contacts.map((contact) => (
                <div
                  className="rounded-xl border border-gray-200 bg-gray-50 p-3"
                  key={contact.id}
                >
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {contact.role}
                  </div>
                  <div className="mt-1 font-semibold text-gray-900">
                    {[
                      contact.company,
                      [contact.salutation, contact.firstName, contact.lastName]
                        .filter(Boolean)
                        .join(" ") || contact.name,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Ohne Name"}
                  </div>
                  <div className="mt-2 text-sm leading-6 text-gray-600">
                    {contact.phone ? <div>Telefon: {contact.phone}</div> : null}
                    {contact.mobilePhone ? (
                      <div>Mobil: {contact.mobilePhone}</div>
                    ) : null}
                    {contact.email ? <div>E-Mail: {contact.email}</div> : null}
                    {contact.website ? (
                      <div>Website: {contact.website}</div>
                    ) : null}
                    {contact.notes ? <div>Notiz: {contact.notes}</div> : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">
          Nutzungsinformationen / Historie
        </h2>
        {item.usageHistory.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">
            Noch keine Historie vorhanden. Ausgabe, Rücknahme, Transport und
            Defektmeldungen werden im nächsten Schritt aktiv befüllbar.
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            {item.usageHistory.map((entry) => (
              <div
                className="rounded-xl border border-gray-200 bg-gray-50 p-3"
                key={entry.id}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${getHistoryEventClass(
                      entry.eventType,
                    )}`}
                  >
                    {getHistoryEventLabel(entry.eventType)}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatCreatedAt(entry.createdAt)}
                  </span>
                </div>
                <div className="mt-1 text-sm text-gray-600">
                  {entry.employee
                    ? `${entry.employee.lastName}, ${entry.employee.firstName}`
                    : "kein Mitarbeiter"}{" "}
                  · {entry.project?.name ?? "keine Baustelle"}
                  {entry.transportedByEmployee ? (
                    <>
                      {" "}
                      · Transport: {entry.transportedByEmployee.lastName},{" "}
                      {entry.transportedByEmployee.firstName}
                    </>
                  ) : null}
                </div>
                {formatStockChange(
                  entry.quantity,
                  entry.stockBefore,
                  entry.stockAfter,
                  item.stockUnit,
                ) ? (
                  <div className="mt-1 text-sm font-semibold text-gray-800">
                    {formatStockChange(
                      entry.quantity,
                      entry.stockBefore,
                      entry.stockAfter,
                      item.stockUnit,
                    )}
                  </div>
                ) : null}
                {entry.notes ? (
                  <div className="mt-1 text-sm text-gray-600">
                    {entry.notes}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Scan-Historie</h2>
            <p className="mt-1 text-sm text-gray-600">
              Letzte Code-Scans dieses Inventarobjekts mit Standort, sofern erlaubt.
            </p>
          </div>
          <Link
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            href="/inventory/scanner"
          >
            Scanner öffnen
          </Link>
        </div>

        {item.scanLogs.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">
            Noch keine Scans protokolliert.
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
            {item.scanLogs.map((scan) => (
              <div
                className="rounded-xl border border-gray-200 bg-gray-50 p-4"
                key={scan.id}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-gray-900 px-2.5 py-1 text-xs font-bold text-white">
                    {scan.action}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatCreatedAt(scan.createdAt)}
                  </span>
                </div>
                <div className="mt-2 text-sm font-semibold text-gray-900">
                  {scan.scannedByName || "Unbekannt"}
                </div>
                <div className="mt-1 space-y-1 text-xs leading-5 text-gray-600">
                  {scan.latitude !== null && scan.longitude !== null ? (
                    <>
                      <div>
                        Standort:{" "}
                        <span className="font-semibold text-gray-800">
                          {formatScanLocationAddress(scan)}
                        </span>
                      </div>
                      <div>
                        GPS: {formatCoordinate(scan.latitude)},{" "}
                        {formatCoordinate(scan.longitude)}
                        {scan.accuracyMeters !== null
                          ? ` · Genauigkeit ca. ${formatNumber(scan.accuracyMeters)} m`
                          : ""}
                      </div>
                      <details className="mt-2 rounded-xl border border-gray-200 bg-white p-2">
                        <summary className="cursor-pointer text-xs font-bold text-gray-700">
                          Kartenausschnitt anzeigen
                        </summary>
                        <div className="mt-2 overflow-hidden rounded-lg border border-gray-200">
                          <iframe
                            className="h-48 w-full"
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                            src={getOpenStreetMapEmbedUrl(
                              scan.latitude,
                              scan.longitude,
                            )}
                            title={`Karte Scan ${scan.id}`}
                          />
                        </div>
                        <a
                          className="mt-2 inline-flex text-xs font-semibold text-blue-700 hover:underline"
                          href={getOpenStreetMapUrl(scan.latitude, scan.longitude)}
                          rel="noreferrer"
                          target="_blank"
                        >
                          In OpenStreetMap öffnen →
                        </a>
                      </details>
                    </>
                  ) : (
                    <div>Standort: nicht erfasst</div>
                  )}
                  {scan.rawValue ? (
                    <div className="break-all font-mono">Code: {scan.rawValue}</div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-600">
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <span>
            <span className="font-semibold text-gray-800">Angelegt am:</span>{" "}
            {formatCreatedAt(item.createdAt)}
          </span>
          <span>
            <span className="font-semibold text-gray-800">Angelegt von:</span>{" "}
            Benutzer
          </span>
        </div>
      </section>
    </AppShell>
  );
}

function InspectionInfo({
  lastDate,
  nextDate,
  title,
}: {
  lastDate: Date | null;
  nextDate: Date | null;
  title: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <div className="text-xs font-bold uppercase tracking-[0.12em] text-gray-700">
        {title}
      </div>
      <div className="mt-2 space-y-1.5">
        <Info label="Letzte" value={formatDate(lastDate)} />
        <Info label="Nächste" value={formatDate(nextDate)} />
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-gray-900">{value}</div>
    </div>
  );
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "blue" | "yellow";
}) {
  const className =
    tone === "blue"
      ? "bg-blue-100 text-blue-900"
      : "bg-yellow-100 text-yellow-900";

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold ${className}`}>
      {children}
    </span>
  );
}
