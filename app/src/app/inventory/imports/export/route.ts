import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { patchWorkbookDropdowns } from "@/lib/xlsx-dropdowns";
import {
  INVENTORY_IMPORT_COLUMN_GROUPS,
  INVENTORY_IMPORT_HEADERS,
} from "../inventoryImportHeaders";
import {
  appendInventoryDropdownSheets,
  fetchInventoryDropdownData,
  inventoryDropdownValidations,
} from "../inventoryDropdowns";

export const runtime = "nodejs";

function money(cents: number | null) {
  return cents === null ? "" : cents / 100;
}

function bool(value: boolean) {
  return value ? "Ja" : "Nein";
}

function driveTypeLabel(value: string | null) {
  if (value === "TRACK") return "Kette";
  if (value === "WHEEL") return "Rad";
  if (value === "WHEEL_AND_TRACK") return "Rad+Kette";
  if (value === "TRAILER") return "Anhänger";
  if (value === "OTHER") return "Sonstiges";
  return "";
}

function statusLabel(value: string) {
  if (value === "DEFECT") return "Defekt";
  if (value === "IN_SERVICE") return "In Wartung";
  if (value === "LOCKED") return "Gesperrt";
  if (value === "STOLEN") return "Gestohlen";
  return "Aktiv";
}

function responsibleTypeLabel(value: string | null) {
  if (value === "EMPLOYEE") return "Mitarbeiter";
  if (value === "CREW") return "Kolonne";
  return "";
}

export async function GET() {
  const [items, dropdownData] = await Promise.all([
    prisma.inventoryItem.findMany({
    include: {
      category: {
        include: {
          parentCategory: {
            select: { name: true },
          },
        },
      },
      contacts: {
        orderBy: [{ role: "asc" }, { lastName: "asc" }],
        take: 1,
      },
      currentProject: {
        select: { projectNumber: true },
      },
      employeeAssignments: {
        include: {
          employee: {
            select: { firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: "asc" },
        take: 3,
      },
      parentItem: {
        select: { objectNumber: true },
      },
      responsibleCrew: {
        select: { name: true },
      },
      responsibleEmployee: {
        select: { firstName: true, lastName: true },
      },
    },
    orderBy: [{ objectNumber: "asc" }, { name: "asc" }],
    where: {
      status: {
        notIn: ["INACTIVE", "DELETED"],
      },
    },
    }),
    fetchInventoryDropdownData(),
  ]);

  const rows = items.map((item) => {
    const contact = item.contacts[0] ?? null;
    const additionalEmployees = item.employeeAssignments.map(
      (assignment) => assignment.employee,
    );

    return {
      "Objekt-ID": item.objectNumber ?? "",
      Inventarnummer: item.inventoryNumber ?? "",
      "STIX-ID": item.stixId ?? "",
      Name: item.name,
      Kategorie: item.category?.parentCategory?.name ?? item.category?.name ?? "",
      Unterkategorie: item.category?.parentCategory ? item.category.name : "",
      Hersteller: item.manufacturer ?? "",
      "Typ/Modell": item.model ?? "",
      Seriennummer: item.serialNumber ?? "",
      "Fahrzeug-Ident.-Nr.": item.vehicleIdentNumber ?? "",
      Kennzeichen: item.licensePlate ?? "",
      Status: statusLabel(item.status),
      Lagerobjekt: bool(item.isStockManaged),
      Einheit: item.stockUnit,
      Anfangsbestand: item.openingStock ?? "",
      "Aktueller Bestand": item.currentStock ?? "",
      Containerobjekt: bool(item.isContainer),
      "Liegt in Container Objekt-ID": item.parentItem?.objectNumber ?? "",
      "Verantwortlich Typ": responsibleTypeLabel(item.responsibleType),
      "Mitarbeiter Vorname": item.responsibleEmployee?.firstName ?? "",
      "Mitarbeiter Nachname": item.responsibleEmployee?.lastName ?? "",
      "Weiterer Mitarbeiter 1 Vorname": additionalEmployees[0]?.firstName ?? "",
      "Weiterer Mitarbeiter 1 Nachname": additionalEmployees[0]?.lastName ?? "",
      "Weiterer Mitarbeiter 2 Vorname": additionalEmployees[1]?.firstName ?? "",
      "Weiterer Mitarbeiter 2 Nachname": additionalEmployees[1]?.lastName ?? "",
      "Weiterer Mitarbeiter 3 Vorname": additionalEmployees[2]?.firstName ?? "",
      "Weiterer Mitarbeiter 3 Nachname": additionalEmployees[2]?.lastName ?? "",
      Kolonne: item.responsibleCrew?.name ?? "",
      "Baustelle Projektnummer": item.currentProject?.projectNumber ?? "",
      "Baujahr/Datum": item.constructionDate ?? "",
      Erstzulassung: item.firstRegistrationDate ?? "",
      "Erhalten am": item.receivedAt ?? "",
      "Gekauft am": item.purchasedAt ?? "",
      "Gekauft bei": item.purchasedFrom ?? "",
      Rechnungsnummer: item.invoiceNumber ?? "",
      Lieferscheinnummer: item.deliveryNoteNumber ?? "",
      Achsen: item.axleCount ?? "",
      "Zul. Gesamtmasse (F1) kg": item.grossWeightKg ?? "",
      "Nutzlast t": item.payloadKg === null ? "" : item.payloadKg / 1000,
      Antrieb: driveTypeLabel(item.driveType),
      Aufnahmetyp: item.attachmentType ?? "",
      "Kraftstofftank l": item.fuelTankLiters ?? "",
      Kraftstoffart: item.fuelTypeLabel ?? "",
      "Arbeitsmitteltank l": item.workMaterialTankLiters ?? "",
      "Verrechnungssatz EUR je Einheit": money(item.billingRateCents),
      "Verrechnungssatz stillgelegt EUR je Einheit": money(
        item.idleBillingRateCents,
      ),
      "Versichert bei": item.insuranceProviderLabel ?? "",
      "Versicherung p.a. netto EUR": money(item.insuranceAnnualPremiumCents),
      "Letzter Service Datum": item.lastServiceAtDate ?? "",
      "Letzter Service H": item.lastServiceOperatingHours ?? "",
      "Letzter Service KM": item.lastServiceMileageKm ?? "",
      "Nächster Service Datum": item.nextServiceAtDate ?? "",
      "Nächster Service H": item.nextServiceOperatingHours ?? "",
      "Nächster Service KM": item.nextServiceMileageKm ?? "",
      "Letzte DGUV": item.lastDguvInspectionDate ?? "",
      "Nächste DGUV": item.nextDguvInspectionDate ?? "",
      "Letzte TÜV": item.lastTuvInspectionDate ?? "",
      "Nächste TÜV": item.nextTuvInspectionDate ?? "",
      "Letzte HU": item.lastHuInspectionDate ?? "",
      "Nächste HU": item.nextHuInspectionDate ?? "",
      "Letzte Tachoprüfung": item.lastTachographInspectionDate ?? "",
      "Nächste Tachoprüfung": item.nextTachographInspectionDate ?? "",
      "Letzte SP": item.lastSafetyInspectionDate ?? "",
      "Nächste SP": item.nextSafetyInspectionDate ?? "",
      "Letzte ADR": item.lastAdrInspectionDate ?? "",
      "Nächste ADR": item.nextAdrInspectionDate ?? "",
      Notizen: item.notes ?? "",
      "Ansprechpartner Firma": contact?.company ?? "",
      "Ansprechpartner Rolle": contact?.role ?? "",
      "Ansprechpartner Anrede": contact?.salutation ?? "",
      "Ansprechpartner Vorname": contact?.firstName ?? "",
      "Ansprechpartner Nachname": contact?.lastName ?? "",
      "Ansprechpartner Telefon": contact?.phone ?? "",
      "Ansprechpartner Mobil": contact?.mobilePhone ?? "",
      "Ansprechpartner E-Mail": contact?.email ?? "",
      "Ansprechpartner Webseite": contact?.website ?? "",
      "Ansprechpartner Notizen": contact?.notes ?? "",
    };
  });

  // Same group-title row + collapsible column groups as the import
  // template (INVENTORY_IMPORT_COLUMN_GROUPS), so an exported-and-edited
  // file matches what you get from "Excel-Vorlage herunterladen".
  const headers: string[] = [...INVENTORY_IMPORT_HEADERS];
  const groupTitleRow: string[] = new Array(headers.length).fill("");
  const groupMerges: { s: { r: number; c: number }; e: { r: number; c: number } }[] =
    [];
  const columnGroupLevelByHeader = new Map<string, number>();
  for (const group of INVENTORY_IMPORT_COLUMN_GROUPS) {
    const fromIndex = headers.indexOf(group.from);
    const toIndex = headers.indexOf(group.to);
    groupTitleRow[fromIndex] = group.label;
    if (toIndex > fromIndex) {
      groupMerges.push({
        e: { c: toIndex, r: 0 },
        s: { c: fromIndex, r: 0 },
      });
    }
    for (let i = fromIndex; i <= toIndex; i += 1) {
      columnGroupLevelByHeader.set(headers[i], 1);
    }
  }

  const dataRows = rows.map((row) =>
    headers.map((header) => (row as Record<string, unknown>)[header] ?? ""),
  );
  const sheet = XLSX.utils.aoa_to_sheet([groupTitleRow, headers, ...dataRows]);
  sheet["!merges"] = groupMerges;
  sheet["!cols"] = headers.map((header) => ({
    level: columnGroupLevelByHeader.get(header) ?? 0,
    wch: Math.max(14, Math.min(32, header.length + 4)),
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Inventarexport");
  const dropdownsRowCount = appendInventoryDropdownSheets(
    workbook,
    dropdownData,
  );

  const rawBuffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "buffer",
  }) as Buffer;
  const validations = inventoryDropdownValidations(headers, dropdownsRowCount);
  const buffer = patchWorkbookDropdowns(rawBuffer, validations, 3);

  const dateStamp = new Date().toISOString().slice(0, 10);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Disposition": `attachment; filename="inventar-export-${dateStamp}.xlsx"`,
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
}
