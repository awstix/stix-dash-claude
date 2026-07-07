import { createInventoryLabelPng } from "@/lib/inventory-label-png";
import { getLiveLabelExportPayload } from "../shared";

export async function POST(request: Request) {
  const payload = await getLiveLabelExportPayload(await request.formData());
  const png = await createInventoryLabelPng({
    blocks: payload.blocks,
    companyLogoUrl: payload.companyInfo?.logoPublicUrl ?? null,
    companyName: payload.companyInfo?.companyName ?? null,
    item: payload.item,
    template: payload.template,
  });

  return new Response(new Uint8Array(png), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="inventar-${payload.fileLabel}.png"`,
      "Content-Type": "image/png",
    },
  });
}
