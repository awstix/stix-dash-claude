"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  deleteProjectPhoto,
  updateProjectPhoto,
} from "@/app/projects/actions";
import {
  PhotoDetailModal,
  type ProjectPhotoGalleryItem,
} from "@/app/projects/ProjectPhotoGallery";

export type DashboardPhoto = ProjectPhotoGalleryItem & {
  projectLabel: string;
};

export function DashboardPhotoWidget({
  description,
  editing,
  photos,
  title,
}: {
  description: string;
  editing: boolean;
  photos: DashboardPhoto[];
  title: string;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const photo = photos[index] ?? photos[0];

  useEffect(() => {
    if (!modalOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setModalOpen(false);
      if (event.key === "ArrowLeft") setIndex((current) => previous(current, photos.length));
      if (event.key === "ArrowRight") setIndex((current) => next(current, photos.length));
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [modalOpen, photos.length]);

  if (!photo) {
    return (
      <div className={`flex h-full flex-col ${editing ? "pt-28" : ""}`}>
        <h3 className="font-black">{title}</h3>
        <p className="mt-2 text-sm font-bold text-gray-950">{description}</p>
        <div className="mt-3 flex min-h-0 flex-1 items-center justify-center rounded-xl border border-dashed border-gray-500 font-bold text-gray-950">
          Noch keine Projektfotos vorhanden.
        </div>
      </div>
    );
  }

  function changePhoto(newIndex: number) {
    setIndex(newIndex);
  }

  return (
    <>
      <div className={`flex h-full min-h-0 flex-col ${editing ? "pt-28" : ""}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-black">{title}</h3>
            <p className="truncate text-sm font-bold text-gray-950">{photo.projectLabel}</p>
          </div>
          <span className="shrink-0 rounded-lg bg-gray-950 px-2 py-1 text-xs font-black text-white">
            {index + 1}/{photos.length}
          </span>
        </div>
        <button
          className="relative mt-3 min-h-0 flex-1 overflow-hidden rounded-xl border border-gray-400 bg-gray-950"
          onClick={() => setModalOpen(true)}
          type="button"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt={photo.projectLabel} className="h-full w-full object-contain" src={photo.publicUrl} />
        </button>
        {photos.length > 1 ? (
          <div className="mt-2 flex items-center justify-between gap-2">
            <button className="rounded-lg border border-gray-500 bg-white px-3 py-1 text-sm font-black text-gray-950 hover:bg-gray-200" onClick={() => changePhoto(previous(index, photos.length))} type="button">← Zurück</button>
            <button className="rounded-lg border border-gray-500 bg-white px-3 py-1 text-sm font-black text-gray-950 hover:bg-gray-200" onClick={() => changePhoto(next(index, photos.length))} type="button">Weiter →</button>
          </div>
        ) : null}
      </div>

      {modalOpen ? (
        <PhotoDetailModal
          currentIndex={index}
          hasMultiplePhotos={photos.length > 1}
          isDeleting={isPending}
          key={photo.id}
          onClose={() => setModalOpen(false)}
          onDelete={async () => {
            if (!window.confirm("Foto wirklich löschen?")) return;
            setIsPending(true);
            try {
              await deleteProjectPhoto(photo.id);
              setModalOpen(false);
              router.refresh();
            } finally {
              setIsPending(false);
            }
          }}
          onDownload={() => {
            const link = document.createElement("a");
            link.href = photo.publicUrl;
            link.download = photo.originalFileName || `Projektfoto-${index + 1}`;
            link.click();
          }}
          onNext={() => changePhoto(next(index, photos.length))}
          onPrevious={() => changePhoto(previous(index, photos.length))}
          onSaveNote={async (notes) => {
            setIsPending(true);
            try {
              await updateProjectPhoto({
                availableForDailyReports: photo.availableForDailyReports,
                id: photo.id,
                notes,
              });
              router.refresh();
            } finally {
              setIsPending(false);
            }
          }}
          photo={photo}
          totalCount={photos.length}
        />
      ) : null}
    </>
  );
}

function previous(index: number, count: number) {
  return (index - 1 + count) % count;
}

function next(index: number, count: number) {
  return (index + 1) % count;
}
