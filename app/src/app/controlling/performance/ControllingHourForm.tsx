"use client";

import { useState } from "react";

type HourSelectionOption = {
  costCategory: string;
  internalRate: string;
  id: string;
  label: string;
  realRate: string;
};

type LabelType = "CREW" | "EMPLOYEE" | "FREE";

const inputClassName =
  "mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none focus:border-gray-900 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400";
const primaryButtonClassName =
  "inline-flex items-center justify-center rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-gray-700";

export function ControllingHourForm({
  action,
  crewOptions,
  defaultDate,
  employeeOptions,
  projectId,
  reportId,
}: {
  action: (formData: FormData) => Promise<void>;
  crewOptions: HourSelectionOption[];
  defaultDate: string;
  employeeOptions: HourSelectionOption[];
  projectId: string;
  reportId: string;
}) {
  const [labelType, setLabelType] = useState<LabelType>("CREW");
  const [employeeCount, setEmployeeCount] = useState("1");
  const [internalRate, setInternalRate] = useState("");
  const [realRate, setRealRate] = useState("");
  const [costCategory, setCostCategory] = useState("LOHN");
  const parsedEmployeeCount = parseEmployeeCount(employeeCount);
  const employeeSelectCount =
    labelType === "EMPLOYEE" ? Math.max(1, Math.min(parsedEmployeeCount, 50)) : 1;

  function updateRatesFromOptions(options: HourSelectionOption[]) {
    const realRates = options.map((option) => parseMoney(option.realRate)).filter((value) => value > 0);
    const internalRates = options
      .map((option) => parseMoney(option.internalRate))
      .filter((value) => value > 0);

    setRealRate(formatMoneyInput(average(realRates)));
    setInternalRate(formatMoneyInput(average(internalRates)));
    setCostCategory(majorityCostCategory(options.map((option) => option.costCategory)));
  }

  return (
    <form action={action} className="mt-5 space-y-4">
      <input name="reportId" type="hidden" value={reportId} />
      <input name="projectId" type="hidden" value={projectId} />
      <FormPanel
        description="Hier wird festgelegt, ob die Stunden auf eine Kolonne, einen einzelnen Mitarbeiter oder einen freien Eintrag laufen."
        title="Zuordnung"
      >
        <Field label="Art">
          <select
            className={inputClassName}
            name="labelType"
            onChange={(event) => {
              const nextType = event.target.value as LabelType;
              setLabelType(nextType);
              if (nextType === "FREE") {
                setRealRate("");
                setInternalRate("");
              }
            }}
            value={labelType}
          >
            <option value="CREW">Kolonne</option>
            <option value="EMPLOYEE">Mitarbeiter</option>
            <option value="FREE">Freitext / abweichend</option>
          </select>
        </Field>
        <Field label="Kolonne auswählen">
          <select
            className={inputClassName}
            disabled={labelType !== "CREW"}
            name="crewLabel"
            onChange={(event) => {
              const selectedOption = crewOptions.find(
                (option) => option.label === event.target.value,
              );
              updateRatesFromOptions(selectedOption ? [selectedOption] : []);
            }}
          >
            <option value="">Keine Kolonne ausgewählt</option>
            {crewOptions.map((option) => (
              <option key={option.id} value={option.label}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <div className="md:col-span-2">
          <div className="text-sm font-semibold text-gray-700">
            Mitarbeiter auswählen
          </div>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {Array.from({ length: employeeSelectCount }, (_, index) => (
              <select
                className={inputClassName.replace("mt-2 ", "")}
                disabled={labelType !== "EMPLOYEE"}
                key={index}
                name="employeeLabels"
                onChange={(event) => {
                  const form = event.currentTarget.form;
                  const selectedLabels = form
                    ? Array.from(
                        form.querySelectorAll<HTMLSelectElement>(
                          'select[name="employeeLabels"]',
                        ),
                      )
                        .map((select) => select.value)
                        .filter(Boolean)
                    : [];
                  updateRatesFromOptions(
                    selectedLabels
                      .map((label) =>
                        employeeOptions.find((option) => option.label === label),
                      )
                      .filter((option): option is HourSelectionOption => Boolean(option)),
                  );
                }}
              >
                <option value="">
                  {labelType === "EMPLOYEE"
                    ? `Mitarbeiter ${index + 1} auswählen`
                    : "Nur aktiv bei Art Mitarbeiter"}
                </option>
                {employeeOptions.map((option) => (
                  <option key={option.id} value={option.label}>
                    {option.label}
                  </option>
                ))}
              </select>
            ))}
          </div>
          <p className="mt-2 text-xs leading-5 text-gray-500">
            Die Anzahl der Auswahlfelder richtet sich nach „Anzahl Mitarbeiter“.
          </p>
        </div>
        <Field label="Freitext / abweichend">
          <input
            className={inputClassName}
            disabled={labelType !== "FREE"}
            name="label"
            placeholder="Nur falls keine Vorauswahl passt"
          />
        </Field>
      </FormPanel>

      <FormPanel
        description="Arbeitszeit und berechnete Stunden je Mitarbeiter."
        title="Zeit & Menge"
      >
        <Field label="Datum">
          <input
            className={inputClassName}
            defaultValue={defaultDate}
            name="entryDate"
            type="date"
          />
        </Field>
        <Field label="Beginn">
          <input className={inputClassName} name="startsAt" type="time" />
        </Field>
        <Field label="Ende">
          <input className={inputClassName} name="endsAt" type="time" />
        </Field>
        <Field label="Pause h">
          <input className={inputClassName} name="breakHours" placeholder="0" />
        </Field>
        <Field label="Anzahl Mitarbeiter">
          <input
            className={inputClassName}
            min="1"
            name="employeeCount"
            onChange={(event) => {
              setEmployeeCount(event.target.value);
            }}
            step="1"
            type="number"
            value={employeeCount}
          />
        </Field>
        <Field label="Stunden je Mitarbeiter">
          <input className={inputClassName} name="hoursPerEmployee" placeholder="0,00" />
        </Field>
      </FormPanel>

      <FormPanel
        description="Sätze werden für die Auswertung verwendet und können bei Bedarf manuell angepasst werden."
        title="Sätze & Bemerkung"
      >
        <Field label="EK real €/h">
          <input
            className={inputClassName}
            name="realRate"
            onChange={(event) => setRealRate(event.target.value)}
            placeholder="0,00"
            value={realRate}
          />
        </Field>
        <Field label="Interner Satz €/h">
          <input
            className={inputClassName}
            name="internalRate"
            onChange={(event) => setInternalRate(event.target.value)}
            placeholder="0,00"
            value={internalRate}
          />
        </Field>
        <Field label="Kostenart Leistungsmeldung">
          <select
            className={inputClassName}
            name="costCategory"
            onChange={(event) => setCostCategory(event.target.value)}
            value={costCategory}
          >
            <option value="LOHN">Lohn</option>
            <option value="GEHALT_SONSTIGES">Gehalt / Sonstiges</option>
          </select>
        </Field>
        <Field className="md:col-span-2" label="Bemerkung">
          <input className={inputClassName} name="notes" />
        </Field>
      </FormPanel>

      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-600">
          Der Eintrag wird als manuelle Stunde in dieser Leistungsmeldung gespeichert.
        </p>
        <button className={primaryButtonClassName} type="submit">
          Stunden hinzufügen
        </button>
      </div>
    </form>
  );
}

function Field({
  children,
  className = "",
  label,
}: {
  children: React.ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <label className={`block text-sm font-semibold text-gray-700 ${className}`}>
      {label}
      {children}
    </label>
  );
}

function FormPanel({
  children,
  description,
  title,
}: {
  children: React.ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <div className="mb-4">
        <h3 className="text-sm font-bold uppercase tracking-wide text-gray-950">
          {title}
        </h3>
        <p className="mt-1 text-xs leading-5 text-gray-500">{description}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">{children}</div>
    </section>
  );
}

function parseMoney(value: string) {
  const parsed = Number(value.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseEmployeeCount(value: string) {
  const parsed = Number(value.replace(/\./g, "").replace(",", "."));

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 1;
  }

  return Math.round(parsed);
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function majorityCostCategory(categories: string[]) {
  if (categories.length === 0) return "LOHN";

  const counts = new Map<string, number>();
  for (const category of categories) {
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }

  let best = "LOHN";
  let bestCount = 0;
  for (const [category, count] of counts) {
    if (count > bestCount) {
      best = category;
      bestCount = count;
    }
  }

  return best;
}

function formatMoneyInput(value: number) {
  if (!value) return "";
  return new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value);
}
