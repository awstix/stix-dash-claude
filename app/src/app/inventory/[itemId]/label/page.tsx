import Link from "next/link";
/* eslint-disable @next/next/no-img-element */
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import {
  calculateInventoryLabelLength,
  getEffectiveInventoryLabelBlockWidth,
  getInventoryLabelBlockMeta,
  getInventoryLabelValue,
  isInventoryLabelSpacerBlock,
  parseInventoryLabelBlocks,
  type InventoryLabelBlock,
} from "@/lib/inventory-labels";
import { prisma } from "@/lib/prisma";
import { InventoryLabelPrintButton } from "./InventoryLabelPrintButton";

export default async function InventoryItemLabelPage({
  params,
  searchParams,
}: {
  params: Promise<{ itemId: string }>;
  searchParams: Promise<{ template?: string }>;
}) {
  const { itemId } = await params;
  const { template: selectedTemplateId } = await searchParams;
  const [item, templates, companyInfo] = await Promise.all([
    prisma.inventoryItem.findUnique({
      include: {
        category: {
          include: {
            parentCategory: true,
          },
        },
        currentProject: {
          select: {
            name: true,
            projectNumber: true,
          },
        },
        responsibleCrew: {
          select: {
            name: true,
          },
        },
        responsibleEmployee: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      where: {
        id: itemId,
      },
    }),
    prisma.inventoryLabelTemplate.findMany({
      orderBy: [{ isDefault: "desc" }, { tapeWidthMm: "asc" }, { name: "asc" }],
    }),
    prisma.companyInfo.findUnique({
      where: {
        id: "default",
      },
    }),
  ]);

  if (!item) {
    notFound();
  }

  const selectedTemplate =
    templates.find((template) => template.id === selectedTemplateId) ??
    templates.find((template) => template.isDefault) ??
    templates[0] ??
    null;

  const blocks = selectedTemplate
    ? parseInventoryLabelBlocks(selectedTemplate.blocksJson).filter(
        (block) => block.enabled,
      )
    : [];
  const codeQuery =
    selectedTemplate?.codeType === "QR" ? "?type=qr" : "?type=datamatrix";
  const automaticLabelLength = selectedTemplate
    ? calculateInventoryLabelLength(
        blocks,
        item,
        selectedTemplate.columnCount,
        selectedTemplate.tapeWidthMm,
        selectedTemplate.rowCount,
      )
    : 70;
  // A manually shortened length (set in the template editor) always wins
  // over the automatic estimate - the auto-calculation is a generous
  // upper bound meant to avoid clipped content, not a tight fit, so it
  // routinely leaves visible slack that only the person looking at the
  // actual print result can judge how far to trim.
  const effectiveLabelLength =
    selectedTemplate?.labelLengthOverrideMm ?? automaticLabelLength;
  const labelWidth =
    selectedTemplate?.orientation === "PORTRAIT"
      ? selectedTemplate.tapeWidthMm
      : effectiveLabelLength;
  const labelHeight =
    selectedTemplate?.orientation === "PORTRAIT"
      ? effectiveLabelLength
      : selectedTemplate?.tapeWidthMm ?? 24;

  return (
    <AppShell
      title="Inventar-Etikett"
      description={`${item.objectNumber ?? item.inventoryNumber ?? item.stixId ?? "Objekt"} · ${item.name}`}
    >
      <style>{`
        @media print {
          body { background: white !important; }
          header, .no-print { display: none !important; }
          main { background: white !important; min-height: auto !important; }
          main > section { max-width: none !important; padding: 0 !important; }
          main > section > div:first-child { display: none !important; }
          .print-label-shell { border: 0 !important; box-shadow: none !important; padding: 0 !important; }
          .print-label-preview { transform: none !important; margin: 0 !important; }
          @page { size: ${labelWidth}mm ${labelHeight}mm; margin: 0; }
        }
      `}</style>

      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <Link
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            href={`/inventory/${item.id}`}
          >
            ← Objekt
          </Link>
          <Link
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            href="/inventory/labels"
          >
            Vorlagen bearbeiten
          </Link>
        </div>

        <form className="flex flex-wrap items-center gap-2">
          <label className="text-sm font-semibold text-gray-700">
            Vorlage
            <select
              className="ml-2 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
              defaultValue={selectedTemplate?.id ?? ""}
              name="template"
            >
              {templates.length === 0 ? (
                <option value="">Keine Vorlage angelegt</option>
              ) : null}
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-800 hover:bg-gray-50"
            type="submit"
          >
            Anwenden
          </button>
          {selectedTemplate ? (
            <>
              <Link
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-800 hover:bg-gray-50"
                href={`/inventory/${item.id}/label/lbx?template=${selectedTemplate.id}`}
              >
                LBX für P-touch
              </Link>
              <Link
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-800 hover:bg-gray-50"
                href={`/inventory/${item.id}/label/png?template=${selectedTemplate.id}`}
              >
                PNG exportieren
              </Link>
            </>
          ) : null}
          <InventoryLabelPrintButton />
        </form>
      </div>

      {selectedTemplate ? (
        <section className="print-label-shell rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="no-print mb-4">
            <h2 className="text-lg font-bold text-gray-900">
              Druckvorschau · {selectedTemplate.name}
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {selectedTemplate.tapeWidthMm} mm Band ·{" "}
              {selectedTemplate.labelLengthOverrideMm
                ? `${effectiveLabelLength} mm Länge (manuell, automatisch wären ${automaticLabelLength} mm)`
                : `${automaticLabelLength} mm Länge automatisch`}{" "}
              · {selectedTemplate.rowCount} Zeilen ·{" "}
              {selectedTemplate.columnCount} Spalten ·{" "}
              {selectedTemplate.codeType === "QR" ? "QR-Code" : "ECC200"}
            </p>
          </div>

          <div className="overflow-auto rounded-2xl bg-gray-100 p-6 print:bg-white print:p-0">
            <div
              className={`print-label-preview grid bg-white p-[2mm] text-black ${
                selectedTemplate.showBorder ? "border-2 border-black" : ""
              }`}
              style={{
                gap: `${selectedTemplate.gapMm}mm`,
                gridTemplateColumns: `repeat(${selectedTemplate.columnCount}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${selectedTemplate.rowCount}, minmax(0, 1fr))`,
                height: `${labelHeight}mm`,
                width: `${labelWidth}mm`,
              }}
            >
              {blocks.map((block) => (
                <LabelValueBlock
                  block={block}
                  codeQuery={codeQuery}
                  columnCount={selectedTemplate.columnCount}
                  companyLogoUrl={companyInfo?.logoPublicUrl ?? null}
                  item={item}
                  key={block.key}
                  templateCodeType={selectedTemplate.codeType}
                />
              ))}
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-yellow-200 bg-yellow-50 p-6 text-yellow-950">
          <h2 className="text-lg font-bold">Noch keine Etikettenvorlage</h2>
          <p className="mt-2 text-sm">
            Lege zuerst unter Inventar → Etikettenvorlagen eine Vorlage an.
          </p>
          <Link
            className="mt-4 inline-flex rounded-xl bg-yellow-400 px-4 py-2 text-sm font-bold text-gray-950 hover:bg-yellow-300"
            href="/inventory/labels"
          >
            Vorlage anlegen
          </Link>
        </section>
      )}
    </AppShell>
  );
}

function LabelValueBlock({
  block,
  codeQuery,
  columnCount,
  companyLogoUrl,
  item,
  templateCodeType,
}: {
  block: InventoryLabelBlock;
  codeQuery: string;
  columnCount: number;
  companyLogoUrl: string | null;
  item: Parameters<typeof getInventoryLabelValue>[0] & { id: string; name: string };
  templateCodeType: string;
}) {
  const meta = getInventoryLabelBlockMeta(block.key);
  const value = getInventoryLabelValue(item, block.key);
  const width = getEffectiveInventoryLabelBlockWidth(block, columnCount);

  if (!meta) return null;

  if (isInventoryLabelSpacerBlock(block.key)) {
    return null;
  }

  if (block.key === "companyLogo") {
    if (!companyLogoUrl) return null;

    return (
      <div
        className="flex min-h-[6mm] items-center justify-center overflow-hidden bg-white"
        style={{
          gridColumn: `${block.col} / span ${width}`,
          gridRow: `${block.row} / span ${block.height}`,
        }}
      >
        <img
          alt="Firmenlogo"
          className="h-full max-h-full w-full max-w-full object-contain"
          src={companyLogoUrl}
          style={{ filter: "brightness(0)" }}
        />
      </div>
    );
  }

  if (block.key === "code") {
    return (
      <div
        className="flex min-h-[8mm] items-center justify-center overflow-hidden bg-white"
        style={{
          gridColumn: `${block.col} / span ${width}`,
          gridRow: `${block.row} / span ${block.height}`,
        }}
      >
        <img
          alt={`Code für ${item.name}`}
          className="h-full max-h-full w-auto max-w-full object-contain"
          src={`/inventory/${item.id}/qr${codeQuery}`}
        />
        <span className="sr-only">
          {templateCodeType === "QR" ? "QR" : "ECC200"}
        </span>
      </div>
    );
  }

  if (!value || value === "—") return null;

  return (
    <div
      className={`overflow-hidden px-[0.5mm] py-[0.25mm] leading-tight ${getTextAlignClass(
        block.align,
      )} ${getTextStyleClass(block)} ${
        block.underline ? "underline underline-offset-2" : ""
      } ${
        block.widthAuto ? "whitespace-nowrap" : "break-words"
      } ${getLabelTextClass(
        block.size,
      )}`}
      style={{
        gridColumn: `${block.col} / span ${width}`,
        gridRow: `${block.row} / span ${block.height}`,
      }}
    >
      {block.labelVisible ? (
        <span className="mr-[1mm] text-[0.65em] font-bold uppercase text-black">
          {meta.label}:
        </span>
      ) : null}
      {value}
    </div>
  );
}

function getLabelTextClass(size: InventoryLabelBlock["size"]) {
  if (size === "LARGE") return "text-[7pt]";
  if (size === "SMALL") return "text-[5pt]";
  return "text-[6pt]";
}

function getTextAlignClass(align: InventoryLabelBlock["align"]) {
  if (align === "CENTER") return "text-center";
  if (align === "RIGHT") return "text-right";
  return "text-left";
}

function getTextStyleClass(block: InventoryLabelBlock) {
  return [block.bold ? "font-black" : "font-bold", block.italic ? "italic" : ""]
    .filter(Boolean)
    .join(" ");
}
