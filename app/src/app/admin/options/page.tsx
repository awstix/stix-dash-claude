import { ActionIcon } from "@/components/ActionIcon";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import {
  createAdminOption,
  deleteAdminOption,
  saveAdminOptionSortOrder,
  sortAdminOptionsAlphabetically,
  sortAdminOptionsByPosition,
  updateAdminOption,
} from "./actions";

type OptionGroup = {
  key: string;
  label: string;
  hint?: string;
};

type RelatedLink = {
  label: string;
  description: string;
  href: string;
};

type OptionSection = {
  title: string;
  description: string;
  groups: OptionGroup[];
  relatedLinks?: RelatedLink[];
};

const optionSections: OptionSection[] = [
  {
    title: "Mitarbeiter",
    description:
      "Status, Firmen, Abteilungen, Geschlecht, Berufsgruppen und Arbeitszeit.",
    groups: [
      { key: "employee_status", label: "Mitarbeiter-Status" },
      { key: "employee_company", label: "Firmen" },
      { key: "employee_department", label: "Abteilungen" },
      { key: "employee_gender", label: "Geschlecht" },
      { key: "employee_position", label: "Berufsgruppen / Mitarbeitergruppen" },
    ],
    relatedLinks: [
      {
        label: "Arbeitszeit verwalten",
        description:
          "Sommer-/Winter-Arbeitszeiten und Standard-Arbeitszeit für Zeitstrahlen einstellen.",
        href: "/admin/working-time",
      },
    ],
  },
  {
    title: "Fahrzeuge",
    description:
      "Fahrzeugtypen und Fahrzeugkategorien für Fuhrpark und LKW-Disposition.",
    groups: [
      { key: "vehicle_type", label: "Fahrzeugtypen" },
      { key: "vehicle_category", label: "Fahrzeugkategorien" },
    ],
  },
  {
    title: "Nachunternehmer",
    description: "Fuhrunternehmen und spätere Nachunternehmer-Verwaltung.",
    groups: [
      { key: "subcontractor_company", label: "Fuhrunternehmen" },
      {
        key: "subcontractor_type",
        label: "Nachunternehmer",
        hint: "Vorbereitet für spätere Erweiterung.",
      },
    ],
  },
  {
    title: "Material",
    description:
      "Material, Mengen, Transportzwecke, Asphalt und Beton-Auswahllisten.",
    groups: [
      { key: "material_category", label: "Materialkategorien" },
      { key: "material_unit", label: "Materialeinheiten" },
      {
        key: "quantity_unit",
        label: "Mengeneinheiten allgemein",
        hint: "Wird aktuell in der Kurzstrecke bei Tour-Mengen verwendet.",
      },
      {
        key: "transport_item",
        label: "Transport / Maschinenliste",
        hint: "Wird in der Kurzstrecke bei Zweck-Art Transport / Maschine verwendet.",
      },
      { key: "asphalt_category", label: "Asphalt-Kategorien" },
      { key: "asphalt_plant", label: "Asphalt-Mischanlagen / Standorte" },
      { key: "asphalt_unit", label: "Asphalt-Einheiten" },
      { key: "concrete_unit", label: "Beton-Einheiten" },
      { key: "concrete_strength_class", label: "Beton-Festigkeitsklassen" },
      { key: "concrete_exposure_class", label: "Beton-Expositionsklassen" },
      { key: "concrete_consistency", label: "Beton-Konsistenz" },
      { key: "concrete_aggregate", label: "Beton-Körnung" },
    ],
  },
  {
    title: "Kolonnen",
    description:
      "Kolonnentypen für die zentrale Kolonnenverwaltung. Asphaltkolonnen werden jetzt über Admin → Kolonnen gepflegt.",
    groups: [
      {
        key: "crew_type",
        label: "Kolonnentypen",
        hint: "Wird in Admin → Kolonnen beim Feld Kolonnentyp verwendet.",
      },
    ],
    relatedLinks: [
      {
        label: "Kolonnen verwalten",
        description:
          "Kolonnen aus Mitarbeitern, Berufsbezeichnungen und Standardgeräten erstellen. Dort wird auch festgelegt, ob eine Kolonne in der Asphaltdisposition erscheint.",
        href: "/admin/crews",
      },
    ],
  },
];

function sectionAnchor(title: string) {
  return title.toLowerCase().replaceAll(" ", "-");
}

function getNextSortOrder(options: { sortOrder: number }[]) {
  if (options.length === 0) return 10;

  const maxSortOrder = Math.max(
    ...options.map((option) => option.sortOrder),
  );

  return Math.floor(maxSortOrder / 10) * 10 + 10;
}

export default async function AdminOptionsPage() {
  const options = await prisma.adminOption.findMany({
    orderBy: [{ groupKey: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
  });

  return (
    <AppShell
      title="Auswahllisten"
      description="Dropdown-Werte zentral verwalten, ohne Code ändern zu müssen."
    >
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        {optionSections.map((section) => {
          const sectionOptionCount = section.groups.reduce((sum, group) => {
            return (
              sum +
              options.filter((option) => option.groupKey === group.key).length
            );
          }, 0);

          return (
            <a
              key={section.title}
              href={`#${sectionAnchor(section.title)}`}
              className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
            >
              <div className="text-sm font-semibold text-gray-900">
                {section.title}
              </div>
              <div className="mt-1 text-xs leading-5 text-gray-500">
                {section.groups.length} Kategorien · {sectionOptionCount} Werte
                {section.relatedLinks?.length
                  ? ` · ${section.relatedLinks.length} Zusatzpunkt`
                  : ""}
              </div>
            </a>
          );
        })}
      </div>

      <div className="space-y-5">
        {optionSections.map((section) => {
          const sectionOptionCount = section.groups.reduce((sum, group) => {
            return (
              sum +
              options.filter((option) => option.groupKey === group.key).length
            );
          }, 0);

          return (
            <details
              key={section.title}
              id={sectionAnchor(section.title)}
              className="rounded-2xl border border-gray-200 bg-white shadow-sm"
            >
              <summary className="cursor-pointer list-none rounded-2xl bg-white p-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                      {section.title}
                    </h2>
                    <p className="mt-1 text-sm text-gray-600">
                      {section.description}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                      {section.groups.length} Kategorien
                    </span>
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                      {sectionOptionCount} Werte
                    </span>
                    {section.relatedLinks?.length ? (
                      <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
                        {section.relatedLinks.length} Zusatzpunkt
                      </span>
                    ) : null}
                    <span className="rounded-full bg-gray-900 px-3 py-1 text-xs font-semibold text-white">
                      Aufklappen
                    </span>
                  </div>
                </div>
              </summary>

              <div className="space-y-5 border-t border-gray-200 bg-gray-50 p-5">
                {section.relatedLinks?.length ? (
                  <div className="grid grid-cols-1 gap-4">
                    {section.relatedLinks.map((link) => (
                      <a
                        key={link.href}
                        href={link.href}
                        className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm transition hover:-translate-y-1 hover:bg-blue-100 hover:shadow-md"
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <h3 className="text-lg font-semibold text-blue-950">
                              {link.label}
                            </h3>
                            <p className="mt-1 text-sm leading-6 text-blue-800">
                              {link.description}
                            </p>
                          </div>

                          <span className="rounded-xl bg-blue-900 px-4 py-2 text-sm font-semibold text-white">
                            Öffnen →
                          </span>
                        </div>
                      </a>
                    ))}
                  </div>
                ) : null}

                {section.groups.map((group) => {
                  const groupOptions = options.filter(
                    (option) => option.groupKey === group.key
                  );
                  const nextSortOrder = getNextSortOrder(groupOptions);

                  const sortFormId = `sort-form-${group.key}`;

                  return (
                    <div
                      key={group.key}
                      className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
                    >
                      <div className="border-b border-gray-200 bg-gray-50 px-5 py-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">
                              {group.label}
                            </h3>
                            <p className="mt-1 text-xs text-gray-500">
                              groupKey: {group.key}
                            </p>
                            {group.hint ? (
                              <p className="mt-1 text-xs text-blue-700">
                                {group.hint}
                              </p>
                            ) : null}
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <form action={sortAdminOptionsAlphabetically}>
                              <input
                                type="hidden"
                                name="groupKey"
                                value={group.key}
                              />
                              <button
                                type="submit"
                                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                              >
                                Alphabetisch sortieren
                              </button>
                            </form>

                            <form action={sortAdminOptionsByPosition}>
                              <input
                                type="hidden"
                                name="groupKey"
                                value={group.key}
                              />
                              <button
                                type="submit"
                                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                              >
                                Nach Position sortieren
                              </button>
                            </form>
                          </div>
                        </div>
                      </div>

                      <div className="p-4">
                        <div className="space-y-2">
                          {groupOptions.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-center text-sm text-gray-500">
                              Noch keine Werte vorhanden.
                            </div>
                          ) : (
                            groupOptions.map((option) => {
                              const rowFormId = `option-form-${option.id}`;

                              return (
                                <div
                                  key={option.id}
                                  className="rounded-xl border border-gray-200 bg-white p-3"
                                >
                                  <div className="grid grid-cols-1 gap-3 md:grid-cols-[92px_1fr_140px_120px] md:items-start">
                                    <div className="flex items-center gap-2 pt-6">
                                      <form
                                        id={rowFormId}
                                        action={updateAdminOption}
                                      >
                                        <input
                                          type="hidden"
                                          name="id"
                                          value={option.id}
                                        />

                                        <button
                                          type="submit"
                                          title="Auswahlpunkt speichern"
                                          aria-label="Auswahlpunkt speichern"
                                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gray-900 text-white hover:bg-gray-700"
                                        >
                                          <ActionIcon name="save" className="h-4 w-4" />
                                        </button>
                                      </form>

                                      <form action={deleteAdminOption}>
                                        <input
                                          type="hidden"
                                          name="id"
                                          value={option.id}
                                        />

                                        <button
                                          type="submit"
                                          title="Auswahlpunkt löschen"
                                          aria-label="Auswahlpunkt löschen"
                                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-50"
                                        >
                                          <ActionIcon name="delete" className="h-4 w-4" />
                                        </button>
                                      </form>
                                    </div>

                                    <div>
                                      <label className="text-xs font-semibold text-gray-600">
                                        Bezeichnung
                                      </label>
                                      <SmallInput
                                        formId={rowFormId}
                                        name="label"
                                        defaultValue={option.label}
                                      />

                                      <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 px-2 py-2 text-xs font-medium text-gray-700">
                                        Interner Wert: {option.value}
                                      </div>

                                      {option.value === "lkw_fahrer_in" ? (
                                        <p className="mt-1 text-xs font-medium text-blue-700">
                                          Dieser Wert steuert automatisch die
                                          LKW-Fahrer-Verknüpfung.
                                        </p>
                                      ) : null}
                                    </div>

                                    <div>
                                      <label className="text-xs font-semibold text-gray-600">
                                        Position
                                      </label>
                                      <input
                                        form={sortFormId}
                                        name={`sortOrder_${option.id}`}
                                        type="number"
                                        defaultValue={String(option.sortOrder)}
                                        className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-900 outline-none focus:border-gray-900"
                                      />

                                      <input
                                        form={sortFormId}
                                        type="hidden"
                                        name="optionIds"
                                        value={option.id}
                                      />
                                    </div>

                                    <label className="mt-6 flex items-center gap-2 text-sm font-medium text-gray-900 md:mt-7">
                                      <input
                                        form={rowFormId}
                                        type="checkbox"
                                        name="isActive"
                                        defaultChecked={option.isActive}
                                        className="h-4 w-4"
                                      />
                                      aktiv
                                    </label>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>

                        <details className="mt-4 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
                          <summary className="cursor-pointer text-sm font-semibold text-gray-800">
                            Auswahlpunkt hinzufügen
                          </summary>

                          <form
                            action={createAdminOption}
                            className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_140px_auto]"
                          >
                            <input
                              type="hidden"
                              name="groupKey"
                              value={group.key}
                            />

                            <label className="text-sm font-medium text-gray-800">
                              Bezeichnung
                              <input
                                name="label"
                                required
                                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
                              />
                            </label>

                            <label className="text-sm font-medium text-gray-800">
                              Position
                              <input
                                name="sortOrder"
                                type="number"
                                defaultValue={String(nextSortOrder)}
                                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
                              />
                            </label>

                            <div className="flex items-end">
                              <button
                                type="submit"
                                className="rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white hover:bg-gray-700"
                              >
                                Hinzufügen
                              </button>
                            </div>

                            <label className="text-sm font-medium text-gray-800 md:col-span-3">
                              Interner Wert optional
                              <input
                                name="value"
                                placeholder={
                                  group.key === "employee_position"
                                    ? "z.B. pflasterer_in"
                                    : group.key === "crew_type"
                                      ? "z.B. asphaltbau"
                                      : "leer lassen = automatisch"
                                }
                                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
                              />
                              <span className="mt-1 block text-xs text-gray-500">
                                Normalerweise leer lassen. Nur verwenden, wenn
                                ein technischer Wert exakt festgelegt werden
                                soll.
                              </span>
                            </label>
                          </form>
                        </details>

                        <form
                          id={sortFormId}
                          action={saveAdminOptionSortOrder}
                          className="mt-3 flex justify-end"
                        >
                          <button
                            type="submit"
                            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                          >
                            Sortierung speichern
                          </button>
                        </form>
                      </div>
                    </div>
                  );
                })}
              </div>
            </details>
          );
        })}
      </div>
    </AppShell>
  );
}

function SmallInput({
  formId,
  name,
  defaultValue,
  type = "text",
}: {
  formId: string;
  name: string;
  defaultValue: string;
  type?: string;
}) {
  return (
    <input
      form={formId}
      name={name}
      type={type}
      defaultValue={defaultValue}
      className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-900 outline-none focus:border-gray-900"
    />
  );
}
