"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { ActionIcon } from "@/components/ActionIcon";
import { deleteUniversalFormTemplate } from "@/app/form-builder/actions";

type Template = {
  category: string | null;
  description: string | null;
  emailRecipients: string[];
  fields: unknown[];
  id: string;
  isRepairTemplate: boolean;
  name: string;
  paperOrientation: string;
  paperSize: string;
};

export function WorkshopTemplateBuilder({
  templates,
}: {
  templates: Template[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function openBuilder(templateId?: string) {
    router.push(
      templateId
        ? `/form-builder?scope=WORKSHOP&templateId=${templateId}`
        : "/form-builder?scope=WORKSHOP",
    );
  }

  function deleteTemplate(template: Template) {
    if (template.isRepairTemplate) return;

    const confirmed = window.confirm(
      `Vorlage "${template.name}" wirklich löschen?\n\nBereits gespeicherte Formulare bleiben erhalten.`,
    );

    if (!confirmed) return;

    startTransition(async () => {
      try {
        await deleteUniversalFormTemplate("WORKSHOP", template.id);
        router.refresh();
      } catch (error) {
        alert(
          error instanceof Error
            ? error.message
            : "Vorlage konnte nicht gelöscht werden.",
        );
      }
    });
  }

  return (
    <>
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Werkstatt-Formularvorlagen
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Vorlagen werden zentral im Formularbuilder gepflegt. Die
              gespeicherten Werkstattformulare bleiben hier und in den
              Werkstattaufträgen nutzbar.
            </p>
          </div>
          <button
            className="w-fit rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
            onClick={() => openBuilder()}
            type="button"
          >
            + Neue Vorlage
          </button>
        </div>
      </section>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {templates.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-5 text-sm font-medium text-gray-500">
            Noch keine Werkstatt-Formularvorlagen vorhanden.
          </p>
        ) : (
          templates.map((template) => (
            <div
              key={template.id}
              className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {template.category || "Werkstatt"}
              </div>
              <h2 className="mt-1 font-semibold text-gray-900">
                {template.name}
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                {template.fields.length} Felder · {template.paperSize}{" "}
                {template.paperOrientation === "LANDSCAPE" ? "quer" : "hoch"} ·{" "}
                {template.emailRecipients.length} Empfänger
              </p>
              {template.description ? (
                <p className="mt-2 text-sm text-gray-500">
                  {template.description}
                </p>
              ) : null}
              {template.isRepairTemplate ? (
                <p className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-xs font-medium text-blue-900">
                  Systemvorlage: geschützte Reparaturfelder bleiben erhalten.
                </p>
              ) : null}
              <div className="mt-4 flex gap-2">
                <button
                  aria-label="Vorlage bearbeiten"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                  onClick={() => openBuilder(template.id)}
                  title="Vorlage bearbeiten"
                  type="button"
                >
                  <ActionIcon className="h-4 w-4" name="edit" />
                </button>
                {!template.isRepairTemplate ? (
                  <button
                    aria-label="Vorlage löschen"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-50 disabled:opacity-60"
                    disabled={isPending}
                    onClick={() => deleteTemplate(template)}
                    title="Vorlage löschen"
                    type="button"
                  >
                    <ActionIcon className="h-4 w-4" name="delete" />
                  </button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
