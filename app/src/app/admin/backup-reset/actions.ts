"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth-access";
import {
  cleanupLegacyMasterData,
  resetDashboardData,
} from "@/lib/data-maintenance";

export async function resetDashboardDataAction(formData: FormData) {
  await requireAdmin();
  const confirmation = String(formData.get("confirmation") ?? "").trim();

  if (confirmation !== "RESET") {
    throw new Error(
      "Bitte RESET eingeben, damit der Datenreset wirklich ausgeführt wird.",
    );
  }

  const result = resetDashboardData({
    deleteCategories: formData.get("deleteCategories") === "on",
    deleteQualificationTypes:
      formData.get("deleteQualificationTypes") === "on",
    deleteUploads: formData.get("deleteUploads") === "on",
  });

  const params = new URLSearchParams({
    backup: result.backupPath,
    deleted: String(result.deletedRows),
    reset: "1",
    uploads: String(result.uploadsCleared.length),
  });

  redirect(`/admin/backup-reset?${params.toString()}`);
}

export async function cleanupLegacyMasterDataAction() {
  await requireAdmin();
  const result = cleanupLegacyMasterData();
  const params = new URLSearchParams({
    backup: result.backupPath,
    deleted: String(result.deletedRows),
    legacyCleanup: "1",
  });

  redirect(`/admin/backup-reset?${params.toString()}`);
}
