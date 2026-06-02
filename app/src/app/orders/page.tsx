import Link from "next/link";
import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { OrderCountdown } from "./OrderCountdown";

type AsphaltOrderRow = {
  projectNumber: string;
  projectName: string;
  constructionManager: string | null;
  asphaltMixNumber: string;
  asphaltMixName: string;
  quantityTons: number;
  isForeignMix: boolean;
  notes: string[];
};

function getBerlinDateInput(date = new Date()) {
  const parts = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
}

function isValidDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return !Number.isNaN(date.getTime());
}

function addDaysToDateInput(dateInput: string, days: number) {
  const [year, month, day] = dateInput.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

function dateInputToUtcDate(dateInput: string) {
  return new Date(`${dateInput}T00:00:00.000Z`);
}

function formatGermanDate(dateInput: string) {
  const [year, month, day] = dateInput.split("-").map(Number);

  return new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function formatTons(value: number) {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function getOrderHref(dateInput: string) {
  return `/orders?date=${dateInput}`;
}

function getPdfHref(dateInput: string) {
  return `/orders/pdf?date=${dateInput}`;
}

function getAsphaltKey(entry: {
  projectNumber: string;
  projectName: string;
  constructionManager: string | null;
  asphaltMixNumber: string | null;
  asphaltMixName: string | null;
  isForeignMix: boolean;
}) {
  return [
    entry.projectNumber || "-",
    entry.projectName || "-",
    entry.constructionManager || "",
    entry.asphaltMixNumber || "",
    entry.asphaltMixName || "",
    entry.isForeignMix ? "foreign" : "own",
  ].join("||");
}

function groupAsphaltEntries(
  entries: {
    projectNumber: string;
    projectName: string;
    constructionManager: string | null;
    asphaltMixNumber: string | null;
    asphaltMixName: string | null;
    quantityTons: number;
    isForeignMix: boolean;
    notes: string | null;
  }[]
) {
  const grouped = new Map<string, AsphaltOrderRow>();

  for (const entry of entries) {
    const key = getAsphaltKey(entry);
    const existing = grouped.get(key);

    if (existing) {
      existing.quantityTons += entry.quantityTons;

      if (entry.notes) {
        existing.notes.push(entry.notes);
      }

      continue;
    }

    grouped.set(key, {
      projectNumber: entry.projectNumber || "-",
      projectName: entry.projectName || "-",
      constructionManager: entry.constructionManager,
      asphaltMixNumber: entry.asphaltMixNumber || "-",
      asphaltMixName: entry.asphaltMixName || "-",
      quantityTons: entry.quantityTons,
      isForeignMix: entry.isForeignMix,
      notes: entry.notes ? [entry.notes] : [],
    });
  }

  return Array.from(grouped.values()).sort((a, b) => {
    const projectCompare = a.projectNumber.localeCompare(
      b.projectNumber,
      "de"
    );

    if (projectCompare !== 0) {
      return projectCompare;
    }

    return a.asphaltMixName.localeCompare(b.asphaltMixName, "de");
  });
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
  }>;
}) {
  const params = await searchParams;

  const todayInput = getBerlinDateInput();
  const defaultOrderDateInput = addDaysToDateInput(todayInput, 1);

  const selectedDateInput =
    params.date && isValidDateInput(params.date)
      ? params.date
      : defaultOrderDateInput;

  const previousDateInput = addDaysToDateInput(selectedDateInput, -1);
  const nextDateInput = addDaysToDateInput(selectedDateInput, 1);

  const orderDateStart = dateInputToUtcDate(selectedDateInput);
  const orderDateEnd = dateInputToUtcDate(nextDateInput);

  const asphaltEntries = await prisma.asphaltDispatchEntry.findMany({
    where: {
      workDate: {
        gte: orderDateStart,
        lt: orderDateEnd,
      },
    },
    select: {
      projectNumber: true,
      projectName: true,
      constructionManager: true,
      asphaltMixNumber: true,
      asphaltMixName: true,
      quantityTons: true,
      isForeignMix: true,
      notes: true,
    },
    orderBy: [
      {
        projectNumber: "asc",
      },
      {
        asphaltMixName: "asc",
      },
    ],
  });

  const asphaltRows = groupAsphaltEntries(asphaltEntries);

  const asphaltTotal = asphaltRows.reduce(
    (sum, row) => sum + row.quantityTons,
    0
  );

  return (
    <AppShell
      title="Bestellung"
      description="Bestellung für den Folgetag mit Asphalt, Fremd-LKW und Beton."
    >
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Aktuell angezeigt</p>
          <p className="mt-2 text-xl font-bold text-gray-900">
            {formatGermanDate(selectedDateInput)}
          </p>
          <p className="mt-2 text-xs text-gray-500">
            Standardmäßig wird morgen geöffnet.
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Bearbeitbar bis</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">16:00 Uhr</p>
          <p className="mt-2 text-xs text-gray-500">
            Danach Kontrolle und PDF-Export.
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Asphalt gesamt</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {formatTons(asphaltTotal)} t
          </p>
          <p className="mt-2 text-xs text-gray-500">
            Aus Asphaltdisposition für das gewählte Datum.
          </p>
        </div>

        <OrderCountdown deadlineHour={16} />
      </div>

      <div className="mb-6 rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 bg-gray-50 px-5 py-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Tagesbestellung
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Automatisch vorbereitet aus Disposition und LKW-Einteilung.
                Betonpositionen werden später manuell ergänzt.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href={getOrderHref(previousDateInput)}
                className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              >
                Vortag
              </Link>

              <Link
                href={getOrderHref(todayInput)}
                className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              >
                Heute
              </Link>

              <Link
                href={getOrderHref(nextDateInput)}
                className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              >
                Folgetag
              </Link>

              <Link
                href={getOrderHref(defaultOrderDateInput)}
                className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100"
              >
                Morgen
              </Link>

              <Link
                href={getPdfHref(selectedDateInput)}
                className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
              >
                PDF exportieren
              </Link>
            </div>
          </div>

          <form
            action="/orders"
            className="mt-4 grid grid-cols-1 gap-3 sm:max-w-lg sm:grid-cols-[1fr_auto]"
          >
            <input
              name="date"
              type="date"
              defaultValue={selectedDateInput}
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-900 outline-none focus:border-gray-900"
            />

            <button
              type="submit"
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            >
              Datum anzeigen
            </button>
          </form>
        </div>

        <div className="p-5">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
            Angezeigter Bestelltag:{" "}
            <strong className="text-gray-900">
              {formatGermanDate(selectedDateInput)}
            </strong>
            . Der PDF-Export verwendet genau diesen aktuell angezeigten Tag.
          </div>
        </div>
      </div>

      <section className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            1. Asphaltbestellung
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Automatisch aus der Asphaltdisposition für das gewählte Datum.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] text-left text-sm">
            <thead className="bg-gray-50 text-gray-800">
              <tr>
                <Th>Projektnummer</Th>
                <Th>Baumaßnahme</Th>
                <Th>Bauleitung / Polier</Th>
                <Th>Sortennummer</Th>
                <Th>Asphaltsorte</Th>
                <Th>Menge</Th>
                <Th>Mischgut</Th>
                <Th>Bemerkung</Th>
              </tr>
            </thead>

            <tbody>
              {asphaltRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500">
                    Für das gewählte Datum sind noch keine Asphaltpositionen in
                    der Asphaltdisposition vorhanden.
                  </td>
                </tr>
              ) : (
                asphaltRows.map((row) => (
                  <tr
                    key={`${row.projectNumber}-${row.asphaltMixNumber}-${row.asphaltMixName}-${row.isForeignMix}`}
                    className="border-t border-gray-100"
                  >
                    <Td>
                      <span className="font-semibold text-gray-900">
                        {row.projectNumber}
                      </span>
                    </Td>
                    <Td>{row.projectName}</Td>
                    <Td>{row.constructionManager ?? "-"}</Td>
                    <Td>{row.asphaltMixNumber}</Td>
                    <Td>
                      <span className="font-semibold text-gray-900">
                        {row.asphaltMixName}
                      </span>
                    </Td>
                    <Td>
                      <span className="font-bold text-gray-900">
                        {formatTons(row.quantityTons)} t
                      </span>
                    </Td>
                    <Td>
                      {row.isForeignMix ? (
                        <span className="rounded-full bg-orange-100 px-2 py-1 text-xs font-semibold text-orange-800">
                          Fremdmischgut
                        </span>
                      ) : (
                        <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
                          Eigene Anlage
                        </span>
                      )}
                    </Td>
                    <Td>
                      {row.notes.length > 0 ? (
                        <div className="max-w-[320px] whitespace-normal">
                          {row.notes.join(" · ")}
                        </div>
                      ) : (
                        "-"
                      )}
                    </Td>
                  </tr>
                ))
              )}
            </tbody>

            {asphaltRows.length > 0 ? (
              <tfoot className="border-t border-gray-200 bg-gray-50">
                <tr>
                  <td
                    colSpan={5}
                    className="p-4 text-right font-semibold text-gray-900"
                  >
                    Asphalt gesamt
                  </td>
                  <td className="p-4 font-bold text-gray-900">
                    {formatTons(asphaltTotal)} t
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </section>

      <section className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            2. Fremd-LKW / Transporte
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Soll automatisch aus der LKW-Einteilung gezogen werden.
          </p>
        </div>

        <div className="p-6">
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-5 text-sm leading-6 text-gray-600">
            Dieser Abschnitt ist vorbereitet. Im nächsten Schritt docken wir ihn
            an deine bestehenden Langstrecke-/Kurzstrecke-Modelle an, damit pro
            Baumaßnahme Fremdfahrzeuge nach Typ, Anzahl, Material und Menge
            angezeigt werden.
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            3. Betonbestellung
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Manuelle Betonpositionen mit Projekt, Betonsorte und Menge.
          </p>
        </div>

        <div className="p-6">
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-5 text-sm leading-6 text-gray-600">
            Dieser Abschnitt braucht als nächstes eigene Bestell-Tabellen in
            Prisma, damit Betonpositionen gespeichert, bearbeitet und später im
            PDF ausgegeben werden können.
          </div>
        </div>
      </section>
    </AppShell>
  );
}

function Th({ children }: { children: ReactNode }) {
  return <th className="whitespace-nowrap p-4 font-semibold">{children}</th>;
}

function Td({ children }: { children: ReactNode }) {
  return <td className="p-4 align-top text-gray-700">{children}</td>;
}