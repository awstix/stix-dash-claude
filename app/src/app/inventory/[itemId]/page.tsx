import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { InventoryContainerManager } from "../InventoryContainerManager";
import { InventoryPhotoGallery } from "../InventoryPhotoGallery";

function formatDate(date: Date | null) {
  if (!date) return "—";

  return new Intl.DateTimeFormat("de-DE").format(date);
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

function formatNumber(value: number | null) {
  if (value === null) return "—";

  return new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 2,
  }).format(value);
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

export default async function InventoryDetailPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = await params;

  const item = await prisma.inventoryItem.findUnique({
    where: {
      id: itemId,
    },
    include: {
      category: true,
      childItems: {
        include: {
          category: true,
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
      parentItem: true,
      photos: {
        orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
      },
      responsibleCrew: true,
      responsibleEmployee: true,
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
      description="Inventarobjekt mit Stammdaten, Zuordnung, Fotos, Ansprechpartnern und Historie."
    >
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
            <Info label="Kategorie" value={item.category?.name ?? "—"} />
            <Info label="Inventarnummer" value={item.inventoryNumber ?? "—"} />
            <Info label="Seriennummer" value={item.serialNumber ?? "—"} />
            <Info label="Hersteller" value={item.manufacturer ?? "—"} />
            <Info label="Typ/Modell" value={item.model ?? "—"} />
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
              label="Verrechnungssatz"
              value={formatMoney(item.billingRateCents)}
            />
            <Info label="Verantwortlich" value={getResponsibleLabel(item)} />
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
                      item.parentItem.inventoryNumber,
                      item.parentItem.name,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : "—"
              }
            />
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
                {[item.parentItem.inventoryNumber, item.parentItem.name]
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

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">Lagerstatus</h2>
          {item.isStockManaged ? (
            <div className="mt-4 space-y-3">
              <Info
                label="Anfangsbestand"
                value={formatStock(item.openingStock, item.stockUnit)}
              />
              <Info
                label="Aktueller Bestand"
                value={formatStock(item.currentStock, item.stockUnit)}
              />
            </div>
          ) : (
            <p className="mt-4 text-sm text-gray-500">
              Dieses Objekt wird aktuell nicht in der Lagerverwaltung geführt.
            </p>
          )}
        </section>
      </div>

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

          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
            <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-gray-700">
              DGUV-Prüfung
            </h3>
            <div className="mt-3 space-y-2">
              <Info
                label="Letzte Prüfung"
                value={formatDate(item.lastDguvInspectionDate)}
              />
              <Info
                label="Nächste Prüfung"
                value={formatDate(item.nextDguvInspectionDate)}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
            <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-gray-700">
              TÜV-Prüfung
            </h3>
            <div className="mt-3 space-y-2">
              <Info
                label="Letzte Prüfung"
                value={formatDate(item.lastTuvInspectionDate)}
              />
              <Info
                label="Nächste Prüfung"
                value={formatDate(item.nextTuvInspectionDate)}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">Fotos</h2>
        <InventoryPhotoGallery
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
      </section>

      {item.isContainer ? (
        <InventoryContainerManager
          assignableItems={assignableContainerItems}
          childItems={item.childItems}
          container={{
            id: item.id,
            inventoryNumber: item.inventoryNumber,
            name: item.name,
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
                <div className="font-semibold text-gray-900">
                  {entry.eventType}
                </div>
                <div className="mt-1 text-sm text-gray-600">
                  {entry.employee
                    ? `${entry.employee.lastName}, ${entry.employee.firstName}`
                    : "kein Mitarbeiter"}{" "}
                  · {entry.project?.name ?? "keine Baustelle"}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </AppShell>
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
