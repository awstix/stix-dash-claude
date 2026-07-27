import Link from "next/link";
import type { Prisma } from "@prisma/client";

import { AppShell } from "@/components/AppShell";
import { HAZARD_SYMBOLS } from "@/lib/hazard-register-constants";
import {
  nextHazardSequentialNumber,
  type HazardRegisterRow,
  readHazardRegisterTemplate,
} from "@/lib/hazard-register";
import { prisma } from "@/lib/prisma";

import { HazardRegisterTabs } from "./HazardRegisterTabs";
import { HazardRuleModal } from "./HazardRuleModal";
import { HazardousSubstanceArchiveDialog } from "./HazardousSubstanceArchiveDialog";
import { HazardousSubstanceDetailsDialog } from "./HazardousSubstanceDetailsDialog";
import { HazardousSubstanceModal } from "./HazardousSubstanceModal";
import type { EditableHazardousSubstance } from "./HazardousSubstanceModal";

export const dynamic = "force-dynamic";

function formatDate(date: Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function inputDate(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : null;
}

function editableRow(row: HazardRegisterRow): EditableHazardousSubstance {
  return {
    category: row.category,
    dataSheets: row.dataSheets.map((sheet) => ({
      displayName: sheet.displayName,
      documentType: sheet.documentType,
      id: sheet.id,
      publicUrl: sheet.publicUrl,
      uploadedAt: sheet.uploadedAt.toISOString(),
      versionDate: inputDate(sheet.versionDate),
    })),
    hazardSymbols: row.hazardSymbols,
    id: row.id,
    manufacturer: row.manufacturer,
    name: row.name,
    nextReviewDate: inputDate(row.nextReviewDate),
    operatingInstructionPresent: row.operatingInstructionPresent,
    operatingInstructionTemplateIds: row.operatingInstructionTemplateIds,
    packageUnit: row.packageUnit,
    quantity: row.quantity,
    registerSection: row.registerSection,
    repeatDays: row.repeatDays,
    repeatMonths: row.repeatMonths,
    repeatYears: row.repeatYears,
    safetyDataSheetDate: inputDate(row.safetyDataSheetDate),
    safetyDataSheetPresent: row.safetyDataSheetPresent,
    sequentialNumber: row.sequentialNumber,
    substanceType: row.substanceType,
    usageArea: row.usageArea,
  };
}

type HazardousSubstanceWithSheets =
  Prisma.SafetyHazardousSubstanceGetPayload<{
    include: { safetyDataSheets: true };
  }>;

function databaseRow(
  substance: HazardousSubstanceWithSheets,
): HazardRegisterRow {
  return {
    category: substance.category,
    dataSheets: substance.safetyDataSheets.map((sheet) => ({
      displayName: sheet.displayName,
      documentType: sheet.documentType,
      id: sheet.id,
      publicUrl: sheet.publicUrl,
      uploadedAt: sheet.uploadedAt,
      versionDate: sheet.versionDate,
    })),
    hazardSymbols: String(substance.hazardSymbols ?? "")
      .split(/[^A-Z0-9]+/)
      .filter((value) => /^GHS0[1-9]$/.test(value)),
    id: substance.id,
    manufacturer: substance.manufacturer,
    name: substance.name,
    nextReviewDate: substance.nextReviewDate,
    operatingInstructionPresent: substance.operatingInstructionPresent,
    operatingInstructionTemplateIds: String(
      substance.operatingInstructionTemplateIds ?? "",
    )
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    packageUnit: substance.packageUnit,
    quantity: substance.quantity,
    registerSection:
      substance.registerSection === "WITHOUT_BA" ? "WITHOUT_BA" : "HAZARDOUS",
    repeatDays: substance.repeatDays,
    repeatMonths: substance.repeatMonths,
    repeatYears: substance.repeatYears,
    safetyDataSheetDate: substance.safetyDataSheetDate,
    safetyDataSheetPresent: substance.safetyDataSheetPresent,
    sequentialNumber: substance.sequentialNumber,
    source: "database",
    substanceType: substance.substanceType,
    usageArea: substance.usageArea,
  };
}

export default async function HazardousSubstancesPage() {
  const [
    { rows: templateRows, rules: templateRules },
    substances,
    savedRules,
    operatingInstructionTemplates,
  ] =
    await Promise.all([
    Promise.resolve(readHazardRegisterTemplate()),
    prisma.safetyHazardousSubstance.findMany({
      include: {
        safetyDataSheets: {
          orderBy: [{ versionDate: "desc" }, { uploadedAt: "desc" }],
        },
      },
      orderBy: [{ createdAt: "asc" }],
    }),
    prisma.safetyHazardRule.findMany({
      orderBy: [{ createdAt: "asc" }],
    }),
    prisma.safetyInstructionTemplate.findMany({
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
      select: { id: true, title: true },
      where: { isActive: true, type: "OPERATING_INSTRUCTION" },
    }),
  ]);
  const rules = [
    ...templateRules,
    ...savedRules.map((rule) => ({
      implementation: rule.implementation ?? "",
      section: rule.section ?? "",
      source: rule.source,
      text: rule.text,
      topic: rule.topic,
    })),
  ];
  const bridgedTemplateRows = new Set(
    substances.flatMap((substance) =>
      substance.templateRowId ? [substance.templateRowId] : [],
    ),
  );
  const activeSubstances = substances.filter((substance) => substance.isActive);
  const rows = [
    ...templateRows.filter((row) => !bridgedTemplateRows.has(row.id)),
    ...activeSubstances.map(databaseRow),
  ];
  const suggestedSequentialNumber = nextHazardSequentialNumber([
    ...templateRows.map((row) => row.sequentialNumber),
    ...substances.map((substance) => substance.sequentialNumber),
  ]);
  const availableWorkAreas = Array.from(
    new Set([
      "Baustellen",
      "Werkstatt",
      "Mischanlage",
      "Büro",
      ...rows.flatMap((row) =>
        String(row.usageArea ?? "")
          .split(/\s*\+\s*/)
          .map((area) => area.trim())
          .filter(Boolean),
      ),
    ]),
  ).sort((left, right) => left.localeCompare(right, "de"));
  const hazardousRows = rows.filter(
    (row) => row.registerSection === "HAZARDOUS",
  );
  const withoutBaRows = rows.filter(
    (row) => row.registerSection === "WITHOUT_BA",
  );

  return (
    <AppShell
      title="Gefahrstoffe"
      description="Gefahrstoffkataster nach A-30-19-01.1 mit allen drei Reitern der Originaldatei."
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          href="/safety"
        >
          ← Arbeitssicherheit
        </Link>
        <div className="flex flex-wrap gap-3">
          <a
            className="rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-bold text-gray-800 shadow-sm hover:bg-gray-50"
            href="/safety/hazardous-substances/export"
          >
            Excel exportieren
          </a>
          <Link
            className="rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-bold text-gray-800 shadow-sm hover:bg-gray-50"
            href="/safety/hazardous-substances/archive"
          >
            Gefahrstoffarchiv
          </Link>
          <HazardousSubstanceModal
            availableWorkAreas={availableWorkAreas}
            operatingInstructionTemplates={operatingInstructionTemplates}
            suggestedSequentialNumber={suggestedSequentialNumber}
          />
          <HazardRuleModal />
        </div>
      </div>

      <HazardRegisterTabs
        hazardous={
          <RegisterSection
            includeUsageArea
            rows={hazardousRows}
            availableWorkAreas={availableWorkAreas}
            operatingInstructionTemplates={operatingInstructionTemplates}
            suggestedSequentialNumber={suggestedSequentialNumber}
            title="Gefährliche Gefahrstoffe"
          />
        }
        withoutBa={
          <RegisterSection
            rows={withoutBaRows}
            availableWorkAreas={availableWorkAreas}
            operatingInstructionTemplates={operatingInstructionTemplates}
            suggestedSequentialNumber={suggestedSequentialNumber}
            title="Gefahrstoffe ohne BA"
          />
        }
        rules={
          <section
            className="overflow-hidden rounded-2xl border border-gray-700 bg-white shadow-sm"
            style={{ color: "#000000" }}
          >
        <div className="overflow-x-auto">
          <table
            className="min-w-[1200px] border-collapse text-left text-xs font-semibold"
            style={{ color: "#000000" }}
          >
            <thead className="bg-gray-300" style={{ color: "#000000" }}>
              <tr>
                {["Thema", "Quelle", "Abschnitt", "Text", "Bemerkung / Umsetzung"].map(
                  (label) => (
                    <th className="border border-gray-700 px-3 py-2 font-extrabold" key={label}>
                      {label}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rules.map((rule, index) => (
                <tr className="align-top" key={`${rule.source}-${index}`}>
                  <td className="border border-gray-700 px-3 py-2 text-black">{rule.topic}</td>
                  <td className="border border-gray-700 px-3 py-2 text-black">{rule.source}</td>
                  <td className="w-52 border border-gray-700 px-3 py-2 text-black">{rule.section}</td>
                  <td className="max-w-3xl whitespace-pre-wrap border border-gray-700 px-3 py-2 leading-5 text-black">
                    {rule.text}
                  </td>
                  <td className="w-72 whitespace-pre-wrap border border-gray-700 px-3 py-2 leading-5 text-black">
                    {rule.implementation}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
          </section>
        }
      />
    </AppShell>
  );
}

function RegisterSection({
  includeUsageArea = false,
  availableWorkAreas,
  operatingInstructionTemplates,
  rows,
  suggestedSequentialNumber,
  title,
}: {
  includeUsageArea?: boolean;
  availableWorkAreas: string[];
  operatingInstructionTemplates: Array<{ id: string; title: string }>;
  rows: HazardRegisterRow[];
  suggestedSequentialNumber: string;
  title: string;
}) {
  return (
    <section
      className="overflow-hidden rounded-2xl border border-gray-700 bg-white shadow-sm"
      style={{ color: "#000000" }}
    >
      <div className="overflow-x-auto">
        <table
          aria-label={title}
          className="min-w-[1800px] border-collapse text-left text-xs font-semibold"
          style={{ color: "#000000" }}
        >
          <thead>
            <tr className="bg-gray-300" style={{ color: "#000000" }}>
              <th className="w-24 border border-gray-700 px-2 py-2 text-center font-extrabold text-black">
                Aktionen
              </th>
              {HAZARD_SYMBOLS.map(([code, label, imagePath]) => (
                <th
                  className="w-16 border border-gray-700 px-1.5 py-1.5 text-center font-extrabold text-black"
                  key={code}
                  title={label}
                >
                  <img
                    alt={`${code}: ${label}`}
                    className="mx-auto h-11 w-11 object-contain"
                    height={44}
                    src={imagePath}
                    width={44}
                  />
                  <span className="mt-1 block text-[10px]">{code}</span>
                </th>
              ))}
              {[
                "Stoffkategorie",
                "Lfd. Nummer",
                "Hersteller",
                "Produktname / Typ",
                "Art",
                "SDB",
                "SDB Datum",
                "BA",
                "Einheit / Gebinde",
                "Menge",
                "Jahre",
                "Mon.",
                "Tage",
                "Datum nächste Prüfung",
                ...(includeUsageArea ? ["Arbeitsbereiche"] : []),
              ].map((label) => (
                <th className="border border-gray-700 px-2.5 py-2 font-extrabold text-black" key={label}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr className="align-top" key={row.id}>
                <td className="border border-gray-700 bg-white p-1.5">
                  <div className="flex items-center justify-center gap-1">
                      <HazardousSubstanceDetailsDialog
                        operatingInstructionTemplates={
                          operatingInstructionTemplates
                        }
                        substance={editableRow(row)}
                      />
                      <HazardousSubstanceModal
                        availableWorkAreas={availableWorkAreas}
                        operatingInstructionTemplates={
                          operatingInstructionTemplates
                        }
                        suggestedSequentialNumber={suggestedSequentialNumber}
                        substance={editableRow(row)}
                      />
                      <HazardousSubstanceArchiveDialog
                        id={row.id}
                        name={row.name}
                        sequentialNumber={row.sequentialNumber}
                        substance={editableRow(row)}
                      />
                  </div>
                </td>
                {HAZARD_SYMBOLS.map(([code, label, imagePath]) => (
                  <td
                    className="h-12 border border-gray-700 bg-yellow-300 p-1 text-center font-black text-black"
                    style={{ color: "#000000" }}
                    key={code}
                  >
                    {row.hazardSymbols.includes(code) ? (
                      <img
                        alt={`${code}: ${label}`}
                        className="mx-auto h-9 w-9 object-contain"
                        height={36}
                        src={imagePath}
                        title={`${code}: ${label}`}
                        width={36}
                      />
                    ) : null}
                  </td>
                ))}
                <Cell className="bg-red-400 font-bold">{row.category}</Cell>
                <Cell>{row.sequentialNumber}</Cell>
                <Cell>{row.manufacturer}</Cell>
                <Cell className="min-w-56 font-semibold">{row.name}</Cell>
                <Cell>{row.substanceType}</Cell>
                <Cell className="bg-green-400 text-center font-black">
                  {row.safetyDataSheetPresent ? "X" : ""}
                </Cell>
                <Cell>{formatDate(row.safetyDataSheetDate)}</Cell>
                <Cell className="bg-green-400 text-center font-black">
                  {row.operatingInstructionPresent ? "X" : ""}
                </Cell>
                <Cell>{row.packageUnit}</Cell>
                <Cell>{row.quantity}</Cell>
                <Cell>{row.repeatYears}</Cell>
                <Cell>{row.repeatMonths}</Cell>
                <Cell>{row.repeatDays}</Cell>
                <Cell>{formatDate(row.nextReviewDate)}</Cell>
                {includeUsageArea ? <Cell>{row.usageArea}</Cell> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Cell({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td
      className={`border border-gray-700 px-2.5 py-1.5 text-black ${className}`}
      style={{ color: "#000000" }}
    >
      {children ?? ""}
    </td>
  );
}
