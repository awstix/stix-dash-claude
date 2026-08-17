import { InventoryContactFields } from "./InventoryContactFields";
import { InventoryAdditionalEmployeesField } from "./InventoryAdditionalEmployeesField";
import { InventoryDocumentUploadFields } from "./InventoryDocumentUploadFields";
import { InventoryPhotoUploadFields } from "./InventoryPhotoUploadFields";
import { SearchableInventorySelect } from "./SearchableInventorySelect";
import {
  getInventoryCategoryOptionLabel,
  sortInventoryCategoriesForSelect,
} from "@/lib/inventory-categories";

export type InventoryItemFormData = {
  attachmentType: string | null;
  billingRateCents: number | null;
  idleBillingRateCents: number | null;
  insuranceProviderValue: string | null;
  insuranceProviderLabel: string | null;
  insuranceAnnualPremiumCents: number | null;
  categoryId: string | null;
  constructionDate: Date | null;
  constructionYear: number | null;
  firstRegistrationDate: Date | null;
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
  employeeAssignments?: {
    employeeId: string;
  }[];
  fuelTankLiters: number | null;
  fuelTypeValue: string | null;
  fuelTypeLabel: string | null;
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
  lastHuInspectionDate: Date | null;
  lastTachographInspectionDate: Date | null;
  lastSafetyInspectionDate: Date | null;
  lastAdrInspectionDate: Date | null;
  manufacturer: string | null;
  model: string | null;
  name: string;
  nextDguvInspectionDate: Date | null;
  nextServiceAtDate: Date | null;
  nextServiceMileageKm: number | null;
  nextServiceOperatingHours: number | null;
  nextTuvInspectionDate: Date | null;
  nextHuInspectionDate: Date | null;
  nextTachographInspectionDate: Date | null;
  nextSafetyInspectionDate: Date | null;
  nextAdrInspectionDate: Date | null;
  notes: string | null;
  objectNumber: string | null;
  openingStock: number | null;
  parentItemId: string | null;
  payloadKg: number | null;
  workMaterialTankLiters: number | null;
  photos?: {
    fileName: string;
    id: string;
    isPrimary: boolean;
    originalName: string | null;
    url: string;
  }[];
  documents?: {
    fileName: string;
    id: string;
    originalName: string | null;
    sizeBytes: number | null;
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
  stixId: string | null;
  stockUnit: string;
  vehicleIdentNumber: string | null;
};

const DEFAULT_STATUS_OPTIONS = [
  { label: "Aktiv", value: "ACTIVE" },
  { label: "Defekt", value: "DEFECT" },
  { label: "In Wartung", value: "IN_SERVICE" },
  { label: "Gesperrt", value: "LOCKED" },
  { label: "Gestohlen", value: "STOLEN" },
];

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
  attachmentTypeOptions = [],
  fuelTypeOptions = [],
  insuranceProviderOptions = [],
  statusOptions = DEFAULT_STATUS_OPTIONS,
}: {
  action: (formData: FormData) => void | Promise<void>;
  attachmentTypeOptions?: string[];
  fuelTypeOptions?: { label: string; value: string }[];
  insuranceProviderOptions?: { label: string; value: string }[];
  statusOptions?: { label: string; value: string }[];
  categories: {
    dailyReportSection: string;
    id: string;
    name: string;
    parentCategoryId: string | null;
    useInDailyReports: boolean;
    useInTruckDispatchMaterial: boolean;
    useInTruckDispatchObject: boolean;
  }[];
  containerOptions: { id: string; name: string }[];
  crews: { id: string; name: string }[];
  defaultParentItemId?: string | null;
  employees: { firstName: string; id: string; lastName: string }[];
  item?: InventoryItemFormData;
  layout?: "grid" | "stacked";
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

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-bold text-amber-950">
              Kategorie steuert die spätere Verwendung
            </h2>
            <p className="mt-1 max-w-4xl text-sm leading-6 text-amber-900">
              Beim Objekt selbst trägst du möglichst viele Daten ein. Ob das
              Objekt später im BTB, in der LKW-Disposition, als Material,
              Maschine/Gerät oder Lagerobjekt auftaucht, wird über die
              Inventarkategorie gesteuert.
            </p>
          </div>
          <a
            className="inline-flex rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-100"
            href="/admin/inventory-categories"
          >
            Kategorien prüfen →
          </a>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <HintCard
            text="Kennzeichen, Achsen, zulässiges Gesamtgewicht und Nutzlast pflegen."
            title="LKW / Fahrzeuge"
          />
          <HintCard
            text="Antrieb/Fahrwerk, Service, Betriebsstunden, DGUV und TÜV pflegen."
            title="Maschinen / Geräte"
          />
          <HintCard
            text="Einheit sauber wählen und bei lagergeführten Artikeln Lagerverwaltung aktivieren."
            title="Material / Schüttgut"
          />
          <HintCard
            text="Containerobjekt aktivieren oder Objekt einem bestehenden Containerobjekt zuweisen."
            title="Containerobjekte"
          />
        </div>
      </section>

      <section className={sectionClass}>
        <input
          name="currentProjectId"
          type="hidden"
          value={item?.currentProjectId ?? "__none"}
        />
        {layout === "stacked" ? (
          <SectionHeader
            description="Grunddaten, Nummern und technische Angaben."
            title="Objektdaten"
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
                    {getCategoryUsageSuffix(category)}
                  </option>
                ))}
              </Select>
              <Select
                defaultValue={item?.status ?? "ACTIVE"}
                label="Status"
                name="status"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
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
                label="Objekt-ID (6-stellig)"
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
                defaultValue={item?.vehicleIdentNumber ?? ""}
                label="Fahrzeug-Ident.-Nr."
                name="vehicleIdentNumber"
                placeholder="z.B. WDB1234567A123456"
              />
              <Input
                defaultValue={item?.stixId ?? ""}
                label="STIX-ID"
                name="stixId"
                placeholder="z.B. STIX-12345"
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
                label="Produktionsdatum / Baujahr"
                name="constructionDate"
                placeholder="bei Bedarf nur Jahr im Kalender wählen"
                type="date"
              />
              <Input
                defaultValue={formatDateInput(item?.firstRegistrationDate ?? null)}
                label="Erstzulassung"
                name="firstRegistrationDate"
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
                title="Fahrzeug-, LKW- und Gerätedaten"
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
                label="Technisch zul. Gesamtmasse (F1) kg"
                name="grossWeightKg"
                placeholder="z.B. 26000"
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
              <Input
                defaultValue={item?.attachmentType ?? ""}
                label="Aufnahmetyp"
                list="inventory-attachment-type-options"
                name="attachmentType"
                placeholder="z.B. OQ 70/55"
              />
              <Input
                defaultValue={item?.fuelTankLiters?.toString() ?? ""}
                label="Kraftstofftank l"
                name="fuelTankLiters"
                placeholder="z.B. 450"
                step="0.01"
                type="number"
              />
              <Select
                defaultValue={item?.fuelTypeValue ?? "__none"}
                label="Kraftstoffart"
                name="fuelTypeValue"
              >
                <option value="__none">Nicht angegeben</option>
                {fuelTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <Input
                defaultValue={item?.workMaterialTankLiters?.toString() ?? ""}
                label="Arbeitsmitteltank l"
                name="workMaterialTankLiters"
                placeholder="z.B. 8000"
                step="0.01"
                type="number"
              />
              <datalist id="inventory-attachment-type-options">
                {attachmentTypeOptions.map((attachmentType) => (
                  <option key={attachmentType} value={attachmentType} />
                ))}
              </datalist>
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
                label="Verrechnungssatz €/Einheit"
                name="billingRate"
                step="0.01"
                type="number"
              />
              <Input
                defaultValue={
                  item?.idleBillingRateCents
                    ? String(item.idleBillingRateCents / 100)
                    : ""
                }
                label="Verrechnungssatz stillgelegt €/Einheit"
                name="idleBillingRate"
                step="0.01"
                type="number"
              />
            </div>
          </div>

          <div className={fieldGroupClass}>
            {layout === "stacked" ? (
              <FieldGroupHeader
                description="Versicherer und jährliche Prämie für das Objekt."
                title="Versicherung"
              />
            ) : null}
            <div className={innerGridClass}>
              <Select
                defaultValue={item?.insuranceProviderValue ?? "__none"}
                label="Versichert bei"
                name="insuranceProviderValue"
              >
                <option value="__none">Nicht angegeben</option>
                {insuranceProviderOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <Input
                defaultValue={
                  item?.insuranceAnnualPremiumCents
                    ? String(item.insuranceAnnualPremiumCents / 100)
                    : ""
                }
                label="Versicherung p.a. netto €"
                name="insuranceAnnualPremium"
                step="0.01"
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
                defaultValue={item?.responsibleEmployeeId ?? "__none"}
                label="Verantwortlicher Mitarbeiter/Fahrer"
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
                label="Zugeordnete Kolonne"
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

          <div className={layout === "stacked" ? "" : "md:col-span-2 xl:col-span-6"}>
            <InventoryAdditionalEmployeesField
              employees={employees}
              initialEmployeeIds={(item?.employeeAssignments ?? []).map(
                (assignment) => assignment.employeeId,
              )}
            />
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
                description="Letzter und nächster Service auf einen Blick."
                title="Service"
              />
            ) : null}
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <ServiceStatPair
                lastDefaultValue={formatNumber(item?.lastServiceOperatingHours ?? null)}
                lastName="lastServiceOperatingHours"
                nextDefaultValue={formatNumber(item?.nextServiceOperatingHours ?? null)}
                nextName="nextServiceOperatingHours"
                title="Betriebsstunden"
              />
              <ServiceStatPair
                lastDefaultValue={item?.lastServiceMileageKm ?? ""}
                lastName="lastServiceMileageKm"
                nextDefaultValue={item?.nextServiceMileageKm ?? ""}
                nextName="nextServiceMileageKm"
                title="Kilometer"
                type="number"
              />
              <ServiceStatPair
                lastDefaultValue={formatDateInput(item?.lastServiceAtDate ?? null)}
                lastName="lastServiceAtDate"
                nextDefaultValue={formatDateInput(item?.nextServiceAtDate ?? null)}
                nextName="nextServiceAtDate"
                title="Datum"
                type="date"
              />
            </div>
          </div>

          <div
            className={
              layout === "stacked"
                ? `${fieldGroupClass} md:col-span-2 xl:col-span-3`
                : "rounded-2xl border border-gray-200 bg-gray-50 p-4 md:col-span-2 xl:col-span-6"
            }
          >
            <FieldGroupHeader
              description="Gesetzliche und technische Prüfungen kompakt mit letztem und nächstem Termin."
              title="Prüfungen"
            />
            <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
              <InspectionDatePair
                lastName="lastDguvInspectionDate"
                lastValue={item?.lastDguvInspectionDate ?? null}
                nextName="nextDguvInspectionDate"
                nextValue={item?.nextDguvInspectionDate ?? null}
                title="DGUV"
              />
              <InspectionDatePair
                lastName="lastTuvInspectionDate"
                lastValue={item?.lastTuvInspectionDate ?? null}
                nextName="nextTuvInspectionDate"
                nextValue={item?.nextTuvInspectionDate ?? null}
                title="TÜV"
              />
              <InspectionDatePair
                lastName="lastHuInspectionDate"
                lastValue={item?.lastHuInspectionDate ?? null}
                nextName="nextHuInspectionDate"
                nextValue={item?.nextHuInspectionDate ?? null}
                title="HU"
              />
              <InspectionDatePair
                lastName="lastTachographInspectionDate"
                lastValue={item?.lastTachographInspectionDate ?? null}
                nextName="nextTachographInspectionDate"
                nextValue={item?.nextTachographInspectionDate ?? null}
                title="Tachoprüfung"
              />
              <InspectionDatePair
                lastName="lastSafetyInspectionDate"
                lastValue={item?.lastSafetyInspectionDate ?? null}
                nextName="nextSafetyInspectionDate"
                nextValue={item?.nextSafetyInspectionDate ?? null}
                title="SP"
              />
              <InspectionDatePair
                lastName="lastAdrInspectionDate"
                lastValue={item?.lastAdrInspectionDate ?? null}
                nextName="nextAdrInspectionDate"
                nextValue={item?.nextAdrInspectionDate ?? null}
                title="ADR"
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

          <InventoryDocumentUploadFields documents={item?.documents ?? []} />

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

function HintCard({ text, title }: { text: string; title: string }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-white/80 p-3">
      <div className="text-sm font-bold text-amber-950">{title}</div>
      <p className="mt-1 text-xs leading-5 text-amber-900">{text}</p>
    </div>
  );
}

function getCategoryUsageSuffix(category: {
  dailyReportSection: string;
  useInDailyReports: boolean;
  useInTruckDispatchMaterial: boolean;
  useInTruckDispatchObject: boolean;
}) {
  const parts = [
    category.useInTruckDispatchMaterial ? "LKW Material" : null,
    category.useInTruckDispatchObject ? "LKW Gerät/Objekt" : null,
    category.useInDailyReports
      ? `BTB ${getDailyReportSectionLabel(category.dailyReportSection)}`
      : null,
  ].filter(Boolean);

  return parts.length ? ` · ${parts.join(" · ")}` : "";
}

function getDailyReportSectionLabel(value: string) {
  if (value === "MATERIAL") return "Material";
  if (value === "MACHINES") return "Maschinen/Geräte";
  if (value === "OTHER") return "Sonstiges";

  return "ohne Bereich";
}

function InspectionDatePair({
  lastName,
  lastValue,
  nextName,
  nextValue,
  title,
}: {
  lastName: string;
  lastValue: Date | null;
  nextName: string;
  nextValue: Date | null;
  title: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <div className="text-xs font-bold uppercase tracking-[0.12em] text-gray-700">
        {title}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <Input
          defaultValue={formatDateInput(lastValue)}
          label="Letzte"
          name={lastName}
          type="date"
        />
        <Input
          defaultValue={formatDateInput(nextValue)}
          label="Nächste"
          name={nextName}
          type="date"
        />
      </div>
    </div>
  );
}

function ServiceStatPair({
  lastDefaultValue,
  lastName,
  nextDefaultValue,
  nextName,
  title,
  type = "text",
}: {
  lastDefaultValue: string | number;
  lastName: string;
  nextDefaultValue: string | number;
  nextName: string;
  title: string;
  type?: React.HTMLInputTypeAttribute;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <div className="text-xs font-bold uppercase tracking-[0.12em] text-gray-700">
        {title}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <Input
          defaultValue={lastDefaultValue}
          label="Letzter"
          name={lastName}
          type={type}
        />
        <Input
          defaultValue={nextDefaultValue}
          label="Nächster"
          name={nextName}
          type={type}
        />
      </div>
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
