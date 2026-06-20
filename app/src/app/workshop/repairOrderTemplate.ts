import { prisma } from "@/lib/prisma";
import {
  DEFAULT_REPAIR_ORDER_FIELDS,
  WORKSHOP_REPAIR_TEMPLATE_ID,
} from "./repairOrderTemplateConfig";

export {
  DEFAULT_REPAIR_ORDER_FIELDS,
  WORKSHOP_REPAIR_SYSTEM_FIELD_IDS,
  WORKSHOP_REPAIR_TEMPLATE_ID,
} from "./repairOrderTemplateConfig";

export async function ensureWorkshopRepairOrderTemplate() {
  return prisma.workshopFormTemplate.upsert({
    where: { id: WORKSHOP_REPAIR_TEMPLATE_ID },
    update: {},
    create: {
      id: WORKSHOP_REPAIR_TEMPLATE_ID,
      category: "Reparatur",
      description:
        "Systemvorlage für echte Reparaturaufträge mit Status, Priorität, Planung und Archiv.",
      fieldsJson: JSON.stringify(DEFAULT_REPAIR_ORDER_FIELDS),
      name: "Reparaturauftrag",
      paperOrientation: "PORTRAIT",
      paperSize: "A4",
      sortOrder: -100,
    },
  });
}
