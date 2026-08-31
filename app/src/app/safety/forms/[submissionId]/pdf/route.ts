import { prisma } from "@/lib/prisma";
import {
  parseProjectFormFields,
  parseProjectFormSnapshotFields,
  parseProjectFormSnapshotSettings,
  parseProjectFormValues,
} from "@/app/projects/projectFormTypes";
import { createFormPdf, normalizeFormPdfCompany } from "@/lib/formPdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ submissionId: string }> },
) {
  const { submissionId } = await context.params;
  const [submission, rawCompany] = await Promise.all([
    prisma.safetyFormSubmission.findUnique({
      where: { id: submissionId },
      include: { project: true, template: true },
    }),
    prisma.companyInfo.findUnique({ where: { id: "default" } }),
  ]);
  if (!submission) return new Response("Formular nicht gefunden.", { status: 404 });

  const values = parseProjectFormValues(submission.valuesJson);
  const settings = parseProjectFormSnapshotSettings(
    submission.templateSnapshotJson,
    submission.template,
  );

  const bytes = await createFormPdf({
    companyInfo: normalizeFormPdfCompany(rawCompany),
    createdByName: submission.createdByName,
    fields: parseProjectFormSnapshotFields(
      submission.templateSnapshotJson,
      submission.template ? parseProjectFormFields(submission.template.fieldsJson) : [],
    ),
    formDate: submission.formDate,
    paperOrientation: settings.paperOrientation,
    paperSize: settings.paperSize,
    project: submission.project
      ? {
          constructionManager: submission.project.constructionManager,
          name: submission.project.name,
          projectNumber: submission.project.projectNumber,
          siteAddress: submission.project.siteAddress,
        }
      : {
          constructionManager: null,
          name: "Arbeitssicherheit",
          projectNumber: "",
          siteAddress: null,
        },
    templateName: submission.template?.name ?? getSnapshotName(submission.templateSnapshotJson),
    title: submission.title,
    values,
  });

  return new Response(Buffer.from(bytes), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `inline; filename="${safeName(submission.title)}.pdf"`,
      "Content-Type": "application/pdf",
    },
  });
}

function getSnapshotName(snapshot: string | null) {
  try {
    const parsed = JSON.parse(snapshot ?? "{}") as { name?: unknown };
    return typeof parsed.name === "string" && parsed.name.trim()
      ? parsed.name
      : "Formular";
  } catch {
    return "Formular";
  }
}

function safeName(value: string) {
  return value.replace(/[^a-zA-Z0-9äöüÄÖÜß._-]+/g, "_").slice(0, 100);
}
