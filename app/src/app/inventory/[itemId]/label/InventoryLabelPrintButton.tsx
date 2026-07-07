"use client";

export function InventoryLabelPrintButton() {
  return (
    <button
      className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-bold text-white hover:bg-gray-700"
      onClick={() => window.print()}
      type="button"
    >
      Etikett drucken
    </button>
  );
}
