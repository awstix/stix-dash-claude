import { prisma } from "@/lib/prisma";
import { createFormPdf, normalizeFormPdfCompany } from "@/lib/formPdf";
import { parseProjectFormFields } from "@/app/projects/projectFormTypes";
import { WORKSHOP_REPAIR_TEMPLATE_ID } from "../../../repairOrderTemplate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await context.params;
  const [order, company, template] = await Promise.all([
    prisma.workshopRepairOrder.findUnique({ where: { id: orderId } }),
    prisma.companyInfo.findUnique({ where: { id: "default" } }),
    prisma.workshopFormTemplate.findUnique({
      where: { id: WORKSHOP_REPAIR_TEMPLATE_ID },
    }),
  ]);

  if (!order) {
    return new Response("Reparaturauftrag nicht gefunden.", { status: 404 });
  }

  const fields = parseProjectFormFields(template?.fieldsJson);
  const values: Record<string, boolean | string> = {
    assignedTo: order.assignedTo ?? "",
    description: order.description ?? "",
    notes: order.notes ?? "",
    plannedEnd: formatDate(order.plannedEnd),
    plannedStart: formatDate(order.plannedStart),
    priority: priorityLabel(order.priority),
    reportedAt: formatDate(order.reportedAt),
    status:
      order.status === "DONE"
        ? `${statusLabel(order.status)} · ${formatDate(order.completedAt)}`
        : statusLabel(order.status),
    title: order.title,
    vehicleId: vehicleLabel(order),
    ...parseCustomValues(order.customValuesJson),
  };
  const bytes = await createFormPdf({
    companyInfo: normalizeFormPdfCompany(company),
    createdByName: order.assignedTo,
    fields,
    formDate: order.reportedAt,
    paperOrientation:
      template?.paperOrientation === "LANDSCAPE" ? "LANDSCAPE" : "PORTRAIT",
    paperSize: template?.paperSize === "A5" ? "A5" : "A4",
    project: {
      constructionManager: null,
      name: "Werkstatt",
      projectNumber: "",
      siteAddress: null,
    },
    templateName: template?.name ?? "Reparaturauftrag",
    title: order.title,
    values,
  });

  return new Response(Buffer.from(bytes), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${safeName(order.title)}.pdf"`,
      "Content-Type": "application/pdf",
    },
  });
}

function vehicleLabel(order: {
  licensePlate: string | null;
  vehicleNumber: string | null;
  vehicleType: string | null;
}) {
  return [order.vehicleNumber, order.licensePlate, order.vehicleType]
    .filter(Boolean)
    .join(" · ");
}

function formatDate(value: Date | null) {
  return value ? new Intl.DateTimeFormat("de-DE").format(value) : "";
}

function statusLabel(value: string) {
  return {
    CANCELLED: "Abgebrochen",
    DONE: "Erledigt",
    IN_PROGRESS: "In Arbeit",
    OPEN: "Offen",
    WAITING: "Wartet",
  }[value] ?? value;
}

function priorityLabel(value: string) {
  return {
    HIGH: "Hoch",
    LOW: "Niedrig",
    NORMAL: "Normal",
    URGENT: "Dringend",
  }[value] ?? value;
}

function parseCustomValues(value: string | null) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, boolean | string>)
      : {};
  } catch {
    return {};
  }
}

function safeName(value: string) {
  return value.replace(/[^a-zA-Z0-9äöüÄÖÜß._-]+/g, "_").slice(0, 100);
}
