import { Prisma } from "@prisma/client";
import { ActionIcon } from "@/components/ActionIcon";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import {
  createInitialTest,
  updateInitialTest,
} from "./actions";
import { DeleteInitialTestButton } from "./DeleteInitialTestButton";
import { InitialTestShareButtons } from "./InitialTestShareButtons";
import { RemoveInitialTestPdfButton } from "./RemoveInitialTestPdfButton";

function dateInput(date: Date | null) {
  return date?.toISOString().slice(0, 10) ?? "";
}

function germanDate(date: Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function validity(validUntil: Date | null) {
  if (!validUntil) {
    return { className: "bg-gray-200 text-gray-950", label: "Keine Gültigkeit" };
  }
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const soon = new Date(today);
  soon.setUTCDate(soon.getUTCDate() + 90);
  if (validUntil < today) {
    return { className: "bg-red-200 text-red-950", label: "Abgelaufen" };
  }
  if (validUntil <= soon) {
    return { className: "bg-amber-200 text-amber-950", label: "Läuft bald ab" };
  }
  return { className: "bg-green-200 text-green-950", label: "Gültig" };
}

export default async function InitialTestsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; status?: string }>;
}) {
  const params = await searchParams;
  const q = String(params.q ?? "").trim();
  const category = String(params.category ?? "").trim();
  const status = String(params.status ?? "").trim();
  const exportParams = new URLSearchParams();
  if (q) exportParams.set("q", q);
  if (category) exportParams.set("category", category);
  if (status) exportParams.set("status", status);
  const exportHref = `/inventory/initial-tests/export${
    exportParams.size ? `?${exportParams.toString()}` : ""
  }`;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const soon = new Date(today);
  soon.setUTCDate(soon.getUTCDate() + 90);

  const where: Prisma.InventoryInitialTestWhereInput = {
    ...(q
      ? {
          OR: [
            { productCode: { contains: q } },
            { productName: { contains: q } },
            { testNumber: { contains: q } },
            { description: { contains: q } },
          ],
        }
      : {}),
    ...(category ? { category } : {}),
    ...(status === "valid" ? { validUntil: { gt: soon } } : {}),
    ...(status === "soon" ? { validUntil: { gte: today, lte: soon } } : {}),
    ...(status === "expired" ? { validUntil: { lt: today } } : {}),
    ...(status === "missing" ? { validUntil: null } : {}),
  };

  const [tests, categoryRows] = await Promise.all([
    prisma.inventoryInitialTest.findMany({
      where,
      orderBy: [{ category: "asc" }, { productName: "asc" }],
    }),
    prisma.inventoryInitialTest.findMany({
      distinct: ["category"],
      select: { category: true },
      where: { category: { not: null } },
      orderBy: { category: "asc" },
    }),
  ]);
  const categories = categoryRows
    .map((row) => row.category)
    .filter((value): value is string => Boolean(value));

  return (
    <AppShell
      title="Erstprüfungen"
      description="Erst- und Eignungsprüfungen für Asphaltmischgut, Schüttgüter und weitere Verkaufsprodukte."
    >
      <section className="rounded-2xl border border-gray-300 bg-white p-6 text-gray-950 shadow-sm">
        <div className="flex flex-wrap items-start gap-3">
          <details>
            <summary className="inline-flex cursor-pointer list-none rounded-xl bg-gray-950 px-4 py-2 text-sm font-bold text-white hover:bg-gray-800">
              + Erstprüfung anlegen
            </summary>
            <InitialTestForm action={createInitialTest} submitLabel="Erstprüfung speichern" />
          </details>
          <a
            className="inline-flex rounded-xl border border-emerald-700 bg-emerald-800 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
            href={exportHref}
          >
            Excel exportieren
          </a>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-gray-300 bg-white p-6 text-gray-950 shadow-sm">
        <form className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(240px,1fr)_220px_190px_auto]">
          <input
            className="rounded-xl border border-gray-400 bg-white px-3 py-2 text-gray-950 placeholder:text-gray-600"
            defaultValue={q}
            name="q"
            placeholder="ID, Sorte, Prüfungsnummer suchen …"
          />
          <select className="rounded-xl border border-gray-400 bg-white px-3 py-2 text-gray-950" defaultValue={category} name="category">
            <option value="">Alle Sortengruppen</option>
            {categories.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select className="rounded-xl border border-gray-400 bg-white px-3 py-2 text-gray-950" defaultValue={status} name="status">
            <option value="">Alle Status</option>
            <option value="valid">Gültig</option>
            <option value="soon">Läuft bald ab</option>
            <option value="expired">Abgelaufen</option>
            <option value="missing">Ohne Gültigkeit</option>
          </select>
          <button className="rounded-xl bg-gray-950 px-4 py-2 text-sm font-bold text-white">Filtern</button>
        </form>

        <div className="mt-5 rounded-xl border border-gray-300">
          <table className="w-full table-fixed text-left text-xs">
            <thead className="bg-gray-200 text-xs font-bold uppercase tracking-wide text-gray-950">
              <tr>
                <th className="w-[8%] p-2">Aktionen</th>
                <th className="w-[5%] p-2">ID</th>
                <th className="w-[16%] p-2">Material</th>
                <th className="w-[9%] p-2">Sorte</th>
                <th className="w-[7%] p-2">Gültig ab</th>
                <th className="w-[7%] p-2">Gültig bis</th>
                <th className="w-[9%] p-2">Status</th>
                <th className="w-[9%] p-2">Prüfungsnr.</th>
                <th className="w-[6%] p-2">Dichte</th>
                <th className="w-[12%] p-2">Bezeichnung</th>
                <th className="w-[12%] p-2">PDF</th>
              </tr>
            </thead>
            <tbody>
              {tests.length === 0 ? (
                <tr><td className="p-8 text-center font-semibold text-gray-700" colSpan={11}>Keine Erstprüfungen gefunden.</td></tr>
              ) : tests.map((test) => {
                const state = validity(test.validUntil);
                return (
                  <tr className="border-t border-gray-300" key={test.id}>
                    <td className="p-2 align-top">
                      <div className="flex flex-nowrap gap-1">
                        <details className="group">
                          <summary aria-label="Bearbeiten" className="inline-flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg border border-gray-500 bg-white text-base font-black text-gray-950 hover:bg-gray-100" title="Bearbeiten">✎</summary>
                          <div className="fixed inset-0 z-[var(--z-modal)] overflow-y-auto bg-black/60 p-4">
                            <div className="mx-auto my-6 max-w-6xl rounded-2xl bg-white p-6 text-gray-950 shadow-2xl">
                              <div className="flex items-center justify-between gap-4">
                                <h2 className="text-xl font-bold">Erstprüfung bearbeiten</h2>
                                <a
                                  aria-label="Popup schließen"
                                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-400 bg-white text-xl font-black text-gray-950 hover:bg-gray-100"
                                  href="/inventory/initial-tests"
                                  title="Schließen"
                                >
                                  <ActionIcon name="close" className="h-4 w-4" />
                                </a>
                              </div>
                              <InitialTestForm action={updateInitialTest} initial={test} submitLabel="Änderungen speichern" />
                              {test.pdfUrl ? (
                                <div className="mt-4 border-t border-gray-200 pt-4">
                                  <RemoveInitialTestPdfButton id={test.id} />
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </details>
                        <DeleteInitialTestButton id={test.id} name={test.productName} />
                      </div>
                    </td>
                    <td className="break-words p-2 font-black">{test.productCode ?? "—"}</td>
                    <td className="break-words p-2 font-semibold">{test.productName}</td>
                    <td className="break-words p-2">{test.category ?? "—"}</td>
                    <td className="break-words p-2">{germanDate(test.validFrom)}</td>
                    <td className="break-words p-2">{germanDate(test.validUntil)}</td>
                    <td className="p-2"><span className={`inline-flex max-w-full rounded-full px-2 py-1 text-center text-[11px] font-black leading-tight ${state.className}`}>{state.label}</span></td>
                    <td className="break-words p-2 font-semibold">{test.testNumber ?? "—"}</td>
                    <td className="break-words p-2">{test.densityTonPerCubicMeter?.toLocaleString("de-DE", { minimumFractionDigits: 3, maximumFractionDigits: 3 }) ?? "—"}</td>
                    <td className="break-words p-2">{test.description || "—"}</td>
                    <td className="p-2">
                      {test.pdfUrl ? (
                        <InitialTestShareButtons pdfUrl={test.pdfUrl} productName={test.productName} testNumber={test.testNumber} />
                      ) : <span className="font-semibold text-red-800">Kein PDF</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-gray-300 pt-4 text-sm text-gray-950">
          <span className="font-black">Legende:</span>
          <span className="rounded-full border border-green-700 bg-green-200 px-3 py-1 font-bold text-green-950">
            Grün · länger als 90 Tage gültig
          </span>
          <span className="rounded-full border border-amber-700 bg-amber-200 px-3 py-1 font-bold text-amber-950">
            Gelb · läuft innerhalb von 90 Tagen ab
          </span>
          <span className="rounded-full border border-red-700 bg-red-200 px-3 py-1 font-bold text-red-950">
            Rot · abgelaufen
          </span>
          <span className="rounded-full border border-gray-700 bg-gray-200 px-3 py-1 font-bold text-gray-950">
            Grau · Gültigkeit fehlt
          </span>
        </div>
      </section>
    </AppShell>
  );
}

type Initial = {
  id: string;
  productCode: string | null;
  productName: string;
  category: string | null;
  validFrom: Date | null;
  validUntil: Date | null;
  testNumber: string | null;
  densityTonPerCubicMeter: number | null;
  description: string | null;
  notes: string | null;
  isActive: boolean;
  pdfUrl: string | null;
};

function InitialTestForm({
  action,
  initial,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  initial?: Initial;
  submitLabel: string;
}) {
  const inputClass = "mt-2 w-full rounded-xl border border-gray-400 bg-white px-3 py-2 text-gray-950 placeholder:text-gray-600";
  return (
    <form action={action} className="mt-5 grid grid-cols-1 gap-4 text-gray-950 md:grid-cols-2 xl:grid-cols-4" encType="multipart/form-data">
      {initial ? <input name="id" type="hidden" value={initial.id} /> : null}
      <Field label="ID"><input className={inputClass} defaultValue={initial?.productCode ?? ""} name="productCode" placeholder="z. B. 242a" /></Field>
      <Field label="Asphalt-/Materialbezeichnung"><input className={inputClass} defaultValue={initial?.productName ?? ""} name="productName" placeholder="z. B. AC 11 DS (B25/55-55)" required /></Field>
      <Field label="Sorte / Schichtgruppe"><input className={inputClass} defaultValue={initial?.category ?? ""} list="initial-test-categories" name="category" placeholder="z. B. A-Deckschicht" /></Field>
      <Field label="Bezeichnung"><input className={inputClass} defaultValue={initial?.description ?? ""} name="description" placeholder="z. B. Niedertemperatur" /></Field>
      <Field label="Gültig ab"><input className={inputClass} defaultValue={dateInput(initial?.validFrom ?? null)} name="validFrom" type="date" /></Field>
      <Field label="Gültig bis"><input className={inputClass} defaultValue={dateInput(initial?.validUntil ?? null)} name="validUntil" type="date" /></Field>
      <Field label="Prüfungsnummer"><input className={inputClass} defaultValue={initial?.testNumber ?? ""} name="testNumber" placeholder="z. B. 176/2023" /></Field>
      <Field label="Dichte t/m³"><input className={inputClass} defaultValue={initial?.densityTonPerCubicMeter ?? ""} inputMode="decimal" name="densityTonPerCubicMeter" placeholder="z. B. 2,575" /></Field>
      <Field label={initial ? "PDF ersetzen (optional)" : "Erstprüfung als PDF"}>
        <input accept="application/pdf" className={inputClass} name="pdf" required={!initial} type="file" />
      </Field>
      <Field label="Bemerkung"><input className={inputClass} defaultValue={initial?.notes ?? ""} name="notes" /></Field>
      <label className="flex items-center gap-3 pt-7 text-sm font-bold text-gray-950"><input className="h-5 w-5 accent-gray-950" defaultChecked={initial?.isActive ?? true} name="isActive" type="checkbox" />Aktiv</label>
      <div className="flex items-end"><button className="rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-gray-800">{submitLabel}</button></div>
      <datalist id="initial-test-categories">
        <option value="A-Deckschicht" />
        <option value="B-Binder" />
        <option value="c-Tragschicht" />
        <option value="d-Tragdeckschicht" />
        <option value="e-wasserdurchlässig" />
        <option value="sonstiges" />
      </datalist>
    </form>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return <label className="text-sm font-bold text-gray-950">{label}{children}</label>;
}
