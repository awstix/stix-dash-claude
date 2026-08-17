"use client";
/* eslint-disable @next/next/no-img-element */

import { useMemo, useRef, useState } from "react";
import {
  DEFAULT_INVENTORY_LABEL_BLOCKS,
  INVENTORY_LABEL_BLOCKS,
  INVENTORY_LABEL_TAPE_WIDTHS,
  calculateInventoryLabelLength,
  clampBlockToCanvas,
  getInventoryLabelBlockMeta,
  getInventoryLabelBlockRenderWidthMm,
  getInventoryLabelLegacyGeometry,
  getInventoryLabelValue,
  isInventoryLabelSpacerBlock,
  isInventoryLabelTextBlock,
  parseInventoryLabelBlocks,
  type InventoryLabelBlock,
  type InventoryLabelItem,
  type InventoryLabelTemplateLike,
} from "@/lib/inventory-labels";

const inputClass =
  "mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10";

const sizeOptions = [
  { label: "Klein", value: "SMALL" },
  { label: "Normal", value: "NORMAL" },
  { label: "Groß", value: "LARGE" },
] as const;

const alignOptions = [
  { label: "Links", value: "LEFT" },
  { label: "Mitte", value: "CENTER" },
  { label: "Rechts", value: "RIGHT" },
] as const;

const CLICK_THRESHOLD_PX = 4;
const ALIGNMENT_TOLERANCE_MM = 1.2;

export function InventoryLabelTemplateEditor({
  action,
  companyLogoUrl,
  previewItems,
  template,
}: {
  action: (formData: FormData) => void | Promise<void>;
  companyLogoUrl: string | null;
  previewItems: Array<InventoryLabelItem & { id: string }>;
  template?: InventoryLabelTemplateLike | null;
}) {
  const [name, setName] = useState(template?.name ?? "TZe 24 mm · Inventar");
  const [tapeWidthMm, setTapeWidthMm] = useState(template?.tapeWidthMm ?? 24);
  const [snapMm, setSnapMm] = useState(template?.snapMm ?? 1);
  const [labelLengthOverrideMm, setLabelLengthOverrideMm] = useState<number | null>(
    template?.labelLengthOverrideMm ?? null,
  );
  const [codeType, setCodeType] = useState(template?.codeType ?? "DATAMATRIX");
  const [orientation, setOrientation] = useState(
    template?.orientation ?? "LANDSCAPE",
  );
  const [showBorder, setShowBorder] = useState(template?.showBorder ?? true);
  const [isDefault, setIsDefault] = useState(template?.isDefault ?? false);
  const [selectedPreviewItemId, setSelectedPreviewItemId] = useState(
    previewItems[0]?.id ?? "",
  );
  const [previewCategoryFilter, setPreviewCategoryFilter] = useState("all");
  const [previewSearch, setPreviewSearch] = useState("");
  const [draggedBlockKey, setDraggedBlockKey] = useState<
    InventoryLabelBlock["key"] | null
  >(null);
  const [activeBlockKey, setActiveBlockKey] = useState<
    InventoryLabelBlock["key"] | null
  >(null);
  const [blocks, setBlocks] = useState<InventoryLabelBlock[]>(() => {
    const initialOrientation = template?.orientation ?? "LANDSCAPE";
    const initialTapeWidthMm = template?.tapeWidthMm ?? 24;
    const initialLengthMm =
      template?.labelLengthOverrideMm ?? template?.labelLengthMm ?? 70;
    const initialWidth =
      initialOrientation === "LANDSCAPE" ? initialLengthMm : initialTapeWidthMm;
    const initialHeight =
      initialOrientation === "LANDSCAPE" ? initialTapeWidthMm : initialLengthMm;
    const startBlocks = template
      ? parseInventoryLabelBlocks(
          template.blocksJson,
          getInventoryLabelLegacyGeometry(template),
        )
      : getNewTemplateStartBlocks();

    return startBlocks.map((block) => clampBlockToCanvas(block, initialWidth, initialHeight));
  });

  const sortedBlocks = useMemo(() => [...blocks].sort(sortByOrder), [blocks]);
  const enabledBlocks = useMemo(
    () => sortedBlocks.filter((block) => block.enabled),
    [sortedBlocks],
  );
  const previewCategories = useMemo(
    () => getPreviewCategories(previewItems),
    [previewItems],
  );
  const filteredPreviewItems = useMemo(
    () =>
      filterPreviewItems(
        previewItems,
        previewSearch,
        previewCategoryFilter,
      ),
    [previewCategoryFilter, previewItems, previewSearch],
  );
  const selectedPreviewItem =
    filteredPreviewItems.find((item) => item.id === selectedPreviewItemId) ??
    filteredPreviewItems[0] ??
    null;
  const activeBlock =
    sortedBlocks.find((block) => block.key === activeBlockKey) ??
    enabledBlocks[0] ??
    sortedBlocks[0] ??
    null;
  const automaticLabelLengthMm = calculateInventoryLabelLength(
    enabledBlocks,
    selectedPreviewItem,
    orientation,
  );
  const labelLengthMm = labelLengthOverrideMm ?? automaticLabelLengthMm;
  const previewWidth = orientation === "LANDSCAPE" ? labelLengthMm : tapeWidthMm;
  const previewHeight =
    orientation === "LANDSCAPE" ? tapeWidthMm : labelLengthMm;
  const previewScale = 3.4;

  function updateBlock(
    key: InventoryLabelBlock["key"],
    patch: Partial<InventoryLabelBlock>,
  ) {
    setBlocks((currentBlocks) =>
      currentBlocks.map((block) =>
        block.key === key
          ? clampBlockToCanvas({ ...block, ...patch }, previewWidth, previewHeight)
          : block,
      ),
    );
  }

  function resizeCanvasTo(nextWidth: number, nextHeight: number) {
    setBlocks((currentBlocks) =>
      currentBlocks.map((block) => clampBlockToCanvas(block, nextWidth, nextHeight)),
    );
  }

  function handleCanvasDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!draggedBlockKey) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const xMm = snapValue((event.clientX - rect.left) / previewScale, snapMm);
    const yMm = snapValue((event.clientY - rect.top) / previewScale, snapMm);

    updateBlock(draggedBlockKey, { enabled: true, xMm, yMm });
    setActiveBlockKey(draggedBlockKey);
    setDraggedBlockKey(null);
  }

  function bringToFront(key: InventoryLabelBlock["key"]) {
    setBlocks((currentBlocks) => {
      const maxOrder = Math.max(...currentBlocks.map((block) => block.order));
      return currentBlocks.map((block) =>
        block.key === key ? { ...block, order: maxOrder + 1 } : block,
      );
    });
  }

  function sendToBack(key: InventoryLabelBlock["key"]) {
    setBlocks((currentBlocks) => {
      const minOrder = Math.min(...currentBlocks.map((block) => block.order));
      return currentBlocks.map((block) =>
        block.key === key ? { ...block, order: minOrder - 1 } : block,
      );
    });
  }

  return (
    <form action={action} className="space-y-5">
      <input name="blocksJson" type="hidden" value={JSON.stringify(blocks)} />
      <input name="labelLengthMm" type="hidden" value={labelLengthMm} />
      <input
        name="labelLengthOverrideMm"
        type="hidden"
        value={labelLengthOverrideMm ?? ""}
      />
      <input name="snapMm" type="hidden" value={snapMm} />
      <input name="previewItemId" type="hidden" value={selectedPreviewItem?.id ?? ""} />

      <section className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
              <label className="md:col-span-4">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Vorlagenname
                </span>
                <input
                  className={inputClass}
                  name="name"
                  onChange={(event) => setName(event.currentTarget.value)}
                  required
                  value={name}
                />
              </label>

              <label className="md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Band
                </span>
                <select
                  className={inputClass}
                  name="tapeWidthMm"
                  onChange={(event) => {
                    const nextTapeWidthMm = Number.parseInt(
                      event.currentTarget.value,
                      10,
                    );
                    setTapeWidthMm(nextTapeWidthMm);
                    const nextWidth =
                      orientation === "LANDSCAPE" ? labelLengthMm : nextTapeWidthMm;
                    const nextHeight =
                      orientation === "LANDSCAPE" ? nextTapeWidthMm : labelLengthMm;
                    resizeCanvasTo(nextWidth, nextHeight);
                  }}
                  value={tapeWidthMm}
                >
                  {INVENTORY_LABEL_TAPE_WIDTHS.map((width) => (
                    <option key={width} value={width}>
                      {width} mm
                    </option>
                  ))}
                </select>
              </label>

              <label className="md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Code
                </span>
                <select
                  className={inputClass}
                  name="codeType"
                  onChange={(event) => setCodeType(event.currentTarget.value)}
                  value={codeType}
                >
                  <option value="DATAMATRIX">ECC200</option>
                  <option value="QR">QR-Code</option>
                </select>
              </label>

              <label className="md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Richtung
                </span>
                <select
                  className={inputClass}
                  name="orientation"
                  onChange={(event) => {
                    const nextOrientation = event.currentTarget.value;
                    setOrientation(nextOrientation);
                    const nextWidth =
                      nextOrientation === "LANDSCAPE" ? labelLengthMm : tapeWidthMm;
                    const nextHeight =
                      nextOrientation === "LANDSCAPE" ? tapeWidthMm : labelLengthMm;
                    resizeCanvasTo(nextWidth, nextHeight);
                  }}
                  value={orientation}
                >
                  <option value="LANDSCAPE">Quer</option>
                  <option value="PORTRAIT">Hoch</option>
                </select>
              </label>

              <label className="md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Raster (mm)
                </span>
                <input
                  className={inputClass}
                  max={5}
                  min={0}
                  onChange={(event) =>
                    setSnapMm(Number.parseFloat(event.currentTarget.value) || 0)
                  }
                  step={0.1}
                  type="number"
                  value={snapMm}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Beim Ziehen wird darauf eingerastet. 0 = frei.
                </p>
              </label>

              <label className="md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Länge
                </span>
                <input
                  className={inputClass}
                  max={220}
                  min={18}
                  onChange={(event) => {
                    const raw = event.currentTarget.value;
                    const nextOverride = raw === "" ? null : Number.parseFloat(raw);
                    setLabelLengthOverrideMm(nextOverride);
                    const nextLengthMm = nextOverride ?? automaticLabelLengthMm;
                    const nextWidth =
                      orientation === "LANDSCAPE" ? nextLengthMm : tapeWidthMm;
                    const nextHeight =
                      orientation === "LANDSCAPE" ? tapeWidthMm : nextLengthMm;
                    resizeCanvasTo(nextWidth, nextHeight);
                  }}
                  placeholder={`${automaticLabelLengthMm} mm auto`}
                  type="number"
                  value={labelLengthOverrideMm ?? ""}
                />
                {labelLengthOverrideMm !== null ? (
                  <button
                    className="mt-1 text-[11px] font-semibold text-blue-700 hover:underline"
                    onClick={() => setLabelLengthOverrideMm(null)}
                    type="button"
                  >
                    Zurück auf automatisch ({automaticLabelLengthMm} mm)
                  </button>
                ) : (
                  <span className="mt-1 block text-[11px] text-gray-400">
                    Automatisch: {automaticLabelLengthMm} mm
                  </span>
                )}
              </label>
            </div>

            <section className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-end gap-3">
                <label className="min-w-60 flex-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Objekt suchen
                  </span>
                  <input
                    className={inputClass}
                    onChange={(event) => setPreviewSearch(event.currentTarget.value)}
                    placeholder="Objektnummer, Name, Kennzeichen, Hersteller …"
                    value={previewSearch}
                  />
                </label>

                <label className="min-w-60 flex-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Kategorie / Unterkategorie
                  </span>
                  <select
                    className={inputClass}
                    onChange={(event) =>
                      setPreviewCategoryFilter(event.currentTarget.value)
                    }
                    value={previewCategoryFilter}
                  >
                    <option value="all">Alle Kategorien</option>
                    <option value="none">Ohne Kategorie</option>
                    {previewCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="min-w-72 flex-[1.4]">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Objekt-Vorschau
                  </span>
                  <select
                    className={inputClass}
                    onChange={(event) =>
                      setSelectedPreviewItemId(event.currentTarget.value)
                    }
                    value={selectedPreviewItem?.id ?? ""}
                  >
                    {filteredPreviewItems.length === 0 ? (
                      <option value="">Kein Objekt gefunden</option>
                    ) : null}
                    {filteredPreviewItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {getPreviewItemOptionLabel(item)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mt-2 text-xs font-semibold text-gray-500">
                {filteredPreviewItems.length.toLocaleString("de-DE")} von{" "}
                {previewItems.length.toLocaleString("de-DE")} Objekten sichtbar
              </div>
            </section>

            <LabelCanvas
              activeBlockKey={activeBlockKey}
              blocks={enabledBlocks}
              codeType={codeType}
              companyLogoUrl={companyLogoUrl}
              draggedBlockKey={draggedBlockKey}
              item={selectedPreviewItem}
              onCanvasDrop={handleCanvasDrop}
              onSelectBlock={setActiveBlockKey}
              previewHeight={previewHeight}
              previewScale={previewScale}
              previewWidth={previewWidth}
              showBorder={showBorder}
              snapMm={snapMm}
              updateBlock={updateBlock}
            />

            <section className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-gray-900">
                    Bausteine
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Direkt ins Etikett ziehen. Klick auf einen aktiven Baustein
                    wählt ihn aus (nützlich, wenn er auf dem Etikett von einem
                    anderen verdeckt wird).
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {INVENTORY_LABEL_BLOCKS.map((meta) => {
                  const block = sortedBlocks.find((item) => item.key === meta.key);
                  const enabled = Boolean(block?.enabled);

                  return (
                    <div
                      className={`flex cursor-grab items-center gap-2 rounded-xl border px-3 py-2 text-sm active:cursor-grabbing ${
                        enabled
                          ? "border-gray-900 bg-gray-950 text-white"
                          : "border-gray-200 bg-gray-50 text-gray-800 hover:bg-white"
                      }`}
                      draggable
                      key={meta.key}
                      onClick={() => {
                        if (enabled) setActiveBlockKey(meta.key);
                      }}
                      onDragEnd={() => setDraggedBlockKey(null)}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "move";
                        setDraggedBlockKey(meta.key);
                      }}
                    >
                      <span className="whitespace-nowrap font-bold">
                        ⠿ {meta.label}
                      </span>
                      {enabled ? (
                        <button
                          className="rounded-lg bg-white/10 px-2 py-1 text-xs font-bold hover:bg-white/20"
                          onClick={(event) => {
                            event.stopPropagation();
                            updateBlock(meta.key, { enabled: false });
                          }}
                          type="button"
                        >
                          raus
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="text-sm font-bold text-gray-900">
                Element-Einstellungen
              </div>
              {activeBlock ? (
                <div className="mt-3 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="rounded-xl bg-gray-50 px-3 py-2 text-sm font-bold text-gray-900">
                      {getInventoryLabelBlockMeta(activeBlock.key)?.label}
                    </div>
                    <div className="flex gap-1">
                      <button
                        className="rounded-lg border border-gray-200 px-2 py-1 text-[11px] font-bold text-gray-700 hover:bg-gray-50"
                        onClick={() => sendToBack(activeBlock.key)}
                        title="Nach hinten legen"
                        type="button"
                      >
                        Nach hinten
                      </button>
                      <button
                        className="rounded-lg border border-gray-200 px-2 py-1 text-[11px] font-bold text-gray-700 hover:bg-gray-50"
                        onClick={() => bringToFront(activeBlock.key)}
                        title="Nach vorne bringen"
                        type="button"
                      >
                        Nach vorne
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <NumberField
                      label="X (mm)"
                      min={0}
                      onChange={(value) => updateBlock(activeBlock.key, { xMm: value })}
                      value={activeBlock.xMm}
                    />
                    <NumberField
                      label="Y (mm)"
                      min={0}
                      onChange={(value) => updateBlock(activeBlock.key, { yMm: value })}
                      value={activeBlock.yMm}
                    />
                    <NumberField
                      label="Breite (mm)"
                      min={2}
                      onChange={(value) =>
                        updateBlock(activeBlock.key, { widthAuto: false, widthMm: value })
                      }
                      value={activeBlock.widthMm}
                    />
                    <NumberField
                      label="Höhe (mm)"
                      min={2}
                      onChange={(value) => updateBlock(activeBlock.key, { heightMm: value })}
                      value={activeBlock.heightMm}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <input
                      checked={activeBlock.widthAuto}
                      disabled={!isInventoryLabelTextBlock(activeBlock.key)}
                      onChange={(event) =>
                        updateBlock(activeBlock.key, {
                          widthAuto: event.currentTarget.checked,
                        })
                      }
                      type="checkbox"
                    />
                    Breite füllt Rest nach rechts
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Schrift
                    </span>
                    <select
                      className={inputClass}
                      disabled={
                        !isInventoryLabelTextBlock(activeBlock.key)
                      }
                      onChange={(event) =>
                        updateBlock(activeBlock.key, {
                          size: event.currentTarget
                            .value as InventoryLabelBlock["size"],
                        })
                      }
                      value={activeBlock.size}
                    >
                      {sizeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="grid grid-cols-1 gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <input
                        checked={activeBlock.bold}
                        disabled={!isInventoryLabelTextBlock(activeBlock.key)}
                        onChange={(event) =>
                          updateBlock(activeBlock.key, {
                            bold: event.currentTarget.checked,
                          })
                        }
                        type="checkbox"
                      />
                      Fett
                    </label>
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <input
                        checked={activeBlock.italic}
                        disabled={!isInventoryLabelTextBlock(activeBlock.key)}
                        onChange={(event) =>
                          updateBlock(activeBlock.key, {
                            italic: event.currentTarget.checked,
                          })
                        }
                        type="checkbox"
                      />
                      Kursiv
                    </label>
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <input
                        checked={activeBlock.underline}
                        disabled={!isInventoryLabelTextBlock(activeBlock.key)}
                        onChange={(event) =>
                          updateBlock(activeBlock.key, {
                            underline: event.currentTarget.checked,
                          })
                        }
                        type="checkbox"
                      />
                      Unterstrichen
                    </label>
                  </div>
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Ausrichtung
                    </span>
                    <select
                      className={inputClass}
                      disabled={!isInventoryLabelTextBlock(activeBlock.key)}
                      onChange={(event) =>
                        updateBlock(activeBlock.key, {
                          align: event.currentTarget
                            .value as InventoryLabelBlock["align"],
                        })
                      }
                      value={activeBlock.align}
                    >
                      {alignOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Drehung
                    </span>
                    <select
                      className={inputClass}
                      onChange={(event) =>
                        updateBlock(activeBlock.key, {
                          rotation: Number.parseInt(
                            event.currentTarget.value,
                            10,
                          ) as InventoryLabelBlock["rotation"],
                        })
                      }
                      value={activeBlock.rotation}
                    >
                      <option value={0}>0°</option>
                      <option value={90}>90°</option>
                      <option value={180}>180°</option>
                      <option value={270}>270°</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <input
                      checked={activeBlock.labelVisible}
                      disabled={!isInventoryLabelTextBlock(activeBlock.key)}
                      onChange={(event) =>
                        updateBlock(activeBlock.key, {
                          labelVisible: event.currentTarget.checked,
                        })
                      }
                      type="checkbox"
                    />
                    Feldtitel anzeigen
                  </label>
                </div>
              ) : (
                <p className="mt-3 text-sm text-gray-500">
                  Element auswählen oder ins Etikett ziehen.
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-xs font-bold text-gray-700">
                  <input
                    checked={showBorder}
                    name="showBorder"
                    onChange={(event) => setShowBorder(event.currentTarget.checked)}
                    type="checkbox"
                  />
                  Rahmen
                </label>
                <label className="inline-flex h-10 items-center gap-2 rounded-xl border border-yellow-200 bg-yellow-50 px-3 text-xs font-bold text-yellow-900">
                  <input
                    checked={isDefault}
                    name="isDefault"
                    onChange={(event) => setIsDefault(event.currentTarget.checked)}
                    type="checkbox"
                  />
                  Standard
                </label>
              </div>
              <button
                className="mt-4 w-full rounded-xl bg-yellow-400 px-5 py-3 text-sm font-bold text-gray-950 shadow-sm hover:bg-yellow-300"
                type="submit"
              >
                Vorlage speichern
              </button>
              <div className="mt-4 border-t border-gray-200 pt-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Etikett exportieren
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {selectedPreviewItem ? (
                    <>
                      <button
                        className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-300 bg-white px-3 text-xs font-bold text-gray-800 hover:bg-gray-50"
                        formAction="/inventory/labels/export/png"
                        formMethod="post"
                        type="submit"
                      >
                        PNG
                      </button>
                      <button
                        className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-300 bg-white px-3 text-xs font-bold text-gray-800 hover:bg-gray-50"
                        formAction="/inventory/labels/export/lbx"
                        formMethod="post"
                        type="submit"
                      >
                        LBX
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="inline-flex h-10 cursor-not-allowed items-center justify-center rounded-xl border border-gray-200 bg-gray-50 px-3 text-xs font-bold text-gray-400"
                        disabled
                        type="button"
                      >
                        PNG
                      </button>
                      <button
                        className="inline-flex h-10 cursor-not-allowed items-center justify-center rounded-xl border border-gray-200 bg-gray-50 px-3 text-xs font-bold text-gray-400"
                        disabled
                        type="button"
                      >
                        LBX
                      </button>
                    </>
                  )}
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  {selectedPreviewItem
                    ? "Exportiert den aktuellen Live-Stand mit dem ausgewählten Vorschau-Objekt."
                    : "Bitte zuerst ein Objekt für die Vorschau auswählen."}
                </p>
              </div>
            </section>
          </aside>
        </div>
      </section>
    </form>
  );
}

function LabelCanvas({
  activeBlockKey,
  blocks,
  codeType,
  companyLogoUrl,
  draggedBlockKey,
  item,
  onCanvasDrop,
  onSelectBlock,
  previewHeight,
  previewScale,
  previewWidth,
  showBorder,
  snapMm,
  updateBlock,
}: {
  activeBlockKey: InventoryLabelBlock["key"] | null;
  blocks: InventoryLabelBlock[];
  codeType: string;
  companyLogoUrl: string | null;
  draggedBlockKey: InventoryLabelBlock["key"] | null;
  item: (InventoryLabelItem & { id: string }) | null;
  onCanvasDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  onSelectBlock: (key: InventoryLabelBlock["key"]) => void;
  previewHeight: number;
  previewScale: number;
  previewWidth: number;
  showBorder: boolean;
  snapMm: number;
  updateBlock: (
    key: InventoryLabelBlock["key"],
    patch: Partial<InventoryLabelBlock>,
  ) => void;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-gray-900">Etikettfläche</div>
          <p className="mt-1 text-xs text-gray-500">
            Bausteine frei per Drag platzieren und an den Kanten in der Größe
            anpassen. Sie rasten am Raster und an Kanten anderer Bausteine
            ein.
          </p>
        </div>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-700">
          {Math.round(previewWidth)}×{Math.round(previewHeight)} mm
        </span>
      </div>
      <div className="overflow-auto rounded-xl border border-gray-200 bg-gray-100 p-3">
        <div
          className={`relative touch-none bg-white p-2 text-gray-950 ${
            showBorder ? "border-2 border-gray-900" : ""
          } ${draggedBlockKey ? "outline-2 outline-dashed outline-blue-300" : ""}`}
          onDragOver={(event) => event.preventDefault()}
          onDrop={onCanvasDrop}
          style={{
            height: `${previewHeight * previewScale}px`,
            width: `${previewWidth * previewScale}px`,
          }}
        >
          {blocks.map((block) => (
            <PlacedBlock
              allBlocks={blocks}
              block={block}
              codeType={codeType}
              companyLogoUrl={companyLogoUrl}
              isActive={block.key === activeBlockKey}
              item={item}
              key={block.key}
              labelHeightMm={previewHeight}
              labelWidthMm={previewWidth}
              onSelectBlock={onSelectBlock}
              previewScale={previewScale}
              snapMm={snapMm}
              updateBlock={updateBlock}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function PlacedBlock({
  allBlocks,
  block,
  codeType,
  companyLogoUrl,
  isActive,
  item,
  labelHeightMm,
  labelWidthMm,
  onSelectBlock,
  previewScale,
  snapMm,
  updateBlock,
}: {
  allBlocks: InventoryLabelBlock[];
  block: InventoryLabelBlock;
  codeType: string;
  companyLogoUrl: string | null;
  isActive: boolean;
  item: (InventoryLabelItem & { id: string }) | null;
  labelHeightMm: number;
  labelWidthMm: number;
  onSelectBlock: (key: InventoryLabelBlock["key"]) => void;
  previewScale: number;
  snapMm: number;
  updateBlock: (
    key: InventoryLabelBlock["key"],
    patch: Partial<InventoryLabelBlock>,
  ) => void;
}) {
  const meta = getInventoryLabelBlockMeta(block.key);
  const value = item ? getInventoryLabelValue(item, block.key) : "";
  const moveDragRef = useRef<{
    moved: boolean;
    startClientX: number;
    startClientY: number;
    startXMm: number;
    startYMm: number;
  } | null>(null);

  if (!meta) return null;

  const isSpacer = isInventoryLabelSpacerBlock(block.key);
  const isLogo = block.key === "companyLogo";
  const isCode = block.key === "code";
  const renderWidthMm = getInventoryLabelBlockRenderWidthMm(block, labelWidthMm);

  function handleBodyPointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    moveDragRef.current = {
      moved: false,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startXMm: block.xMm,
      startYMm: block.yMm,
    };
  }

  function handleBodyPointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    if (!moveDragRef.current) return;

    const deltaXPx = event.clientX - moveDragRef.current.startClientX;
    const deltaYPx = event.clientY - moveDragRef.current.startClientY;

    if (
      !moveDragRef.current.moved &&
      Math.hypot(deltaXPx, deltaYPx) < CLICK_THRESHOLD_PX
    ) {
      return;
    }

    moveDragRef.current.moved = true;
    const candidateXMm = moveDragRef.current.startXMm + deltaXPx / previewScale;
    const candidateYMm = moveDragRef.current.startYMm + deltaYPx / previewScale;
    const others = allBlocks.filter((other) => other.key !== block.key);
    const snapped = snapBlockPosition(
      {
        heightMm: block.heightMm,
        widthMm: block.widthMm,
        xMm: candidateXMm,
        yMm: candidateYMm,
      },
      others,
      snapMm,
    );

    updateBlock(block.key, { xMm: snapped.xMm, yMm: snapped.yMm });
  }

  function handleBodyPointerUp(event: React.PointerEvent<HTMLButtonElement>) {
    const wasMoved = moveDragRef.current?.moved ?? false;
    moveDragRef.current = null;
    if (!wasMoved) onSelectBlock(block.key);
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  const buttonClassName = isSpacer
    ? "touch-none z-10 flex h-full w-full cursor-grab items-center justify-center overflow-hidden rounded border border-dashed border-amber-400 bg-amber-50/80 px-2 py-1 text-[10px] font-black uppercase text-amber-700 active:cursor-grabbing"
    : isLogo || isCode
      ? "touch-none z-10 flex h-full w-full cursor-grab items-center justify-center overflow-hidden bg-white active:cursor-grabbing"
      : `touch-none z-10 h-full w-full cursor-grab overflow-hidden bg-white px-1 py-0.5 leading-tight active:cursor-grabbing ${getTextAlignClass(
          block.align,
        )} ${getTextStyleClass(block)} ${
          block.underline ? "underline underline-offset-2" : ""
        } ${block.widthAuto ? "whitespace-nowrap" : "break-words"} ${getPreviewTextClass(
          block.size,
        )}`;

  const content = isSpacer ? (
    <>
      Abstand
      <br />
      {Math.round(block.widthMm)}×{Math.round(block.heightMm)} mm
    </>
  ) : isLogo ? (
    companyLogoUrl ? (
      <img
        alt="Firmenlogo"
        className="h-full max-h-full w-full max-w-full object-contain"
        src={companyLogoUrl}
      />
    ) : (
      <span className="text-center text-[10px] font-black text-gray-400">
        Firmenlogo
      </span>
    )
  ) : isCode ? (
    item ? (
      <img
        alt="Code-Vorschau"
        className="h-full max-h-full w-auto max-w-full object-contain"
        src={`/inventory/${item.id}/qr${
          codeType === "QR" ? "?type=qr" : "?type=datamatrix"
        }`}
      />
    ) : (
      <span className="text-xs font-black text-gray-400">
        {codeType === "QR" ? "QR" : "ECC200"}
      </span>
    )
  ) : (
    <>
      {block.labelVisible && value ? (
        <span className="mr-1 text-[0.65em] font-semibold uppercase text-gray-950">
          {meta.label}:
        </span>
      ) : null}
      {value}
    </>
  );

  return (
    <div
      className="absolute"
      style={{
        height: `${block.heightMm * previewScale}px`,
        left: `${block.xMm * previewScale}px`,
        top: `${block.yMm * previewScale}px`,
        width: `${renderWidthMm * previewScale}px`,
      }}
    >
      <button
        className={buttonClassName}
        onPointerDown={handleBodyPointerDown}
        onPointerMove={handleBodyPointerMove}
        onPointerUp={handleBodyPointerUp}
        style={block.rotation ? { transform: `rotate(${block.rotation}deg)` } : undefined}
        type="button"
      >
        {content}
      </button>
      {isActive ? (
        <>
          <ResizeHandle
            axis="width"
            maxMm={labelWidthMm - block.xMm}
            minMm={2}
            onResize={(nextWidthMm) => updateBlock(block.key, { widthMm: nextWidthMm })}
            previewScale={previewScale}
            snapMm={snapMm}
            startValueMm={block.widthMm}
          />
          <ResizeHandle
            axis="height"
            maxMm={labelHeightMm - block.yMm}
            minMm={2}
            onResize={(nextHeightMm) => updateBlock(block.key, { heightMm: nextHeightMm })}
            previewScale={previewScale}
            snapMm={snapMm}
            startValueMm={block.heightMm}
          />
        </>
      ) : null}
    </div>
  );
}

/** Drag handle on the active block's right (width) or bottom (height)
 * edge in the live canvas. Uses pointer capture so the drag keeps
 * tracking even once the cursor leaves the handle's own (thin) hit
 * area. Computes the new size from the ORIGINAL value at pointer-down
 * plus the total movement so far, not incrementally, so re-renders
 * mid-drag can't cause runaway or lagging values. */
function ResizeHandle({
  axis,
  maxMm,
  minMm,
  onResize,
  previewScale,
  snapMm,
  startValueMm,
}: {
  axis: "height" | "width";
  maxMm: number;
  minMm: number;
  onResize: (valueMm: number) => void;
  previewScale: number;
  snapMm: number;
  startValueMm: number;
}) {
  const dragRef = useRef<{ startClient: number; startValueMm: number } | null>(null);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      startClient: axis === "width" ? event.clientX : event.clientY,
      startValueMm,
    };
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    event.stopPropagation();
    const current = axis === "width" ? event.clientX : event.clientY;
    const deltaMm = (current - dragRef.current.startClient) / previewScale;
    let nextMm = dragRef.current.startValueMm + deltaMm;
    if (snapMm > 0) nextMm = Math.round(nextMm / snapMm) * snapMm;
    nextMm = Math.min(Math.max(minMm, maxMm), Math.max(minMm, nextMm));
    onResize(Math.round(nextMm * 10) / 10);
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    event.stopPropagation();
    dragRef.current = null;
  }

  return (
    <div
      className={
        axis === "width"
          ? "absolute right-0 top-0 z-20 h-full w-2.5 cursor-col-resize touch-none rounded-r bg-blue-500/0 hover:bg-blue-500/50"
          : "absolute bottom-0 left-0 z-20 h-2.5 w-full cursor-row-resize touch-none rounded-b bg-blue-500/0 hover:bg-blue-500/50"
      }
      draggable={false}
      onDragStart={(event) => event.preventDefault()}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      title={axis === "width" ? "Breite ziehen" : "Höhe ziehen"}
    />
  );
}

function NumberField({
  label,
  min,
  onChange,
  value,
}: {
  label: string;
  min: number;
  onChange: (value: number) => void;
  value: number;
}) {
  return (
    <label>
      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </span>
      <input
        className={inputClass}
        min={min}
        onChange={(event) => {
          const parsed = Number.parseFloat(event.currentTarget.value);
          if (Number.isFinite(parsed)) onChange(Math.max(min, parsed));
        }}
        step={0.5}
        type="number"
        value={Math.round(value * 10) / 10}
      />
    </label>
  );
}

/** Snaps a dragged block's candidate position to the edges/centers of
 * other blocks on the canvas (small mm tolerance) so things line up
 * without needing a grid; falls back to the plain `snapMm` step when no
 * alignment match is found on that axis. */
function snapBlockPosition(
  candidate: { heightMm: number; widthMm: number; xMm: number; yMm: number },
  otherBlocks: InventoryLabelBlock[],
  snapMm: number,
): { xMm: number; yMm: number } {
  const candidateXEdges = [
    candidate.xMm,
    candidate.xMm + candidate.widthMm / 2,
    candidate.xMm + candidate.widthMm,
  ];
  const candidateYEdges = [
    candidate.yMm,
    candidate.yMm + candidate.heightMm / 2,
    candidate.yMm + candidate.heightMm,
  ];
  const xEdgesList = otherBlocks.map((other) => [
    other.xMm,
    other.xMm + other.widthMm / 2,
    other.xMm + other.widthMm,
  ]);
  const yEdgesList = otherBlocks.map((other) => [
    other.yMm,
    other.yMm + other.heightMm / 2,
    other.yMm + other.heightMm,
  ]);
  const xMatch = findSnapMatch(candidateXEdges, xEdgesList);
  const yMatch = findSnapMatch(candidateYEdges, yEdgesList);
  let xMm = xMatch !== null ? candidate.xMm + xMatch : candidate.xMm;
  let yMm = yMatch !== null ? candidate.yMm + yMatch : candidate.yMm;

  if (xMatch === null && snapMm > 0) xMm = Math.round(xMm / snapMm) * snapMm;
  if (yMatch === null && snapMm > 0) yMm = Math.round(yMm / snapMm) * snapMm;

  return {
    xMm: Math.max(0, Math.round(xMm * 10) / 10),
    yMm: Math.max(0, Math.round(yMm * 10) / 10),
  };
}

function findSnapMatch(candidateEdges: number[], otherEdgesList: number[][]) {
  for (const otherEdges of otherEdgesList) {
    for (const candidateEdge of candidateEdges) {
      for (const otherEdge of otherEdges) {
        if (Math.abs(candidateEdge - otherEdge) <= ALIGNMENT_TOLERANCE_MM) {
          return otherEdge - candidateEdge;
        }
      }
    }
  }

  return null;
}

function snapValue(value: number, step: number) {
  if (step <= 0) return Math.max(0, Math.round(value * 10) / 10);
  return Math.max(0, Math.round(value / step) * step);
}

function getNewTemplateStartBlocks(): InventoryLabelBlock[] {
  return DEFAULT_INVENTORY_LABEL_BLOCKS.map((block) => {
    if (block.key === "objectNumber") {
      return { ...block, enabled: true, heightMm: 8, widthMm: 30, xMm: 2, yMm: 2 };
    }

    if (block.key === "code") {
      return { ...block, enabled: true, heightMm: 16, widthMm: 16, xMm: 2, yMm: 12 };
    }

    if (block.key === "name") {
      return {
        ...block,
        enabled: true,
        heightMm: 6,
        widthAuto: true,
        widthMm: 30,
        xMm: 22,
        yMm: 12,
      };
    }

    return { ...block, enabled: false };
  });
}

function sortByOrder(left: InventoryLabelBlock, right: InventoryLabelBlock) {
  return left.order - right.order;
}

function getPreviewTextClass(size: InventoryLabelBlock["size"]) {
  if (size === "LARGE") return "text-[10px] sm:text-sm";
  if (size === "SMALL") return "text-[7px] sm:text-[10px]";
  return "text-[8px] sm:text-xs";
}

function getTextAlignClass(align: InventoryLabelBlock["align"]) {
  if (align === "CENTER") return "text-center";
  if (align === "RIGHT") return "text-right";
  return "text-left";
}

function getTextStyleClass(block: InventoryLabelBlock) {
  return [block.bold ? "font-black" : "font-medium", block.italic ? "italic" : ""]
    .filter(Boolean)
    .join(" ");
}

function filterPreviewItems(
  items: Array<InventoryLabelItem & { id: string }>,
  search: string,
  categoryFilter: string,
) {
  const query = normalizeSearchText(search);

  return items.filter((item) => {
    const categoryMatches =
      categoryFilter === "all" ||
      (categoryFilter === "none" && !item.category?.id) ||
      item.category?.id === categoryFilter ||
      item.category?.parentCategory?.id === categoryFilter;

    if (!categoryMatches) return false;
    if (!query) return true;

    return normalizeSearchText(
      [
        item.objectNumber,
        item.inventoryNumber,
        item.stixId,
        item.name,
        item.manufacturer,
        item.model,
        item.attachmentType,
        item.serialNumber,
        item.licensePlate,
        item.category?.name,
        item.category?.parentCategory?.name,
        item.currentProject?.projectNumber,
        item.currentProject?.name,
        item.responsibleCrew?.name,
        item.responsibleEmployee
          ? `${item.responsibleEmployee.firstName} ${item.responsibleEmployee.lastName}`
          : null,
      ]
        .filter(Boolean)
        .join(" "),
    ).includes(query);
  });
}

function getPreviewCategories(items: Array<InventoryLabelItem & { id: string }>) {
  const categories = new Map<string, string>();

  for (const item of items) {
    const parent = item.category?.parentCategory;
    const category = item.category;

    if (parent?.id) {
      categories.set(parent.id, parent.name);
    }

    if (category?.id) {
      categories.set(
        category.id,
        parent?.name ? `${parent.name} › ${category.name}` : category.name,
      );
    }
  }

  return [...categories.entries()]
    .map(([id, label]) => ({ id, label }))
    .sort((left, right) => left.label.localeCompare(right.label, "de"));
}

function getPreviewItemOptionLabel(item: InventoryLabelItem & { id: string }) {
  const primary = [item.objectNumber, item.inventoryNumber, item.stixId, item.name]
    .filter(Boolean)
    .join(" · ");
  const details = [
    item.category?.parentCategory?.name
      ? `${item.category.parentCategory.name} › ${item.category?.name ?? ""}`
      : item.category?.name,
    item.licensePlate,
    [item.manufacturer, item.model].filter(Boolean).join(" "),
    item.attachmentType,
  ].filter(Boolean);

  return details.length > 0 ? `${primary} — ${details.join(" · ")}` : primary;
}

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}
