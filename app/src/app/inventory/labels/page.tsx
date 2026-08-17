import Link from "next/link";
import { ActionIcon } from "@/components/ActionIcon";
import { AppShell } from "@/components/AppShell";
import { parseInventoryLabelBlocks } from "@/lib/inventory-labels";
import { prisma } from "@/lib/prisma";
import {
  createDefaultInventoryLabelTemplates,
  createInventoryLabelTemplate,
  deleteInventoryLabelTemplate,
  updateInventoryLabelTemplate,
} from "./actions";
import { InventoryLabelTemplateEditor } from "./InventoryLabelTemplateEditor";

export default async function InventoryLabelsPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>;
}) {
  const { template: selectedTemplateId } = await searchParams;
  const [templates, previewItems, companyInfo] = await Promise.all([
    prisma.inventoryLabelTemplate.findMany({
      orderBy: [{ isDefault: "desc" }, { tapeWidthMm: "asc" }, { name: "asc" }],
    }),
    prisma.inventoryItem.findMany({
      include: {
        category: {
          include: {
            parentCategory: {
              select: {
                id: true,
                name: true,
              },
            },
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
      orderBy: [{ objectNumber: "asc" }, { inventoryNumber: "asc" }, { name: "asc" }],
    }),
    prisma.companyInfo.findUnique({
      where: {
        id: "default",
      },
    }),
  ]);
  // "Neue Vorlage" links to ?template=new specifically so this can tell
  // "explicitly asked for a blank template" apart from "no ?template= at
  // all yet, just landed on the page" - both would otherwise look
  // identical and fall back to selecting an existing template, so
  // "Neue Vorlage" would silently keep editing (and overwriting) whatever
  // template happened to load first instead of ever creating a new one.
  const isCreatingNewTemplate = selectedTemplateId === "new";
  const selectedTemplate = isCreatingNewTemplate
    ? null
    : (templates.find((template) => template.id === selectedTemplateId) ??
      templates.find((template) => template.isDefault) ??
      templates[0] ??
      null);

  return (
    <AppShell
      title="Etikettenvorlagen"
      description="P-touch/TZe-Etiketten für Inventarobjekte mit frei wählbaren Bausteinen aus der Objektakte."
    >
      <div className="space-y-6">
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Vorlagen</h2>
              <p className="mt-1 text-sm text-gray-600">
                Du kannst beliebig viele Etikettenlayouts anlegen: nur Code,
                Code mit Text, groß, kompakt usw.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {templates.length === 0 ? (
                <form action={createDefaultInventoryLabelTemplates}>
                  <button
                    className="rounded-xl bg-yellow-400 px-3 py-2 text-xs font-bold text-gray-950 hover:bg-yellow-300"
                    type="submit"
                  >
                    Standard anlegen
                  </button>
                </form>
              ) : null}
              {selectedTemplate ? (
                <form
                  action={deleteInventoryLabelTemplate.bind(null, selectedTemplate.id)}
                >
                  <button
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-900 hover:bg-red-100"
                    type="submit"
                  >
                    <ActionIcon name="delete" />
                    Vorlage löschen
                  </button>
                </form>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
            {templates.length === 0 ? (
              <div className="w-full rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
                Noch keine Vorlage gespeichert. Du kannst direkt unten eine
                neue Vorlage anlegen oder Standardvorlagen erzeugen.
              </div>
            ) : null}

            {templates.map((template) => {
              const blocks = parseInventoryLabelBlocks(template.blocksJson);
              const enabledCount = blocks.filter((block) => block.enabled).length;
              const isSelected = selectedTemplate?.id === template.id;

              return (
                <Link
                  className={`min-w-72 rounded-2xl border p-4 transition ${
                    isSelected
                      ? "border-gray-900 bg-gray-950 text-white"
                      : "border-gray-200 bg-gray-50 text-gray-900 hover:border-gray-300 hover:bg-white"
                  }`}
                  href={`/inventory/labels?template=${template.id}`}
                  key={template.id}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black">
                        {template.name}
                      </div>
                      <div
                        className={`mt-1 text-xs ${
                          isSelected ? "text-gray-300" : "text-gray-500"
                        }`}
                      >
                        {template.tapeWidthMm} mm · Länge automatisch ·{" "}
                        {template.rowCount}Z/{template.columnCount}S ·{" "}
                        {template.codeType === "QR" ? "QR" : "ECC200"} ·{" "}
                        {enabledCount} Bausteine
                      </div>
                    </div>
                    {template.isDefault ? (
                      <span
                        className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${
                          isSelected
                            ? "bg-yellow-300 text-gray-950"
                            : "bg-yellow-100 text-yellow-900"
                        }`}
                      >
                        Standard
                      </span>
                    ) : null}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {selectedTemplate ? "Vorlage bearbeiten" : "Neue Vorlage anlegen"}
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Bausteine wählen, Reihenfolge festlegen und als Etikettenlayout
                speichern.
              </p>
            </div>

            {selectedTemplate ? (
              <Link
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-800 hover:bg-gray-50"
                href="/inventory/labels?template=new"
              >
                Neue Vorlage
              </Link>
            ) : null}
          </div>

          <InventoryLabelTemplateEditor
            action={
              selectedTemplate
                ? updateInventoryLabelTemplate.bind(null, selectedTemplate.id)
                : createInventoryLabelTemplate
            }
            key={selectedTemplate?.id ?? "new-template"}
            companyLogoUrl={companyInfo?.logoPublicUrl ?? null}
            previewItems={previewItems}
            template={selectedTemplate}
          />
        </section>
      </div>
    </AppShell>
  );
}
