import { InventoryContactFields } from "./InventoryContactFields";
import { InventoryPhotoUploadFields } from "./InventoryPhotoUploadFields";
import { SearchableInventorySelect } from "./SearchableInventorySelect";
import {
  getInventoryCategoryOptionLabel,
  sortInventoryCategoriesForSelect,
} from "@/lib/inventory-categories";

export type InventoryItemFormData = {
  billingRateCents: number | null;
  categoryId: string | null;
  constructionDate: Date | null;
  constructionYear: number | null;
  axleCount: number | null;
  contacts?: {
    company: string | null;
    email: string | null;
    firstName: string | null;
    id: string;
    lastName: string | null;
    mobilePhone: string | null;
    name: string | null;
    notes: string | null;
    phone: string | null;
    role: string;
    salutation: string | null;
    website: string | null;
  }[];
  currentProjectId: string | null;
  currentStock: number | null;
  deliveryNoteNumber: string | null;
  driveType: string | null;
  grossWeightKg: number | null;
  id: string;
  inventoryNumber: string | null;
  invoiceNumber: string | null;
  isContainer: boolean;
  isStockManaged: boolean;
  licensePlate: string | null;
  lastDguvInspectionDate: Date | null;
  lastServiceAtDate: Date | null;
  lastServiceMileageKm: number | null;
  lastServiceOperatingHours: number | null;
  lastTuvInspectionDate: Date | null;
  manufacturer: string | null;
  model: string | null;
  name: string;
  nextDguvInspectionDate: Date | null;
  nextServiceAtDate: Date | null;
  nextServiceMileageKm: number | null;
  nextServiceOperatingHours: number | null;
  nextTuvInspectionDate: Date | null;
  notes: string | null;
  objectNumber: string | null;
  openingStock: number | null;
  parentItemId: string | null;
  payloadKg: number | null;
  photos?: {
    fileName: string;
    id: string;
    isPrimary: boolean;
    originalName: string | null;
    url: string;
  }[];
  purchasedAt: Date | null;
  purchasedFrom: string | null;
  receivedAt: Date | null;
  responsibleCrewId: string | null;
  responsibleEmployeeId: string | null;
  responsibleType: string | null;
  serialNumber: string | null;
  status: string;
  stockUnit: string;
  vehicleId: string | null;
};

function formatDateInput(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : "";
}

function formatNumber(value: number | null) {
  if (value === null) return "";

  return new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 3,
  }).format(value);
}

function formatTonsInput(value: number | null) {
  if (value === null) return "";

  return String(value / 1000);
}

export function InventoryItemForm({
  action,
  categories,
  containerOptions,
  crews,
  defaultParentItemId = null,
  employees,
  item,
  layout = "grid",
  vehicles,
}: {
  action: (formData: FormData) => void | Promise<void>;
  categories: { id: string; name: string; parentCategoryId: string | null }[];
  containerOptions: { id: string; name: string }[];
  crews: { id: string; name: string }[];
  defaultParentItemId?: string | null;
  employees: { firstName: string; id: string; lastName: string }[];
  item?: InventoryItemFormData;
  layout?: "grid" | "stacked";
  projects: { id: string; name: string; projectNumber: string }[];
  vehicles: {
    id: string;
    licensePlate: string | null;
    vehicleNumber: string;
    vehicleType: string;
  }[];
}) {
  const sortedCategories = sortInventoryCategoriesForSelect(categories);
  const sectionClass =
    layout === "stacked"
      ? "rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
      : "contents";
  const gridClass =
    layout === "stacked"
      ? "mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
      : "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6";
  const fieldGroupClass =
    layout === "stacked"
      ? "rounded-2xl border border-gray-100 bg-gray-50 p-4"
      : "contents";
  const innerGridClass =
    layout === "stacked"
      ? "mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
      : gridClass;

  return (
    <form action={action} className="mt-6 space-y-5">
      {item ? <input name="id" type="hidden" value={item.id} /> : null}

      <section className={sectionClass}>
        {layout === "stacked" ? (
          <SectionHeader
            description="Grunddaten, Nummern und technische Angaben."
            title="Stammdaten"
          />
        ) : null}
        <div className={layout === "stacked" ? "mt-4 space-y-4" : gridClass}>
          <div className={fieldGroupClass}>
            {layout === "stacked" ? (
              <FieldGroupHeader
                description="Was ist das Objekt und in welche Inventarkategorie gehört es?"
                title="Allgemein"
              />
            ) : null}
            <div className={innerGridClass}>
              <Input
                className={layout === "stacked" ? "xl:col-span-2" : "xl:col-span-2"}
                defaultValue={item?.name ?? ""}
                label="Name"
                name="name"
                required
              />
              <Select
                defaultValue={item?.categoryId ?? "__none"}
                label="Kategorie"
                name="categoryId"
              >
                <option value="__none">Keine Kategorie</option>
                {sortedCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {getInventoryCategoryOptionLabel(category)}
                  </option>
                ))}
              </Select>
              <Select
                defaultValue={item?.status ?? "ACTIVE"}
                label="Status"
                name="status"
              >
                <option value="ACTIVE">Aktiv</option>
                <option value="DEFECT">Defekt</option>
                <option value="IN_SERVICE">In Wartung</option>
                <option value="LOCKED">Gesperrt</option>
              </Select>
            </div>
          </div>

          <div className={fieldGroupClass}>
            {layout === "stacked" ? (
              <FieldGroupHeader
                description="Nummern, die später auf Etiketten, QR/DataMatrix-Code oder Prüfunterlagen helfen."
                title="Kennzeichnung"
              />
            ) : null}
            <div className={innerGridClass}>
              <Input
                defaultValue={item?.objectNumber ?? ""}
                label="Objekt-ID"
                name="objectNumber"
                placeholder="leer = automatisch"
              />
              <Input
                defaultValue={item?.inventoryNumber ?? ""}
                label="Inventarnummer"
                name="inventoryNumber"
              />
              <Input
                defaultValue={item?.serialNumber ?? ""}
                label="Seriennummer"
                name="serialNumber"
              />
              <Input
                defaultValue={item?.licensePlate ?? ""}
                label="Kennzeichen"
                name="licensePlate"
                placeholder="z.B. AB-ST 123"
              />
            </div>
          </div>

          <div className={fieldGroupClass}>
            {layout === "stacked" ? (
              <FieldGroupHeader
                description="Technische Basisdaten, soweit bekannt."
                title="Hersteller / Modell"
              />
            ) : null}
            <div className={innerGridClass}>
              <Input
                defaultValue={item?.manufacturer ?? ""}
                label="Hersteller"
                name="manufacturer"
              />
              <Input
                defaultValue={item?.model ?? ""}
                label="Typ/Modell"
                name="model"
              />
              <Input
                defaultValue={formatDateInput(item?.constructionDate ?? null)}
                label="Baujahr / Baudatum"
                name="constructionDate"
                type="date"
              />
              <Input
                defaultValue={formatDateInput(item?.receivedAt ?? null)}
                label="Erhalten am"
                name="receivedAt"
                type="date"
              />
            </div>
          </div>

          <div className={fieldGroupClass}>
            {layout === "stacked" ? (
              <FieldGroupHeader
                description="Kaufdatum, Lieferant und Belegnummern."
                title="Beschaffung"
              />
            ) : null}
            <div className={innerGridClass}>
              <Input
                defaultValue={formatDateInput(item?.purchasedAt ?? null)}
                label="Gekauft am"
                name="purchasedAt"
                type="date"
              />
              <Input
                defaultValue={item?.purchasedFrom ?? ""}
                label="Gekauft bei"
                name="purchasedFrom"
              />
              <Input
                defaultValue={item?.invoiceNumber ?? ""}
                label="Rechnungsnummer"
                name="invoiceNumber"
              />
              <Input
                defaultValue={item?.deliveryNoteNumber ?? ""}
                label="Lieferscheinnummer"
                name="deliveryNoteNumber"
              />
            </div>
          </div>

          <div className={fieldGroupClass}>
            {layout === "stacked" ? (
              <FieldGroupHeader
                description="Optionale Angaben für LKW, Baumaschinen und spätere Disposition."
                title="Dispo- / Fahrzeugdaten"
              />
            ) : null}
            <div className={innerGridClass}>
              <Input
                defaultValue={item?.axleCount?.toString() ?? ""}
                label="Anzahl Achsen"
                name="axleCount"
                type="number"
              />
              <Input
                defaultValue={item?.grossWeightKg?.toString() ?? ""}
                label="Zul. Gesamtgewicht kg"
                name="grossWeightKg"
                type="number"
              />
              <Input
                defaultValue={formatTonsInput(item?.payloadKg ?? null)}
                label="Nutzlast t"
                name="payloadTons"
                placeholder="z.B. 13.5"
                step="0.001"
                type="number"
              />
              <Select
                defaultValue={item?.driveType ?? "__none"}
                label="Antrieb / Fahrwerk"
                name="driveType"
              >
                <option value="__none">Nicht angegeben</option>
                <option value="WHEEL">Rad</option>
                <option value="TRACK">Kette</option>
                <option value="WHEEL_AND_TRACK">Rad/Kette</option>
                <option value="TRAILER">Anhänger / gezogen</option>
                <option value="OTHER">Sonstiges</option>
              </Select>
            </div>
          </div>

          <div className={fieldGroupClass}>
            {layout === "stacked" ? (
              <FieldGroupHeader
                description="Nur für Auswertung/Controlling. Später kann das über Rechte ausgeblendet werden."
                title="Controlling"
              />
            ) : null}
            <div className={innerGridClass}>
              <Input
                defaultValue={
                  item?.billingRateCents
                    ? String(item.billingRateCents / 100)
                    : ""
                }
                label="Verrechnungssatz €/h"
                name="billingRate"
                type="number"
              />
            </div>
          </div>
        </div>
      </section>

      <section className={sectionClass}>
        {layout === "stacked" ? (
          <SectionHeader
            description="Wer ist grundsätzlich für das Objekt verantwortlich?"
            title="Zuordnung"
          />
        ) : null}
        <div className={layout === "stacked" ? "mt-4 space-y-4" : gridClass}>
          <div className={fieldGroupClass}>
            {layout === "stacked" ? (
              <FieldGroupHeader
                description="Mitarbeiter oder Kolonne, die aktuell für das Objekt verantwortlich ist."
                title="Verantwortlicher"
              />
            ) : null}
            <div className={innerGridClass}>
              <Select
                defaultValue={item?.responsibleType ?? "__none"}
                label="Verantwortlicher Typ"
                name="responsibleType"
              >
                <option value="__none">Nicht zugeordnet</option>
                <option value="EMPLOYEE">Mitarbeiter</option>
                <option value="CREW">Kolonne</option>
              </Select>
              <Select
                defaultValue={item?.responsibleEmployeeId ?? "__none"}
                label="Mitarbeiter"
                name="responsibleEmployeeId"
              >
                <option value="__none">Kein Mitarbeiter</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.lastName}, {employee.firstName}
                  </option>
                ))}
              </Select>
              <Select
                defaultValue={item?.responsibleCrewId ?? "__none"}
                label="Kolonne"
                name="responsibleCrewId"
              >
                <option value="__none">Keine Kolonne</option>
                {crews.map((crew) => (
                  <option key={crew.id} value={crew.id}>
                    {crew.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className={fieldGroupClass}>
            {layout === "stacked" ? (
              <FieldGroupHeader
                description="Nur Übergang: bleibt, bis Dispo, BTB und Werkstatt vollständig auf Inventarobjekte umgestellt sind."
                title="Alt-Stammdaten-Verknüpfung"
              />
            ) : null}
            <div className={innerGridClass}>
              <input
                name="currentProjectId"
                type="hidden"
                value={item?.currentProjectId ?? "__none"}
              />
              <Select
                className={layout === "stacked" ? "" : "xl:col-span-3"}
                defaultValue={item?.vehicleId ?? "__none"}
                label="Altes Fahrzeug/Gerät verknüpfen"
                name="vehicleId"
              >
                <option value="__none">Keine Verknüpfung</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.vehicleNumber}
                    {vehicle.licensePlate ? ` · ${vehicle.licensePlate}` : ""} ·{" "}
                    {vehicle.vehicleType}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>
      </section>

      <section className={sectionClass}>
        {layout === "stacked" ? (
          <SectionHeader
            description="Einheit für Material/Schüttgut, Lagerbestand und Containerobjekte."
            title="Einheit, Container und Lager"
          />
        ) : null}
        <div className={layout === "stacked" ? "mt-4 space-y-4" : gridClass}>
          <div className={fieldGroupClass}>
            {layout === "stacked" ? (
              <FieldGroupHeader
                description="Zum Beispiel Bagger mit Löffeln oder Anbaugeräten als enthaltene Objekte."
                title="Containerobjekt"
              />
            ) : null}
            <div
              className={
                layout === "stacked"
                  ? "grid grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]"
                  : "grid grid-cols-1 gap-4 xl:col-span-6 xl:grid-cols-[280px_minmax(0,1fr)]"
              }
            >
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                <label className="flex items-start gap-3 text-sm font-semibold text-blue-950">
                  <input
                    className="mt-1 h-4 w-4 rounded border-blue-300"
                    defaultChecked={item?.isContainer ?? false}
                    name="isContainer"
                    type="checkbox"
                  />
                  <span>
                    Ist Containerobjekt
                    <span className="mt-1 block text-xs font-normal leading-5 text-blue-800">
                      Dieses Objekt kann weitere Objekte enthalten.
                    </span>
                  </span>
                </label>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <SearchableInventorySelect
                  defaultValue={item?.parentItemId ?? defaultParentItemId ?? "__none"}
                  label="Einem Containerobjekt zuweisen"
                  name="parentItemId"
                  options={containerOptions}
                  placeholder="Containerobjekt suchen..."
                />
              </div>
            </div>
          </div>

          <div className={fieldGroupClass}>
            {layout === "stacked" ? (
              <FieldGroupHeader
                description="Einheit für Lager, LKW-Dispo und spätere BTB-Übernahme. Lagerverwaltung ist optional."
                title="Einheit / Lagerverwaltung"
              />
            ) : null}
            <div className={innerGridClass}>
              <Select
                defaultValue={item?.stockUnit ?? "Stk."}
                label="Einheit"
                name="stockUnit"
              >
                <option value="t">t</option>
                <option value="kg">kg</option>
                <option value="m3">m³</option>
                <option value="m2">m²</option>
                <option value="m">m</option>
                <option value="l">l</option>
                <option value="Stk.">Stk.</option>
                <option value="Std.">Std.</option>
                <option value="pauschal">pauschal</option>
              </Select>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                <input
                  className="h-4 w-4 rounded border-gray-300"
                  defaultChecked={item?.isStockManaged ?? false}
                  name="isStockManaged"
                  type="checkbox"
                />
                Lagerverwaltung
              </label>
              <Input
                defaultValue={formatNumber(item?.openingStock ?? null)}
                label="Anfangsbestand"
                name="openingStock"
              />
            </div>
          </div>
        </div>
      </section>

      <section className={sectionClass}>
        {layout === "stacked" ? (
          <SectionHeader
            description="Service, Betriebsstunden, Kilometer und DGUV-Prüfungen für Geräte/Maschinen."
            title="Werkstatt / Wartung"
          />
        ) : null}
        <div className={layout === "stacked" ? "mt-4 space-y-4" : gridClass}>
          <div className={fieldGroupClass}>
            {layout === "stacked" ? (
              <FieldGroupHeader
                description="Letzter bekannter Service-Stand."
                title="Letzter Service"
              />
            ) : null}
            <div className={innerGridClass}>
              <Input
                defaultValue={formatNumber(item?.lastServiceOperatingHours ?? null)}
                label="Betriebsstunden"
                name="lastServiceOperatingHours"
              />
              <Input
                defaultValue={item?.lastServiceMileageKm ?? ""}
                label="Kilometer"
                name="lastServiceMileageKm"
                type="number"
              />
              <Input
                defaultValue={formatDateInput(item?.lastServiceAtDate ?? null)}
                label="Datum"
                name="lastServiceAtDate"
                type="date"
              />
            </div>
          </div>

          <div className={fieldGroupClass}>
            {layout === "stacked" ? (
              <FieldGroupHeader
                description="Nächster geplanter Service nach Stunden, Kilometer oder Datum."
                title="Nächster Service"
              />
            ) : null}
            <div className={innerGridClass}>
              <Input
                defaultValue={formatNumber(item?.nextServiceOperatingHours ?? null)}
                label="Betriebsstunden"
                name="nextServiceOperatingHours"
              />
              <Input
                defaultValue={item?.nextServiceMileageKm ?? ""}
                label="Kilometer"
                name="nextServiceMileageKm"
                type="number"
              />
              <Input
                defaultValue={formatDateInput(item?.nextServiceAtDate ?? null)}
                label="Datum"
                name="nextServiceAtDate"
                type="date"
              />
            </div>
          </div>

          <div className={fieldGroupClass}>
            {layout === "stacked" ? (
              <FieldGroupHeader
                description="Prüfdaten für DGUV / UVV / Geräteprüfung."
                title="DGUV-Prüfung"
              />
            ) : null}
            <div className={innerGridClass}>
              <Input
                defaultValue={formatDateInput(item?.lastDguvInspectionDate ?? null)}
                label="Letzte DGUV-Prüfung"
                name="lastDguvInspectionDate"
                type="date"
              />
              <Input
                defaultValue={formatDateInput(item?.nextDguvInspectionDate ?? null)}
                label="Nächste DGUV-Prüfung"
                name="nextDguvInspectionDate"
                type="date"
              />
            </div>
          </div>

          <div className={fieldGroupClass}>
            {layout === "stacked" ? (
              <FieldGroupHeader
                description="TÜV-Prüfung für Fahrzeuge, Anhänger oder zulassungspflichtige Geräte."
                title="TÜV-Prüfung"
              />
            ) : null}
            <div className={innerGridClass}>
              <Input
                defaultValue={formatDateInput(item?.lastTuvInspectionDate ?? null)}
                label="Letzte TÜV-Prüfung"
                name="lastTuvInspectionDate"
                type="date"
              />
              <Input
                defaultValue={formatDateInput(item?.nextTuvInspectionDate ?? null)}
                label="Nächste TÜV-Prüfung"
                name="nextTuvInspectionDate"
                type="date"
              />
            </div>
          </div>
        </div>
      </section>

      <section className={sectionClass}>
        {layout === "stacked" ? (
          <SectionHeader
            description="Interne Hinweise, Fotos und Ansprechpartner direkt miterfassen."
            title="Dokumentation"
          />
        ) : null}
        <div className={layout === "stacked" ? "mt-4 space-y-4" : "space-y-4"}>
          <label className="block text-sm font-medium text-gray-800">
            Notizen
            <textarea
              className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
              defaultValue={item?.notes ?? ""}
              name="notes"
              rows={3}
            />
          </label>

          <InventoryPhotoUploadFields photos={item?.photos ?? []} />

          <InventoryContactFields contacts={item?.contacts ?? []} />
        </div>
      </section>

      <div className="flex items-end">
        <button
          className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-700"
          type="submit"
        >
          Speichern
        </button>
      </div>
    </form>
  );
}

function SectionHeader({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-gray-600">{description}</p>
    </div>
  );
}

function FieldGroupHeader({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <div>
      <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-gray-700">
        {title}
      </h3>
      <p className="mt-1 text-xs leading-5 text-gray-500">{description}</p>
    </div>
  );
}

function Input({
  className = "",
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
}) {
  return (
    <label className={`text-sm font-medium text-gray-800 ${className}`}>
      {label}
      <input
        {...props}
        className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
      />
    </label>
  );
}

function Select({
  children,
  className = "",
  label,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
}) {
  return (
    <label className={`text-sm font-medium text-gray-800 ${className}`}>
      {label}
      <select
        {...props}
        className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
      >
        {children}
      </select>
    </label>
  );
}
