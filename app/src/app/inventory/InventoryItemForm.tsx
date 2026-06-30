import { InventoryContactFields } from "./InventoryContactFields";
import { InventoryPhotoUploadFields } from "./InventoryPhotoUploadFields";

export type InventoryItemFormData = {
  billingRateCents: number | null;
  categoryId: string | null;
  constructionDate: Date | null;
  constructionYear: number | null;
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
  id: string;
  inventoryNumber: string | null;
  invoiceNumber: string | null;
  isContainer: boolean;
  isStockManaged: boolean;
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
  openingStock: number | null;
  parentItemId: string | null;
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

export function InventoryItemForm({
  action,
  categories,
  containerOptions,
  crews,
  defaultParentItemId = null,
  employees,
  item,
  layout = "grid",
  projects,
  vehicles,
}: {
  action: (formData: FormData) => void | Promise<void>;
  categories: { id: string; name: string }[];
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
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
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
                defaultValue={item?.inventoryNumber ?? ""}
                label="Inventarnummer"
                name="inventoryNumber"
              />
              <Input
                defaultValue={item?.serialNumber ?? ""}
                label="Seriennummer"
                name="serialNumber"
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
            description="Wer hat das Objekt aktuell, liegt es auf einer Baustelle oder in einem Container?"
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
                description="Baustelle, bestehendes Gerät/Fahrzeug oder Containerobjekt."
                title="Standort / Bezug"
              />
            ) : null}
            <div className={innerGridClass}>
              <Select
                className={layout === "stacked" ? "" : "xl:col-span-2"}
                defaultValue={item?.currentProjectId ?? "__none"}
                label="Aktuelle Baustelle"
                name="currentProjectId"
              >
                <option value="__none">Keine Baustelle</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.projectNumber} · {project.name}
                  </option>
                ))}
              </Select>
              <Select
                className={layout === "stacked" ? "" : "xl:col-span-2"}
                defaultValue={item?.vehicleId ?? "__none"}
                label="Bestehendes Fahrzeug/Gerät verknüpfen"
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
              <Select
                className={layout === "stacked" ? "" : "xl:col-span-2"}
                defaultValue={item?.parentItemId ?? defaultParentItemId ?? "__none"}
                label="Liegt in Containerobjekt"
                name="parentItemId"
              >
                <option value="__none">Kein Container</option>
                {containerOptions.map((container) => (
                  <option key={container.id} value={container.id}>
                    {container.name}
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
            description="Containerobjekte können andere Objekte enthalten. Lagerobjekte bekommen Bestand und Einheit."
            title="Container und Lager"
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
            <div className={innerGridClass}>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                <input
                  className="h-4 w-4 rounded border-gray-300"
                  defaultChecked={item?.isContainer ?? false}
                  name="isContainer"
                  type="checkbox"
                />
                Containerobjekt
              </label>
            </div>
          </div>

          <div className={fieldGroupClass}>
            {layout === "stacked" ? (
              <FieldGroupHeader
                description="Wenn aktiv, erscheint das Objekt in der Lagerverwaltung mit Bestand."
                title="Lagerverwaltung"
              />
            ) : null}
            <div className={innerGridClass}>
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
                defaultValue={item?.stockUnit ?? "Stk."}
                label="Lagereinheit"
                name="stockUnit"
              />
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
