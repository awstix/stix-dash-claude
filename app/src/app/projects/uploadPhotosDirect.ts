import { createProjectPhotoUploadSlot, finalizeProjectPhotoUpload } from "./actions";

/** Vercel rejects incoming request bodies over ~4.5MB before a Server
 * Action even runs, and full-resolution phone photos routinely exceed
 * that on their own - splitting several files across smaller requests
 * (as the older batched-FormData upload did) can't help once a single
 * file is already too big by itself. Uploading the raw bytes straight to
 * Supabase Storage from the browser via a signed URL sidesteps the limit
 * entirely, regardless of file size; only small JSON payloads (the slot
 * request and the finalize call) ever go through a Server Action. */
async function putFileToSignedUrl(signedUrl: string, file: File) {
  const body = new FormData();
  body.append("cacheControl", "3600");
  body.append("", file);

  const response = await fetch(signedUrl, {
    method: "PUT",
    headers: { "x-upsert": "true" },
    body,
  });

  if (!response.ok) {
    throw new Error(
      `Foto-Upload zum Speicher fehlgeschlagen (${response.status}). Bitte Verbindung prüfen und erneut versuchen.`,
    );
  }
}

const UPLOAD_TIMEOUT_MS = 90_000;

function withTimeout<T>(promise: Promise<T>, fileName: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(
        new Error(
          `Der Upload von "${fileName}" dauert ungewöhnlich lange (schwache Verbindung?). Bitte Verbindung prüfen und erneut versuchen.`,
        ),
      );
    }, UPLOAD_TIMEOUT_MS);

    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

export async function uploadPhotosDirect({
  files,
  projectId,
  notes,
  photoNotes,
  availableForDailyReports,
  takeMetadata,
  compressPhotos,
  cameraGps,
  onProgress,
}: {
  files: File[];
  projectId: string;
  notes: string;
  photoNotes: string[];
  availableForDailyReports: boolean;
  takeMetadata: boolean;
  compressPhotos: boolean;
  cameraGps: { latitude: number; longitude: number } | null;
  onProgress?: (uploadedCount: number, totalCount: number) => void;
}): Promise<string[]> {
  const publicUrls: string[] = [];

  for (const [index, file] of files.entries()) {
    const publicUrl = await withTimeout(
      (async () => {
        const slot = await createProjectPhotoUploadSlot({
          projectId,
          originalFileName: file.name,
          mimeType: file.type || "application/octet-stream",
          fileSizeBytes: file.size,
        });

        await putFileToSignedUrl(slot.signedUrl, file);

        return finalizeProjectPhotoUpload({
          projectId,
          storagePath: slot.storagePath,
          fileName: slot.fileName,
          mimeType: file.type || "application/octet-stream",
          originalFileName: file.name,
          fileLastModified: file.lastModified,
          notes,
          photoNote: photoNotes[index] ?? "",
          availableForDailyReports,
          takeMetadata,
          compressPhotos,
          cameraGpsLatitude: cameraGps?.latitude ?? null,
          cameraGpsLongitude: cameraGps?.longitude ?? null,
        });
      })(),
      file.name,
    );

    publicUrls.push(publicUrl);
    onProgress?.(index + 1, files.length);
  }

  return publicUrls;
}
