"use client";

import { FormEvent, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadProjectPhotos } from "./actions";

export function ProjectInlinePhotoUpload({
  projectId,
  projectLabel,
}: {
  projectId: string;
  projectLabel: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();

  function uploadPhotos(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      try {
        await uploadProjectPhotos(formData);
        formRef.current?.reset();
        router.refresh();
      } catch (error) {
        alert(
          error instanceof Error
            ? error.message
            : "Fotos konnten nicht hochgeladen werden.",
        );
      }
    });
  }

  return (
    <form
      className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3"
      encType="multipart/form-data"
      onSubmit={uploadPhotos}
      ref={formRef}
    >
      <input name="projectId" type="hidden" value={projectId} />

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase text-gray-500">
              Foto hochladen
            </div>
            <div className="mt-1 w-fit rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
              {projectLabel}
            </div>
          </div>

          <button
            className="w-fit rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-700 disabled:opacity-60"
            disabled={isPending}
            type="submit"
          >
            {isPending ? "Lädt hoch..." : "Hochladen"}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1fr]">
          <label className="text-sm font-semibold text-gray-800">
            Fotos
            <input
              accept="image/*"
              className="mt-1 w-full rounded-lg border border-dashed border-gray-300 bg-white px-3 py-3 text-sm text-gray-900 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-900 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
              multiple
              name="photos"
              required
              type="file"
            />
          </label>

          <label className="text-sm font-semibold text-gray-800">
            Hochgeladen von
            <input
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
              name="uploadedByName"
              placeholder="Name"
              type="text"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <label className="text-sm font-semibold text-gray-800">
            Notiz
            <textarea
              className="mt-1 min-h-20 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
              name="notes"
              placeholder="z. B. Einbau, Schadstelle, Lieferscheinbezug ..."
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800">
            <input
              className="h-4 w-4"
              defaultChecked
              name="takeMetadata"
              type="checkbox"
            />
            Metadaten übernehmen
          </label>

          <label className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800">
            <input
              className="h-4 w-4"
              defaultChecked
              name="availableForDailyReports"
              type="checkbox"
            />
            Bautagesbericht
          </label>
        </div>
      </div>
    </form>
  );
}
