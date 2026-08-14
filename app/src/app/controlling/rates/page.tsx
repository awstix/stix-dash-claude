import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import {
  createRateSetFromPreviousYear,
  deleteRateSet,
  revertRateChange,
  revertRateChangeBatch,
  saveAllEmployeeGroupRates,
  saveAllInventoryCategoryRates,
  saveAllInventoryItemRates,
  saveEmployeeGroupRate,
} from "./actions";
import { RaiseRatesPanel } from "./RaiseRatesPanel";

export default async function ControllingRatesPage({
  searchParams,
}: {
  searchParams?: Promise<{
    archive?: string;
    notice?: string;
    noticeType?: string;
    open?: string;
    year?: string;
  }>;
}) {
  const params = (await searchParams) ?? {};
  const showArchive = params.archive === "1" || params.open === "rate-archive";
  const openSection = params.open;
  const notice = typeof params.notice === "string" ? params.notice : null;
  const noticeType = params.noticeType === "error" ? "error" : "success";
  const rateSets = await prisma.controllingRateSet.findMany({
    orderBy: {
      year: "desc",
    },
  });
  const selectedYear =
    Number(params.year) ||
    rateSets.find((rateSet) => rateSet.isDefault)?.year ||
    rateSets[0]?.year ||
    new Date().getFullYear();
  const selectedRateSet =
    rateSets.find((rateSet) => rateSet.year === selectedYear) ?? rateSets[0] ?? null;
  const [employeeGroupRates, categories, items, categoryRates, itemRates, changes] = await Promise.all([
    prisma.controllingEmployeeGroupRate.findMany({
      where: {
        rateSetId: selectedRateSet?.id,
      },
      orderBy: [
        {
          sortOrder: "asc",
        },
        {
          name: "asc",
        },
      ],
    }),
    prisma.inventoryCategory.findMany({
      orderBy: [
        {
          parentCategoryId: "asc",
        },
        {
          sortOrder: "asc",
        },
        {
          name: "asc",
        },
      ],
      include: {
        parentCategory: true,
      },
    }),
    prisma.inventoryItem.findMany({
      where: {
        status: {
          not: "DELETED",
        },
      },
      orderBy: [
        {
          objectNumber: "asc",
        },
        {
          name: "asc",
        },
      ],
      include: {
        category: {
          include: {
            parentCategory: true,
          },
        },
      },
      take: 500,
    }),
    prisma.controllingInventoryCategoryRate.findMany({
      where: {
        rateSetId: selectedRateSet?.id,
      },
    }),
    prisma.controllingInventoryItemRate.findMany({
      where: {
        rateSetId: selectedRateSet?.id,
      },
    }),
    prisma.controllingRateChangeLog.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: showArchive ? 250 : 20,
    }),
  ]);
  const changeBatches = groupChangeBatches(changes);
  const categoryRateById = new Map(categoryRates.map((rate) => [rate.categoryId, rate]));
  const itemRateById = new Map(itemRates.map((rate) => [rate.itemId, rate]));
  const categoriesWithRates = categories.map((category) => {
    const rate = categoryRateById.get(category.id);

    return {
      ...category,
      billingRateCents: rate?.billingRateCents ?? category.billingRateCents,
      idleBillingRateCents: rate?.idleBillingRateCents ?? category.idleBillingRateCents,
    };
  });
  const itemsWithRates = items.map((item) => {
    const rate = itemRateById.get(item.id);

    return {
      ...item,
      billingRateCents: rate?.billingRateCents ?? item.billingRateCents,
      idleBillingRateCents: rate?.idleBillingRateCents ?? item.idleBillingRateCents,
    };
  });

  // "Zuletzt geändert" per row - keyed by the id of the actual rate record
  // (ControllingEmployeeGroupRate / ControllingInventoryCategoryRate /
  // ControllingInventoryItemRate), not the employee group/category/item
  // itself. Only known once those are loaded above, so this is a second
  // query rather than part of the first Promise.all.
  const rateTargetIds = [
    ...employeeGroupRates.map((rate) => rate.id),
    ...categoryRates.map((rate) => rate.id),
    ...itemRates.map((rate) => rate.id),
  ];
  const latestChangeLogs = rateTargetIds.length
    ? await prisma.controllingRateChangeLog.findMany({
        where: {
          targetId: {
            in: rateTargetIds,
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        select: {
          changedByName: true,
          createdAt: true,
          targetId: true,
        },
      })
    : [];
  const lastChangeByTargetId = new Map<
    string,
    { changedByName: string | null; createdAt: Date }
  >();
  for (const log of latestChangeLogs) {
    if (!lastChangeByTargetId.has(log.targetId)) {
      lastChangeByTargetId.set(log.targetId, {
        changedByName: log.changedByName,
        createdAt: log.createdAt,
      });
    }
  }

  return (
    <AppShell
      description="Verrechnungssätze für Mitarbeitergruppen, Inventarkategorien und einzelne Objekte verwalten."
      title="Controlling · Verrechnungssätze"
    >
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          href="/controlling/performance"
        >
          Leistungsmeldung
        </Link>
        <Link
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          href={showArchive ? "/controlling/rates" : "/controlling/rates?archive=1#rate-archive"}
        >
          {showArchive ? "Archiv ausblenden" : "Änderungsarchiv"}
        </Link>
      </div>

      <section className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-amber-950">
          Sensibler Bereich
        </h2>
        <p className="mt-1 max-w-5xl text-sm leading-6 text-amber-900">
          Diese Werte fließen in das Controlling ein. Später wird hier die
          Rechteverwaltung greifen, damit nicht jeder Mitarbeiter Verrechnungssätze
          sehen oder ändern kann.
        </p>
      </section>

      {notice ? (
        <section
          className={`mb-6 rounded-2xl border p-4 shadow-sm ${
            noticeType === "error"
              ? "border-red-200 bg-red-50"
              : "border-emerald-200 bg-emerald-50"
          }`}
        >
          <p
            className={`text-sm font-semibold ${
              noticeType === "error" ? "text-red-950" : "text-emerald-950"
            }`}
          >
            {notice}
          </p>
        </section>
      ) : null}

      <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-end">
          <div>
            <h2 className="text-lg font-semibold text-gray-950">
              Satzstand / Jahr
            </h2>
            <p className="mt-1 text-sm text-gray-700">
              Alle Verrechnungssätze werden im gewählten Jahr gepflegt. Neue
              Jahre können aus dem aktuellen Satzstand kopiert und danach
              gesammelt angepasst werden.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {rateSets.map((rateSet) => (
                <Link
                  className={`rounded-xl border px-4 py-2 text-sm font-semibold ${
                    rateSet.year === selectedYear
                      ? "border-gray-950 bg-gray-950 text-white"
                      : "border-gray-300 bg-white text-gray-800 hover:bg-gray-50"
                  }`}
                  href={`/controlling/rates?year=${rateSet.year}`}
                  key={rateSet.id}
                >
                  {rateSet.year}
                </Link>
              ))}
            </div>
          </div>
          <div className="grid gap-3">
            <form
              action={createRateSetFromPreviousYear}
              className="grid gap-2 sm:grid-cols-[120px_120px_auto]"
            >
              <input name="sourceYear" type="hidden" value={selectedYear} />
              <label className="text-sm font-semibold text-gray-800">
                Aus Jahr
                <input
                  className={inputClassName}
                  defaultValue={selectedYear}
                  disabled
                />
              </label>
              <label className="text-sm font-semibold text-gray-800">
                Neues Jahr
                <input
                  className={inputClassName}
                  defaultValue={selectedYear + 1}
                  name="targetYear"
                />
              </label>
              <button className={`${smallButtonClassName} mt-7`} type="submit">
                Neues Jahr erstellen
              </button>
            </form>
            <details className="rounded-xl border border-red-200 bg-red-50 p-3">
              <summary className="cursor-pointer text-sm font-semibold text-red-950">
                Satzstand {selectedYear} löschen
              </summary>
              <form action={deleteRateSet} className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                <input name="rateSetId" type="hidden" value={selectedRateSet?.id ?? ""} />
                <label className="text-sm font-semibold text-red-950">
                  Zur Bestätigung LÖSCHEN eingeben
                  <input
                    className="mt-2 w-full rounded-xl border border-red-300 bg-white px-3 py-2 text-sm text-red-950 outline-none focus:border-red-900"
                    name="confirmation"
                    placeholder="LÖSCHEN"
                  />
                </label>
                <button
                  className="mt-7 rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-900 hover:bg-red-100"
                  type="submit"
                >
                  Satzstand löschen
                </button>
              </form>
            </details>
          </div>
        </div>
      </section>

      <RaiseRatesPanel
        categories={categoriesWithRates}
        employeeGroupRates={employeeGroupRates}
        items={itemsWithRates}
        rateSetId={selectedRateSet?.id ?? ""}
        year={selectedYear}
      />

      <div className="mt-6 space-y-5">
        <RateDetails
          count={employeeGroupRates.length}
          defaultOpen={openSection === "employee-group-rates"}
          description="Sätze je Mitarbeitergruppe. Über das Jahr können Sätze sauber getrennt gepflegt werden."
          id="employee-group-rates"
          title="Mitarbeitergruppen"
        >
          <div className="space-y-3">
            <EmployeeGroupRateForm
              rateSetId={selectedRateSet?.id ?? ""}
              year={selectedYear}
            />
            <form action={saveAllEmployeeGroupRates}>
              <input name="rateSetId" type="hidden" value={selectedRateSet?.id ?? ""} />
              <input name="pageYear" type="hidden" value={selectedYear} />
              <div className="rounded-xl border border-gray-200 bg-white text-sm text-gray-900">
                <div className="hidden grid-cols-[1.25fr_0.55fr_0.75fr_0.9fr_1.25fr] gap-2 rounded-t-xl bg-gray-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-950 lg:grid">
                  <span>Gruppe</span>
                  <span>Jahr</span>
                  <span>EK real €/h</span>
                  <span>Interner Satz €/h</span>
                  <span>Beschreibung</span>
                </div>
                <div className="divide-y divide-gray-100">
                  {employeeGroupRates.map((rate) => (
                    <EmployeeGroupRateRow
                      key={rate.id}
                      lastChange={lastChangeByTargetId.get(rate.id)}
                      rate={rate}
                    />
                  ))}
                </div>
              </div>
              {employeeGroupRates.length > 0 ? (
                <button
                  className={`${primaryButtonClassName} mt-3`}
                  type="submit"
                >
                  Alle Mitarbeitergruppen speichern
                </button>
              ) : null}
            </form>
          </div>
        </RateDetails>

        <RateDetails
          count={categories.length}
          defaultOpen={openSection === "inventory-category-rates"}
          description="Normale und Stillstandssätze je Kategorie oder Unterkategorie."
          id="inventory-category-rates"
          title="Inventarkategorien / Unterkategorien"
        >
          <form action={saveAllInventoryCategoryRates}>
            <input name="rateSetId" type="hidden" value={selectedRateSet?.id ?? ""} />
            <input name="pageYear" type="hidden" value={selectedYear} />
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="w-full min-w-[900px] text-left text-sm text-gray-900">
                <thead className="bg-gray-100 text-xs uppercase tracking-wide text-gray-950">
                  <tr>
                    <th className="px-3 py-2">Kategorie</th>
                    <th className="px-3 py-2">Übergeordnet</th>
                    <th className="px-3 py-2">Normal €/Einheit</th>
                    <th className="px-3 py-2">Stillstand €/Einheit</th>
                    <th className="px-3 py-2">Zuletzt geändert</th>
                  </tr>
                </thead>
                <tbody>
                  {categoriesWithRates.map((category) => {
                    const rate = categoryRateById.get(category.id);
                    const lastChange = rate ? lastChangeByTargetId.get(rate.id) : undefined;

                    return (
                      <tr className="border-t border-gray-100" key={category.id}>
                        <td className="px-3 py-2 font-semibold text-gray-950">
                          <input name="categoryId" type="hidden" value={category.id} />
                          {category.name}
                        </td>
                        <td className="px-3 py-2 text-gray-800">
                          {category.parentCategory?.name || "—"}
                        </td>
                        <td className="px-3 py-2">
                          <input
                            className={inputClassName}
                            defaultValue={formatMoneyInput(category.billingRateCents)}
                            name="realRate"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            className={inputClassName}
                            defaultValue={formatMoneyInput(category.idleBillingRateCents)}
                            name="idleRate"
                          />
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-500">
                          {formatLastChange(lastChange)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {categories.length > 0 ? (
              <button className={`${primaryButtonClassName} mt-3`} type="submit">
                Alle Kategorien speichern
              </button>
            ) : null}
          </form>
        </RateDetails>

        <RateDetails
          count={items.length}
          defaultOpen={openSection === "inventory-item-rates"}
          description="Einzelne Objekte können eigene Sätze haben. Diese überschreiben später den Kategoriesatz."
          id="inventory-item-rates"
          title="Inventarobjekte"
        >
          <form action={saveAllInventoryItemRates}>
            <input name="rateSetId" type="hidden" value={selectedRateSet?.id ?? ""} />
            <input name="pageYear" type="hidden" value={selectedYear} />
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="w-full min-w-[1050px] text-left text-sm text-gray-900">
                <thead className="bg-gray-100 text-xs uppercase tracking-wide text-gray-950">
                  <tr>
                    <th className="px-3 py-2">Objekt</th>
                    <th className="px-3 py-2">Kategorie</th>
                    <th className="px-3 py-2">Normal €/Einheit</th>
                    <th className="px-3 py-2">Stillstand €/Einheit</th>
                    <th className="px-3 py-2">Zuletzt geändert</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsWithRates.map((item) => {
                    const rate = itemRateById.get(item.id);
                    const lastChange = rate ? lastChangeByTargetId.get(rate.id) : undefined;

                    return (
                      <tr className="border-t border-gray-100" key={item.id}>
                        <td className="px-3 py-2 font-semibold text-gray-950">
                          <input name="itemId" type="hidden" value={item.id} />
                          {item.objectNumber ? `${item.objectNumber} · ` : ""}
                          {item.name}
                        </td>
                        <td className="px-3 py-2 text-gray-800">
                          {item.category?.name || "—"}
                        </td>
                        <td className="px-3 py-2">
                          <input
                            className={inputClassName}
                            defaultValue={formatMoneyInput(item.billingRateCents)}
                            name="realRate"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            className={inputClassName}
                            defaultValue={formatMoneyInput(item.idleBillingRateCents)}
                            name="idleRate"
                          />
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-500">
                          {formatLastChange(lastChange)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {items.length > 0 ? (
              <button className={`${primaryButtonClassName} mt-3`} type="submit">
                Alle Objekte speichern
              </button>
            ) : null}
          </form>
        </RateDetails>

        {showArchive ? (
          <div className="scroll-mt-28" id="rate-archive">
            <RateDetails
              count={changes.length}
              defaultOpen
              description="Nachvollziehbare Änderungen. Sammelläufe können komplett oder einzeln zurückgesetzt werden."
              title="Änderungsarchiv"
            >
              <div className="space-y-3">
                {changeBatches.map((batch) => (
                  <details
                    className="group/archive rounded-xl border border-gray-200 bg-white p-3 shadow-sm"
                    key={batch.batchId}
                  >
                  <summary className="cursor-pointer list-none">
                    <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto_auto] lg:items-center">
                      <div>
                        <p className="text-sm font-semibold text-gray-950">
                          {batch.title}
                        </p>
                        <p className="mt-1 text-xs font-medium text-gray-800">
                          {formatDateTime(batch.createdAt)} · {batch.count} Änderungen
                          {batch.changeReason ? ` · ${batch.changeReason}` : ""}
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-gray-800">
                        {batch.openCount > 0
                          ? `${batch.openCount} offen`
                          : "alles rückgängig"}
                      </span>
                      {batch.openCount > 0 ? (
                        <form action={revertRateChangeBatch}>
                          <input name="batchId" type="hidden" value={batch.realBatchId ?? ""} />
                          <input name="logIds" type="hidden" value={batch.logIds.join(",")} />
                          <button className={smallButtonClassName} type="submit">
                            Alles rückgängig
                          </button>
                        </form>
                      ) : (
                        <span />
                      )}
                      <span
                        aria-hidden="true"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-300 bg-white text-gray-950 transition-transform group-open/archive:rotate-180"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2.5"
                          viewBox="0 0 24 24"
                        >
                          <path d="m6 9 6 6 6-6" />
                        </svg>
                      </span>
                    </div>
                  </summary>
                  <div className="mt-3 overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full min-w-[840px] text-left text-sm text-gray-900">
                      <thead className="bg-gray-100 text-xs uppercase tracking-wide text-gray-950">
                        <tr>
                          <th className="px-3 py-2">Ziel</th>
                          <th className="px-3 py-2">Feld</th>
                          <th className="px-3 py-2">Alt</th>
                          <th className="px-3 py-2">Neu</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2">Aktion</th>
                        </tr>
                      </thead>
                      <tbody>
                        {batch.changes.map((change) => (
                          <tr className="border-t border-gray-100" key={change.id}>
                            <td className="px-3 py-2 font-semibold text-gray-950">
                              {change.targetLabel}
                            </td>
                            <td className="px-3 py-2 text-gray-900">
                              {fieldLabel(change.fieldName)}
                            </td>
                            <td className="px-3 py-2">
                              {formatMoney(change.previousValueCents)}
                            </td>
                            <td className="px-3 py-2">
                              {formatMoney(change.newValueCents)}
                            </td>
                            <td className="px-3 py-2 text-gray-900">
                              {change.revertedAt ? "rückgängig" : "offen"}
                            </td>
                            <td className="px-3 py-2">
                              {change.revertedAt ? (
                                <span className="text-xs font-semibold text-gray-800">
                                  erledigt
                                </span>
                              ) : (
                                <form action={revertRateChange}>
                                  <input name="id" type="hidden" value={change.id} />
                                  <button className={smallButtonClassName} type="submit">
                                    Rückgängig
                                  </button>
                                </form>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  </details>
                ))}
              </div>
            </RateDetails>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}

function groupChangeBatches(
  changes: Array<{
    changeReason: string | null;
    changeType: string;
    batchId: string | null;
    batchLabel: string | null;
    createdAt: Date;
    fieldName: string;
    id: string;
    newValueCents: number | null;
    previousValueCents: number | null;
    revertedAt: Date | null;
    targetLabel: string;
    targetType: string;
  }>,
) {
  const batches = new Map<
    string,
    {
      batchId: string;
      batchLabel: string | null;
      changeReason: string | null;
      changes: Array<{
        fieldName: string;
        id: string;
        newValueCents: number | null;
        previousValueCents: number | null;
        revertedAt: Date | null;
        targetLabel: string;
      }>;
      count: number;
      createdAt: Date;
      logIds: string[];
      openCount: number;
      realBatchId: string | null;
      title: string;
    }
  >();

  for (const change of changes) {
    const legacyMinute = new Date(change.createdAt);
    legacyMinute.setSeconds(0, 0);
    const batchId = change.batchId
      ? change.batchId
      : change.changeType === "RAISE"
        ? `legacy-${change.targetType}-${change.changeReason ?? ""}-${legacyMinute.toISOString()}`
        : `single-${change.id}`;
    const title = archiveGroupTitle(change);

    const existing = batches.get(batchId);

    if (existing) {
      existing.count += 1;
      existing.changes.push(change);
      existing.logIds.push(change.id);
      existing.openCount += change.revertedAt ? 0 : 1;
      if (change.createdAt > existing.createdAt) {
        existing.createdAt = change.createdAt;
      }
      continue;
    }

    batches.set(batchId, {
      batchId,
      batchLabel: change.batchLabel,
      changeReason: change.changeReason,
      changes: [change],
      count: 1,
      createdAt: change.createdAt,
      logIds: [change.id],
      openCount: change.revertedAt ? 0 : 1,
      realBatchId: change.batchId,
      title,
    });
  }

  return Array.from(batches.values()).sort(
    (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
  );
}

function archiveGroupTitle(change: {
  batchLabel: string | null;
  changeType: string;
  createdAt: Date;
  fieldName: string;
  newValueCents: number | null;
  previousValueCents: number | null;
  targetType: string;
}) {
  const year = change.createdAt.getFullYear();

  if (change.batchLabel) {
    return `${year} · ${change.batchLabel}`;
  }

  if (change.changeType === "RAISE") {
    const diffCents =
      (change.newValueCents ?? 0) - (change.previousValueCents ?? 0);
    const sign = diffCents >= 0 ? "+" : "";

    return `${year} · ${targetTypeLabel(change.targetType)} angehoben um ${sign}${formatMoney(diffCents)}`;
  }

  return `${year} · ${targetTypeLabel(change.targetType)} · ${fieldLabel(change.fieldName)} geändert`;
}

function EmployeeGroupRateForm({
  rateSetId,
  year,
}: {
  rateSetId: string;
  year: number;
}) {
  return (
    <form
      action={saveEmployeeGroupRate}
      className="grid gap-3 rounded-xl border border-gray-200 bg-white p-3 lg:grid-cols-[1.25fr_0.55fr_0.75fr_0.9fr_1.25fr_auto] lg:items-end"
    >
      <input name="rateSetId" type="hidden" value={rateSetId} />
      <CompactInput
        defaultValue=""
        label="Gruppe"
        name="name"
        placeholder="Gruppe"
      />
      <CompactInput defaultValue={String(year)} label="Jahr" name="year" placeholder="Jahr" />
      <CompactInput defaultValue="" label="EK real €/h" name="realRate" placeholder="EK real €/h" />
      <CompactInput
        defaultValue=""
        label="Interner Satz €/h"
        name="internalRate"
        placeholder="Interner Satz €/h"
      />
      <CompactInput
        defaultValue=""
        label="Beschreibung"
        name="description"
        placeholder="Beschreibung"
      />
      <button className={`${smallButtonClassName} w-full lg:w-auto`} type="submit">
        Neuen Satz speichern
      </button>
    </form>
  );
}

/** Existing-row variant, deliberately not a <form> - all rows share ONE
 * wrapping form (rendered by the caller) so they can be edited and saved
 * together instead of one submit per row. */
function EmployeeGroupRateRow({
  lastChange,
  rate,
}: {
  lastChange?: { changedByName: string | null; createdAt: Date };
  rate: {
    description: string | null;
    id: string;
    internalRateCents: number;
    name: string;
    realRateCents: number;
    validFrom: Date | null;
  };
}) {
  return (
    <div className="grid gap-2 px-3 py-3 lg:grid-cols-[1.25fr_0.55fr_0.75fr_0.9fr_1.25fr] lg:items-center">
      <input name="id" type="hidden" value={rate.id} />
      <div>
        <CompactInput defaultValue={rate.name} label="Gruppe" name="name" placeholder="Gruppe" readOnly />
        <p className="mt-1 text-[11px] text-gray-500">{formatLastChange(lastChange)}</p>
      </div>
      <CompactInput
        defaultValue={rate.validFrom ? String(rate.validFrom.getUTCFullYear()) : ""}
        label="Jahr"
        name="year"
        placeholder="Jahr"
      />
      <CompactInput
        defaultValue={formatMoneyInput(rate.realRateCents)}
        label="EK real €/h"
        name="realRate"
        placeholder="EK real €/h"
      />
      <CompactInput
        defaultValue={formatMoneyInput(rate.internalRateCents)}
        label="Interner Satz €/h"
        name="internalRate"
        placeholder="Interner Satz €/h"
      />
      <CompactInput
        defaultValue={rate.description ?? ""}
        label="Beschreibung"
        name="description"
        placeholder="Beschreibung"
      />
    </div>
  );
}

function CompactInput({
  defaultValue,
  label,
  name,
  placeholder,
  readOnly = false,
}: {
  defaultValue: string;
  label: string;
  name: string;
  placeholder: string;
  readOnly?: boolean;
}) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-800 lg:text-[0px]">
      <span className="lg:sr-only">{label}</span>
      <input
        className={compactInputClassName}
        defaultValue={defaultValue}
        name={name}
        placeholder={placeholder}
        readOnly={readOnly}
      />
    </label>
  );
}

function RateDetails({
  children,
  count,
  defaultOpen = false,
  description,
  id,
  title,
}: {
  children: React.ReactNode;
  count: number;
  defaultOpen?: boolean;
  description: string;
  id?: string;
  title: string;
}) {
  return (
    <details
      className="group scroll-mt-28 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
      id={id}
      open={defaultOpen}
    >
      <summary className="cursor-pointer list-none">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-950">{title}</h2>
            <p className="mt-1 text-sm text-gray-600">
              {description} · {count.toLocaleString("de-DE")} Einträge
            </p>
          </div>
          <Chevron />
        </div>
      </summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}

function Chevron() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-300 bg-white text-gray-950 transition-transform group-open:rotate-180"
    >
      <svg
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.5"
        viewBox="0 0 24 24"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </span>
  );
}

const inputClassName =
  "mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900";
const compactInputClassName =
  "mt-1 w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm text-gray-950 outline-none focus:border-gray-900 lg:mt-0";
const smallButtonClassName =
  "rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50";
const primaryButtonClassName =
  "inline-flex items-center justify-center rounded-xl bg-gray-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800";

function formatLastChange(
  entry?: { changedByName: string | null; createdAt: Date },
) {
  if (!entry) return "—";

  const date = new Intl.DateTimeFormat("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(entry.createdAt);

  return entry.changedByName ? `${date} · ${entry.changedByName}` : date;
}

function formatMoneyInput(cents?: number | null) {
  if (!cents) return "";
  return new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function formatMoney(cents?: number | null) {
  if (cents === null || cents === undefined) return "—";
  return new Intl.NumberFormat("de-DE", {
    currency: "EUR",
    style: "currency",
  }).format(cents / 100);
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function targetTypeLabel(value: string) {
  const labels: Record<string, string> = {
    EMPLOYEE_GROUP: "Mitarbeitergruppe",
    INVENTORY_CATEGORY: "Inventarkategorie",
    INVENTORY_CATEGORY_RATE: "Inventarkategorie",
    INVENTORY_ITEM: "Inventarobjekt",
    INVENTORY_ITEM_RATE: "Inventarobjekt",
  };
  return labels[value] ?? value;
}

function fieldLabel(value: string) {
  const labels: Record<string, string> = {
    billingRateCents: "Normal",
    "employee-group-rates": "Mitarbeitergruppe",
    idleBillingRateCents: "Stillstand",
    internalRateCents: "Interner Satz",
    realRateCents: "EK real",
  };
  return labels[value] ?? value;
}
