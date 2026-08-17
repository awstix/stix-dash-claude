"use client";
/* eslint-disable @next/next/no-img-element */

import { useMemo, useState } from "react";
import {
  DEFAULT_INVENTORY_LABEL_BLOCKS,
  INVENTORY_LABEL_BLOCKS,
  INVENTORY_LABEL_MAX_COLUMNS,
  INVENTORY_LABEL_MAX_ROWS,
  INVENTORY_LABEL_TAPE_WIDTHS,
  calculateInventoryLabelLength,
  getEffectiveInventoryLabelBlockWidth,
  getInventoryLabelBlockMeta,
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
  const initialRowCount = template?.rowCount ?? 4;
  const initialColumnCount = template?.columnCount ?? 1;
  const [name, setName] = useState(template?.name ?? "TZe 24 mm · Inventar");
  const [tapeWidthMm, setTapeWidthMm] = useState(template?.tapeWidthMm ?? 24);
  const [rowCount, setRowCount] = useState(initialRowCount);
  const [columnCount, setColumnCount] = useState(initialColumnCount);
  const [gapMm, setGapMm] = useState(template?.gapMm ?? 1);
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
  const [blocks, setBlocks] = useState<InventoryLabelBlock[]>(() =>
    (template
      ? parseInventoryLabelBlocks(template.blocksJson)
      : getNewTemplateStartBlocks()
    ).map((block) => clampBlock(block, initialColumnCount, initialRowCount)),
  );

  const sortedBlocks = useMemo(() => [...blocks].sort(sortByOrder), [blocks]);
  const enabledBlocks = useMemo(
    () => sortedBlocks.filter((block) => block.enabled),
    [sortedBlocks],
  );
  const minimumColumnCount = useMemo(
    () =>
      Math.max(
        1,
        enabledBlocks.reduce(
          (max, block) => Math.max(max, block.col + block.width - 1),
          1,
        ),
      ),
    [enabledBlocks],
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
    columnCount,
    tapeWidthMm,
    rowCount,
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
          ? clampBlock(
              {
                ...block,
                ...patch,
              },
              columnCount,
              rowCount,
            )
          : block,
      ),
    );
  }

  function placeDraggedBlock(row: number, col: number) {
    if (!draggedBlockKey) return;

    updateBlock(draggedBlockKey, {
      col,
      enabled: true,
      row,
    });
    setActiveBlockKey(draggedBlockKey);
    setDraggedBlockKey(null);
  }

  function addColumn() {
    setColumnCount((current) =>
      Math.min(INVENTORY_LABEL_MAX_COLUMNS, current + 1),
    );
  }

  function removeColumn() {
    setColumnCount((current) => {
      const nextColumnCount = Math.max(minimumColumnCount, current - 1);

      if (nextColumnCount !== current) {
        setBlocks((currentBlocks) =>
          currentBlocks.map((block) =>
            clampBlock(block, nextColumnCount, rowCount),
          ),
        );
      }

      return nextColumnCount;
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
      <input name="rowCount" type="hidden" value={rowCount} />
      <input name="columnCount" type="hidden" value={columnCount} />
      <input name="gapMm" type="hidden" value={gapMm} />
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
                  onChange={(event) =>
                    setTapeWidthMm(Number.parseInt(event.currentTarget.value, 10))
                  }
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
                  Zeilen Etikett
                </span>
                <select
                  className={inputClass}
                  onChange={(event) => {
                    const nextRowCount = Number.parseInt(
                      event.currentTarget.value,
                      10,
                    );
                    setRowCount(nextRowCount);
                    setBlocks((currentBlocks) =>
                      currentBlocks.map((block) =>
                        clampBlock(block, columnCount, nextRowCount),
                      ),
                    );
                  }}
                  value={rowCount}
                >
                  {Array.from({ length: INVENTORY_LABEL_MAX_ROWS }).map(
                    (_, index) => {
                      const option = index + 1;
                      return (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      );
                    },
                  )}
                </select>
              </label>

              <label className="md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Richtung
                </span>
                <select
                  className={inputClass}
                  name="orientation"
                  onChange={(event) => setOrientation(event.currentTarget.value)}
                  value={orientation}
                >
                  <option value="LANDSCAPE">Quer</option>
                  <option value="PORTRAIT">Hoch</option>
                </select>
              </label>

              <label className="md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Abstand
                </span>
                <input
                  className={inputClass}
                  max={5}
                  min={0}
                  onChange={(event) =>
                    setGapMm(Number.parseFloat(event.currentTarget.value) || 0)
                  }
                  step={0.1}
                  type="number"
                  value={gapMm}
                />
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
                    setLabelLengthOverrideMm(raw === "" ? null : Number.parseFloat(raw));
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
              blocks={enabledBlocks}
              codeType={codeType}
              companyLogoUrl={companyLogoUrl}
              draggedBlockKey={draggedBlockKey}
              gapMm={gapMm}
              item={selectedPreviewItem}
              columnCount={columnCount}
              minimumColumnCount={minimumColumnCount}
              onAddColumn={addColumn}
              onDropBlock={placeDraggedBlock}
              onRemoveColumn={removeColumn}
              onSelectBlock={setActiveBlockKey}
              rowCount={rowCount}
              previewHeight={previewHeight}
              previewScale={previewScale}
              previewWidth={previewWidth}
              setDraggedBlockKey={setDraggedBlockKey}
              showBorder={showBorder}
            />

            <section className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-gray-900">
                    Bausteine
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Direkt ins Etikett ziehen.
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
                          onClick={() =>
                            updateBlock(meta.key, {
                              enabled: false,
                            })
                          }
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
                  <div className="rounded-xl bg-gray-50 px-3 py-2 text-sm font-bold text-gray-900">
                    {getInventoryLabelBlockMeta(activeBlock.key)?.label}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <SelectNumber
                      label="Spalte"
                      max={columnCount}
                      min={1}
                      onChange={(value) => updateBlock(activeBlock.key, { col: value })}
                      value={activeBlock.col}
                    />
                    <SelectNumber
                      label="Zeile"
                      max={rowCount}
                      min={1}
                      onChange={(value) => updateBlock(activeBlock.key, { row: value })}
                      value={activeBlock.row}
                    />
                    <SelectNumber
                      label="Zellen verbinden"
                      max={columnCount}
                      min={1}
                      onAuto={() =>
                        updateBlock(activeBlock.key, { widthAuto: true })
                      }
                      onChange={(value) =>
                        updateBlock(activeBlock.key, {
                          width: value,
                          widthAuto: false,
                        })
                      }
                      value={activeBlock.width}
                      valueAuto={activeBlock.widthAuto}
                    />
                    <SelectNumber
                      label="Zeilen verbinden"
                      max={rowCount}
                      min={1}
                      onChange={(value) =>
                        updateBlock(activeBlock.key, { height: value })
                      }
                      value={activeBlock.height}
                    />
                  </div>
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Breite cm
                    </span>
                    <input
                      className={inputClass}
                      inputMode="decimal"
                      min="0"
                      onChange={(event) =>
                        updateBlock(activeBlock.key, {
                          widthMm: parseCentimetersToMillimeters(
                            event.currentTarget.value,
                          ),
                        })
                      }
                      placeholder="Auto nach Inhalt"
                      step="0.1"
                      type="number"
                      value={
                        activeBlock.widthMm
                          ? Math.round(activeBlock.widthMm) / 10
                          : ""
                      }
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Leer lassen = automatisch. Für Abstand z. B. 1,5 cm.
                    </p>
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
  blocks,
  columnCount,
  codeType,
  companyLogoUrl,
  draggedBlockKey,
  gapMm,
  item,
  onAddColumn,
  onDropBlock,
  onRemoveColumn,
  onSelectBlock,
  previewHeight,
  previewScale,
  previewWidth,
  rowCount,
  minimumColumnCount,
  setDraggedBlockKey,
  showBorder,
}: {
  blocks: InventoryLabelBlock[];
  columnCount: number;
  codeType: string;
  companyLogoUrl: string | null;
  draggedBlockKey: InventoryLabelBlock["key"] | null;
  gapMm: number;
  item: (InventoryLabelItem & { id: string }) | null;
  minimumColumnCount: number;
  onAddColumn: () => void;
  onDropBlock: (row: number, col: number) => void;
  onRemoveColumn: () => void;
  onSelectBlock: (key: InventoryLabelBlock["key"]) => void;
  previewHeight: number;
  previewScale: number;
  previewWidth: number;
  rowCount: number;
  setDraggedBlockKey: (key: InventoryLabelBlock["key"] | null) => void;
  showBorder: boolean;
}) {
  const rowIndexes = Array.from({ length: rowCount }, (_, index) => index + 1);
  const colIndexes = Array.from({ length: columnCount }, (_, index) => index + 1);

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-gray-900">Etikettfläche</div>
          <p className="mt-1 text-xs text-gray-500">
            Bausteine in eine Zelle ziehen. QR kann über mehrere Zeilen laufen.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-700">
            {rowCount} Zeilen · {columnCount} Spalten ·{" "}
            {Math.round(previewWidth)}×{Math.round(previewHeight)} mm
          </span>
          <button
            className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-bold text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={columnCount <= minimumColumnCount}
            onClick={onRemoveColumn}
            title={
              columnCount <= minimumColumnCount
                ? "Nicht möglich, weil rechts noch ein Baustein liegt."
                : "Eine Spalte entfernen"
            }
            type="button"
          >
            - Spalte
          </button>
          <button
            className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-bold text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={columnCount >= INVENTORY_LABEL_MAX_COLUMNS}
            onClick={onAddColumn}
            type="button"
          >
            + Spalte
          </button>
        </div>
      </div>
      <div className="overflow-auto rounded-xl border border-gray-200 bg-gray-100 p-3">
        <div
          className={`relative grid bg-white p-2 text-gray-950 ${
            showBorder ? "border-2 border-gray-900" : ""
          }`}
          style={{
            gap: `${gapMm * previewScale}px`,
            gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${rowCount}, minmax(0, 1fr))`,
            height: `${previewHeight * previewScale}px`,
            width: `${previewWidth * previewScale}px`,
          }}
        >
          {rowIndexes.flatMap((row) =>
            colIndexes.map((col) => (
              <div
                className={`rounded border border-dashed ${
                  draggedBlockKey
                    ? "border-blue-300 bg-blue-50/50"
                    : "border-gray-200"
                }`}
                key={`${row}-${col}`}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  onDropBlock(row, col);
                }}
                style={{
                  gridColumn: col,
                  gridRow: row,
                }}
              />
            )),
          )}

          {blocks.map((block) => (
            <PlacedBlock
              block={block}
              codeType={codeType}
              columnCount={columnCount}
              companyLogoUrl={companyLogoUrl}
              item={item}
              key={block.key}
              onSelectBlock={onSelectBlock}
              setDraggedBlockKey={setDraggedBlockKey}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function PlacedBlock({
  block,
  codeType,
  columnCount,
  companyLogoUrl,
  item,
  onSelectBlock,
  setDraggedBlockKey,
}: {
  block: InventoryLabelBlock;
  codeType: string;
  columnCount: number;
  companyLogoUrl: string | null;
  item: (InventoryLabelItem & { id: string }) | null;
  onSelectBlock: (key: InventoryLabelBlock["key"]) => void;
  setDraggedBlockKey: (key: InventoryLabelBlock["key"] | null) => void;
}) {
  const meta = getInventoryLabelBlockMeta(block.key);
  const value = item ? getInventoryLabelValue(item, block.key) : "";

  if (!meta) return null;

  if (isInventoryLabelSpacerBlock(block.key)) {
    return (
      <button
        className="z-10 flex cursor-grab items-center justify-center overflow-hidden rounded border border-dashed border-amber-400 bg-amber-50/80 px-2 py-1 text-[10px] font-black uppercase text-amber-700 active:cursor-grabbing"
        draggable
        onClick={() => onSelectBlock(block.key)}
        onDragEnd={() => setDraggedBlockKey(null)}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = "move";
          setDraggedBlockKey(block.key);
        }}
        style={getGridPlacement(block, columnCount)}
        type="button"
      >
        Abstand
        {block.widthMm ? ` · ${formatMillimetersAsCentimeters(block.widthMm)} cm` : ""}
      </button>
    );
  }

  if (block.key === "companyLogo") {
    return (
      <button
        className="z-10 flex cursor-grab items-center justify-center overflow-hidden bg-white active:cursor-grabbing"
        draggable
        onClick={() => onSelectBlock(block.key)}
        onDragEnd={() => setDraggedBlockKey(null)}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = "move";
          setDraggedBlockKey(block.key);
        }}
        style={getGridPlacement(block, columnCount)}
        type="button"
      >
        {companyLogoUrl ? (
          <img
            alt="Firmenlogo"
            className="h-full max-h-full w-full max-w-full object-contain"
            src={companyLogoUrl}
          />
        ) : (
          <span className="text-center text-[10px] font-black text-gray-400">
            Firmenlogo
          </span>
        )}
      </button>
    );
  }

  if (block.key === "code") {
    return (
      <button
        className="z-10 flex cursor-grab items-center justify-center overflow-hidden bg-white active:cursor-grabbing"
        draggable
        onClick={() => onSelectBlock(block.key)}
        onDragEnd={() => setDraggedBlockKey(null)}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = "move";
          setDraggedBlockKey(block.key);
        }}
        style={getGridPlacement(block, columnCount)}
        type="button"
      >
        {item ? (
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
        )}
      </button>
    );
  }

  return (
    <button
      className={`z-10 cursor-grab overflow-hidden bg-white px-1 py-0.5 leading-tight active:cursor-grabbing ${getTextAlignClass(
        block.align,
      )} ${getTextStyleClass(block)} ${
        block.underline ? "underline underline-offset-2" : ""
      } ${
        block.widthAuto ? "whitespace-nowrap" : "break-words"
      } ${getPreviewTextClass(
        block.size,
      )}`}
      draggable
      onClick={() => onSelectBlock(block.key)}
      onDragEnd={() => setDraggedBlockKey(null)}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        setDraggedBlockKey(block.key);
      }}
      style={getGridPlacement(block, columnCount)}
      type="button"
    >
      {block.labelVisible && value ? (
        <span className="mr-1 text-[0.65em] font-semibold uppercase text-gray-950">
          {meta.label}:
        </span>
      ) : null}
      {value}
    </button>
  );
}

function SelectNumber({
  disabled,
  label,
  max,
  min,
  onAuto,
  onChange,
  value,
  valueAuto = false,
}: {
  disabled?: boolean;
  label: string;
  max: number;
  min: number;
  onAuto?: () => void;
  onChange: (value: number) => void;
  value: number;
  valueAuto?: boolean;
}) {
  return (
    <label>
      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </span>
      <select
        className={inputClass}
        disabled={disabled}
        onChange={(event) => {
          if (event.currentTarget.value === "auto") {
            onAuto?.();
            return;
          }

          onChange(Number.parseInt(event.currentTarget.value, 10));
        }}
        value={valueAuto ? "auto" : value}
      >
        {onAuto ? <option value="auto">Auto</option> : null}
        {Array.from({ length: max - min + 1 }).map((_, index) => {
          const option = min + index;
          return (
            <option key={option} value={option}>
              {option}
            </option>
          );
        })}
      </select>
    </label>
  );
}

function getGridPlacement(block: InventoryLabelBlock, columnCount: number) {
  const width = getEffectiveInventoryLabelBlockWidth(block, columnCount);

  return {
    gridColumn: `${block.col} / span ${width}`,
    gridRow: `${block.row} / span ${block.height}`,
  };
}

function clampBlock(
  block: InventoryLabelBlock,
  columnCount: number,
  rowCount: number,
): InventoryLabelBlock {
  const safeColumnCount = Math.min(
    INVENTORY_LABEL_MAX_COLUMNS,
    Math.max(1, Math.round(columnCount || 1)),
  );
  const safeRowCount = Math.min(
    INVENTORY_LABEL_MAX_ROWS,
    Math.max(1, Math.round(rowCount || 1)),
  );
  const width = Math.min(
    safeColumnCount,
    Math.max(1, Math.round(block.width || 1)),
  );
  const height = Math.min(
    safeRowCount,
    Math.max(1, Math.round(block.height || 1)),
  );
  const col = Math.min(
    safeColumnCount - width + 1,
    Math.max(1, Math.round(block.col || 1)),
  );
  const row = Math.min(
    safeRowCount - height + 1,
    Math.max(1, Math.round(block.row || 1)),
  );

  return {
    ...block,
    col,
    height,
    row,
    width,
    widthAuto: Boolean(block.widthAuto),
    widthMm:
      typeof block.widthMm === "number" && Number.isFinite(block.widthMm)
        ? Math.min(500, Math.max(0, Math.round(block.widthMm * 10) / 10))
        : null,
  };
}

function getNewTemplateStartBlocks() {
  return DEFAULT_INVENTORY_LABEL_BLOCKS.map((block) => {
    if (block.key === "objectNumber") {
      return {
        ...block,
        col: 1,
        enabled: true,
        height: 1,
        row: 1,
        width: 1,
        widthMm: null,
        widthAuto: false,
      };
    }

    if (block.key === "code") {
      return {
        ...block,
        col: 1,
        enabled: true,
        height: 2,
        row: 2,
        width: 1,
        widthMm: null,
        widthAuto: false,
      };
    }

    if (block.key === "name") {
      return {
        ...block,
        col: 1,
        enabled: true,
        height: 1,
        row: 4,
        width: 1,
        widthMm: null,
        widthAuto: true,
      };
    }

    return {
      ...block,
      col: 1,
      enabled: false,
      height: 1,
      row: 1,
      width: 1,
      widthMm: null,
      widthAuto: false,
    };
  });
}

function parseCentimetersToMillimeters(value: string) {
  const parsed = Number.parseFloat(value.replace(/\./g, "").replace(",", "."));

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.round(parsed * 100) / 10;
}

function formatMillimetersAsCentimeters(value: number) {
  return (Math.round(value) / 10).toLocaleString("de-DE", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
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
