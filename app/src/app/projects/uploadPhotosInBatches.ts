/** Vercel's serverless functions reject request bodies over ~4.5MB before
 * the Server Action even runs - Next.js's own bodySizeLimit config (see
 * next.config.ts) only governs Next.js's own parsing and does nothing
 * against that platform-level cutoff. A handful of full-resolution iPhone
 * photos in one FormData easily exceeds it, which surfaces client-side as
 * a generic "unexpected response was received from the server" - not a
 * validation error, since the request never reaches app code at all.
 *
 * Splitting the selected files into several smaller uploads sidesteps this
 * without touching the files themselves (so EXIF/GPS/original bytes stay
 * intact) - each batch's total size is kept safely under the limit. */
const MAX_BATCH_BYTES = 3.5 * 1024 * 1024;

function splitIntoBatches(files: File[]): File[][] {
  const batches: File[][] = [];
  let currentBatch: File[] = [];
  let currentBatchBytes = 0;

  for (const file of files) {
    if (currentBatch.length > 0 && currentBatchBytes + file.size > MAX_BATCH_BYTES) {
      batches.push(currentBatch);
      currentBatch = [];
      currentBatchBytes = 0;
    }
    currentBatch.push(file);
    currentBatchBytes += file.size;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

/** Uploads the "photos" files already in `formData` in size-bounded
 * batches, sequentially. Every other field (projectId, notes, checkboxes,
 * GPS, ...) is cloned into each batch's own FormData, and "photoNotes"
 * (one per photo, matched by position - see ProjectPhotoNoteFields) is
 * re-indexed per batch so per-photo notes stay attached to the right
 * photo even though each batch is its own request. */
export async function uploadPhotosInBatches({
  formData,
  onProgress,
  upload,
}: {
  formData: FormData;
  onProgress?: (uploadedCount: number, totalCount: number) => void;
  upload: (formData: FormData) => Promise<string[]>;
}): Promise<string[]> {
  const files = formData.getAll("photos").filter((entry): entry is File => entry instanceof File);
  const photoNotes = formData.getAll("photoNotes").map((entry) => String(entry));
  const sharedEntries = Array.from(formData.entries()).filter(
    ([key]) => key !== "photos" && key !== "photoNotes",
  );
  const batches = splitIntoBatches(files);
  const uploadedPublicUrls: string[] = [];
  let uploadedCount = 0;
  let fileIndex = 0;

  for (const batch of batches) {
    const batchFormData = new FormData();
    for (const [key, value] of sharedEntries) {
      batchFormData.append(key, value);
    }
    for (const file of batch) {
      batchFormData.append("photos", file);
      batchFormData.append("photoNotes", photoNotes[fileIndex] ?? "");
      fileIndex += 1;
    }

    const urls = await upload(batchFormData);
    uploadedPublicUrls.push(...urls);
    uploadedCount += batch.length;
    onProgress?.(uploadedCount, files.length);
  }

  return uploadedPublicUrls;
}
