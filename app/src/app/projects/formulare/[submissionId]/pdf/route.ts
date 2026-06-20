import { prisma } from "@/lib/prisma";
import { createFormPdf, normalizeFormPdfCompany } from "@/lib/formPdf";
import {
  parseProjectFormFields,
  parseProjectFormSnapshotFields,
  parseProjectFormSnapshotSettings,
  parseProjectFormValues,
} from "../../../projectFormTypes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ submissionId: string }> },
) {
  const { submissionId } = await context.params;
  const [submission, companyInfo] = await Promise.all([
    prisma.projectFormSubmission.findUnique({
      where: { id: submissionId },
      include: {
        project: {
          select: {
            constructionManager: true,
            name: true,
            projectNumber: true,
            siteAddress: true,
          },
        },
        template: true,
      },
    }),
    prisma.companyInfo.findUnique({ where: { id: "default" } }),
  ]);

  if (!submission) {
    return new Response("Formular nicht gefunden.", { status: 404 });
  }

  const fallbackFields = parseProjectFormFields(submission.template?.fieldsJson);
  const fields = parseProjectFormSnapshotFields(
    submission.templateSnapshotJson,
    fallbackFields,
  );
  const values = parseProjectFormValues(submission.valuesJson);
  const settings = parseProjectFormSnapshotSettings(
    submission.templateSnapshotJson,
    submission.template,
  );
  const templateName =
    submission.template?.name ??
    getSnapshotText(submission.templateSnapshotJson, "name") ??
    "Formular";
  const bytes = await createFormPdf({
    createdByName: submission.createdByName,
    companyInfo: normalizeFormPdfCompany(companyInfo),
    fields,
    formDate: submission.formDate,
    paperOrientation: settings.paperOrientation,
    paperSize: settings.paperSize,
    project: submission.project,
    templateName,
    title: submission.title,
    values,
  });

  return new Response(Buffer.from(bytes), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${sanitizeFileName(
        `${submission.project.projectNumber}_${submission.title}`,
      )}.pdf"`,
      "Content-Type": "application/pdf",
    },
  });
}

function getSnapshotText(snapshotJson: string | null, key: string) {
  if (!snapshotJson) return null;
  try {
    const parsed = JSON.parse(snapshotJson) as Record<string, unknown>;
    const value = parsed[key];
    return typeof value === "string" && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}

function sanitizeFileName(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 160) || "Formular"
  );
}
