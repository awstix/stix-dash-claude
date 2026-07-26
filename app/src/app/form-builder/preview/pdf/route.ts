import { createFormPdf, normalizeFormPdfCompany } from "@/lib/formPdf";
import { prisma } from "@/lib/prisma";
import {
  parseProjectFormFields,
  projectFormFieldCollectsValue,
} from "@/app/projects/projectFormTypes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const payload = (await request.json()) as {
    fields?: unknown;
    paperOrientation?: string;
    paperSize?: string;
    scope?: string;
    templateName?: string;
  };

  const fields = parseProjectFormFields(JSON.stringify(payload.fields ?? []));
  const companyInfo = await prisma.companyInfo.findUnique({
    where: { id: "default" },
  });
  const templateName =
    typeof payload.templateName === "string" && payload.templateName.trim()
      ? payload.templateName.trim().slice(0, 140)
      : "Formularvorschau";
  const scopeLabel = getScopeLabel(payload.scope);
  const values = Object.fromEntries(
    fields.map((field) => [
      field.id,
      projectFormFieldCollectsValue(field.type)
        ? field.type === "checkbox"
          ? false
          : ""
        : "",
    ]),
  );

  const bytes = await createFormPdf({
    companyInfo: normalizeFormPdfCompany(companyInfo),
    createdByName: "Live-Vorschau",
    fields,
    formDate: new Date(),
    paperOrientation:
      payload.paperOrientation === "LANDSCAPE" ? "LANDSCAPE" : "PORTRAIT",
    paperSize: payload.paperSize === "A5" ? "A5" : "A4",
    project: {
      constructionManager: null,
      name: scopeLabel,
      projectNumber: "",
      siteAddress: null,
    },
    templateName,
    title: `${templateName} · Live-Vorschau`,
    values,
  });

  return new Response(Buffer.from(bytes), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `inline; filename="${safeFileName(
        templateName,
      )}_Live_Vorschau.pdf"`,
      "Content-Type": "application/pdf",
    },
  });
}

function getScopeLabel(scope: unknown) {
  if (scope === "WORKSHOP") return "Werkstatt";
  if (scope === "SAFETY") return "Arbeitssicherheit";
  return "Projekt";
}

function safeFileName(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 120) || "Formular"
  );
}
