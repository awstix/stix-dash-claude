import type { Prisma } from "@prisma/client";

export function formatInventoryObjectNumber(value: number) {
  return String(value).padStart(6, "0");
}

export async function getNextInventoryObjectNumber(
  tx: Prisma.TransactionClient,
  categoryId: string | null,
) {
  if (!categoryId) {
    throw new Error("Bitte eine Kategorie wählen, damit eine Objekt-ID vergeben werden kann.");
  }

  const category = await tx.inventoryCategory.findUnique({
    where: {
      id: categoryId,
    },
    select: {
      name: true,
      nextObjectNumber: true,
      objectNumberEnd: true,
      objectNumberStart: true,
    },
  });

  if (
    !category ||
    category.objectNumberStart === null ||
    category.objectNumberEnd === null
  ) {
    throw new Error(
      "Für diese Kategorie ist noch kein Nummernkreis hinterlegt. Bitte zuerst im Admin-Menü den Nummernkreis pflegen.",
    );
  }

  const rangeStart = category.objectNumberStart;
  const rangeEnd = category.objectNumberEnd;
  let candidate = category.nextObjectNumber ?? rangeStart;

  const lastAssignedItem = await tx.inventoryItem.findFirst({
    where: {
      objectNumber: {
        gte: formatInventoryObjectNumber(rangeStart),
        lte: formatInventoryObjectNumber(rangeEnd),
      },
    },
    orderBy: {
      objectNumber: "desc",
    },
    select: {
      objectNumber: true,
    },
  });

  if (lastAssignedItem?.objectNumber) {
    const lastAssignedNumber = Number.parseInt(lastAssignedItem.objectNumber, 10);
    if (Number.isInteger(lastAssignedNumber)) {
      candidate = Math.max(candidate, lastAssignedNumber + 1);
    }
  }

  while (candidate <= rangeEnd) {
    const objectNumber = formatInventoryObjectNumber(candidate);
    const existingItem = await tx.inventoryItem.findUnique({
      where: {
        objectNumber,
      },
      select: {
        id: true,
      },
    });

    if (!existingItem) {
      await tx.inventoryCategory.update({
        where: {
          id: categoryId,
        },
        data: {
          nextObjectNumber: candidate < rangeEnd ? candidate + 1 : candidate,
        },
      });

      return objectNumber;
    }

    candidate += 1;
  }

  throw new Error(
    `Der Nummernkreis der Kategorie „${category.name}“ ist voll. Bitte im Admin-Menü erweitern.`,
  );
}
