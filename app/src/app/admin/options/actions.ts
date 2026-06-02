"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

const defaultOptions = [
  // Mitarbeiter-Status
  {
    groupKey: "employee_status",
    value: "active",
    label: "Aktiv",
    sortOrder: 10,
  },
  {
    groupKey: "employee_status",
    value: "inactive",
    label: "Inaktiv",
    sortOrder: 20,
  },
  {
    groupKey: "employee_status",
    value: "left",
    label: "Ausgetreten",
    sortOrder: 30,
  },

  // Firmen
  {
    groupKey: "employee_company",
    value: "stix",
    label: "Stix",
    sortOrder: 10,
  },

  // Abteilungen
  {
    groupKey: "employee_department",
    value: "buero",
    label: "Büro",
    sortOrder: 10,
  },
  {
    groupKey: "employee_department",
    value: "tiefbau",
    label: "Tiefbau",
    sortOrder: 20,
  },
  {
    groupKey: "employee_department",
    value: "fuhrpark",
    label: "Fuhrpark / LKW",
    sortOrder: 30,
  },
  {
    groupKey: "employee_department",
    value: "werkstatt",
    label: "Werkstatt",
    sortOrder: 40,
  },
  {
    groupKey: "employee_department",
    value: "immobilien",
    label: "Immobilien",
    sortOrder: 50,
  },

  // Geschlecht
  {
    groupKey: "employee_gender",
    value: "female",
    label: "weiblich",
    sortOrder: 10,
  },
  {
    groupKey: "employee_gender",
    value: "male",
    label: "männlich",
    sortOrder: 20,
  },
  {
    groupKey: "employee_gender",
    value: "diverse",
    label: "divers",
    sortOrder: 30,
  },
  {
    groupKey: "employee_gender",
    value: "not_specified",
    label: "keine Angabe",
    sortOrder: 40,
  },

  // Berufsgruppen
  {
    groupKey: "employee_position",
    value: "buero_abrechnung",
    label: "Büro Abrechnung",
    sortOrder: 10,
  },
  {
    groupKey: "employee_position",
    value: "azubi_tiefbaufacharbeiter_in",
    label: "Azubi Tiefbaufacharbeiter*in",
    sortOrder: 20,
  },
  {
    groupKey: "employee_position",
    value: "bauhelfer_in",
    label: "Bauhelfer*in",
    sortOrder: 30,
  },
  {
    groupKey: "employee_position",
    value: "buero_bauleiter_in",
    label: "Büro Bauleiter*in",
    sortOrder: 40,
  },
  {
    groupKey: "employee_position",
    value: "buero_bauzeichner_in",
    label: "Büro Bauzeichner*in",
    sortOrder: 50,
  },
  {
    groupKey: "employee_position",
    value: "buero_buchhaltung_buerofachkraft",
    label: "Büro Buchhaltung / Bürofachkraft",
    sortOrder: 60,
  },
  {
    groupKey: "employee_position",
    value: "chef_in",
    label: "Chef*in",
    sortOrder: 70,
  },
  {
    groupKey: "employee_position",
    value: "disponent_in",
    label: "Disponent*in",
    sortOrder: 80,
  },
  {
    groupKey: "employee_position",
    value: "buero_dualer_student_in",
    label: "Büro Duale*r Student*in",
    sortOrder: 90,
  },
  {
    groupKey: "employee_position",
    value: "facharbeiter_in",
    label: "Facharbeiter*in",
    sortOrder: 100,
  },
  {
    groupKey: "employee_position",
    value: "immobilien",
    label: "Immobilien",
    sortOrder: 110,
  },
  {
    groupKey: "employee_position",
    value: "kanalfacharbeiter_in",
    label: "Kanalfacharbeiter*in",
    sortOrder: 120,
  },
  {
    groupKey: "employee_position",
    value: "buero_buchhaltung",
    label: "Büro Buchhaltung",
    sortOrder: 130,
  },
  {
    groupKey: "employee_position",
    value: "buero_kalkulation",
    label: "Büro Kalkulation",
    sortOrder: 140,
  },
  {
    groupKey: "employee_position",
    value: "buero_personal",
    label: "Büro Personal",
    sortOrder: 150,
  },
  {
    groupKey: "employee_position",
    value: "werkstatt",
    label: "Werkstatt",
    sortOrder: 160,
  },
  {
    groupKey: "employee_position",
    value: "lkw_fahrer_in",
    label: "LKW Fahrer*in",
    sortOrder: 170,
  },
  {
    groupKey: "employee_position",
    value: "maschinist_in",
    label: "Maschinist*in",
    sortOrder: 180,
  },
  {
    groupKey: "employee_position",
    value: "strassenbauer_in",
    label: "Straßenbauer*in",
    sortOrder: 190,
  },
  {
    groupKey: "employee_position",
    value: "strassenbau_vorarbeiter_in",
    label: "Straßenbau Vorarbeiter*in",
    sortOrder: 200,
  },
  {
    groupKey: "employee_position",
    value: "buero_technische_leitung",
    label: "Büro Technische Leitung",
    sortOrder: 210,
  },
  {
    groupKey: "employee_position",
    value: "vermessungstechniker_in",
    label: "Vermessungstechniker*in",
    sortOrder: 220,
  },
  {
    groupKey: "employee_position",
    value: "vorarbeiter_in",
    label: "Vorarbeiter*in",
    sortOrder: 230,
  },
  {
    groupKey: "employee_position",
    value: "werkstatt_metallbau",
    label: "Werkstatt Metallbau",
    sortOrder: 240,
  },

  // Kolonnen
  {
    groupKey: "crew_type",
    value: "strassenbau",
    label: "Straßenbau",
    sortOrder: 10,
  },
  {
    groupKey: "crew_type",
    value: "kanalbau",
    label: "Kanalbau",
    sortOrder: 20,
  },
  {
    groupKey: "crew_type",
    value: "asphaltbau",
    label: "Asphaltbau",
    sortOrder: 30,
  },
  {
    groupKey: "crew_type",
    value: "wasserleitungsbau",
    label: "Wasserleitungsbau",
    sortOrder: 40,
  },

  // Fahrzeuge
  {
    groupKey: "vehicle_type",
    value: "PKW",
    label: "PKW",
    sortOrder: 10,
  },
  {
    groupKey: "vehicle_type",
    value: "Transporter",
    label: "Transporter",
    sortOrder: 20,
  },
  {
    groupKey: "vehicle_type",
    value: "LKW",
    label: "LKW",
    sortOrder: 30,
  },
  {
    groupKey: "vehicle_type",
    value: "Baumaschine",
    label: "Baumaschine",
    sortOrder: 40,
  },
  {
    groupKey: "vehicle_type",
    value: "Anhänger",
    label: "Anhänger",
    sortOrder: 50,
  },
  {
    groupKey: "vehicle_type",
    value: "Sonderfahrzeug",
    label: "Sonderfahrzeug",
    sortOrder: 60,
  },
  {
    groupKey: "vehicle_type",
    value: "Sonstiges",
    label: "Sonstiges",
    sortOrder: 70,
  },

  {
    groupKey: "vehicle_category",
    value: "2-Achser",
    label: "2-Achser",
    sortOrder: 10,
  },
  {
    groupKey: "vehicle_category",
    value: "3-Achser",
    label: "3-Achser",
    sortOrder: 20,
  },
  {
    groupKey: "vehicle_category",
    value: "3-Achser + Anhänger",
    label: "3-Achser + Anhänger",
    sortOrder: 30,
  },
  {
    groupKey: "vehicle_category",
    value: "4-Achser",
    label: "4-Achser",
    sortOrder: 40,
  },
  {
    groupKey: "vehicle_category",
    value: "Sattelzug",
    label: "Sattelzug",
    sortOrder: 50,
  },
  {
    groupKey: "vehicle_category",
    value: "Kranwagen",
    label: "Kranwagen",
    sortOrder: 60,
  },
  {
    groupKey: "vehicle_category",
    value: "Tieflader",
    label: "Tieflader",
    sortOrder: 70,
  },
  {
    groupKey: "vehicle_category",
    value: "Unimog mit Asphaltfräse",
    label: "Unimog mit Asphaltfräse",
    sortOrder: 80,
  },
  {
    groupKey: "vehicle_category",
    value: "Abroller",
    label: "Abroller",
    sortOrder: 90,
  },
  {
    groupKey: "vehicle_category",
    value: "Sonstiges",
    label: "Sonstiges",
    sortOrder: 100,
  },

  // Nachunternehmer
  {
    groupKey: "subcontractor_company",
    value: "mueller_transporte",
    label: "Müller Transporte",
    sortOrder: 10,
  },
  {
    groupKey: "subcontractor_company",
    value: "schmitt_bau",
    label: "Schmitt Bau",
    sortOrder: 20,
  },

  // Material / Transport
  {
    groupKey: "transport_item",
    value: "maschine",
    label: "Maschine transportieren",
    sortOrder: 10,
  },
  {
    groupKey: "transport_item",
    value: "geraete",
    label: "Geräte transportieren",
    sortOrder: 20,
  },
  {
    groupKey: "transport_item",
    value: "anhaenger",
    label: "Anhänger umsetzen",
    sortOrder: 30,
  },
  {
    groupKey: "transport_item",
    value: "container",
    label: "Container / Abroller",
    sortOrder: 40,
  },
  {
    groupKey: "transport_item",
    value: "rueckladung",
    label: "Rückladung",
    sortOrder: 50,
  },

  {
    groupKey: "material_category",
    value: "Asphalt",
    label: "Asphalt",
    sortOrder: 10,
  },
  {
    groupKey: "material_category",
    value: "Schotter",
    label: "Schotter",
    sortOrder: 20,
  },
  {
    groupKey: "material_category",
    value: "Frostschutz",
    label: "Frostschutz",
    sortOrder: 30,
  },
  {
    groupKey: "material_category",
    value: "Sand",
    label: "Sand",
    sortOrder: 40,
  },
  {
    groupKey: "material_category",
    value: "Splitt",
    label: "Splitt",
    sortOrder: 50,
  },
  {
    groupKey: "material_category",
    value: "Recycling",
    label: "Recycling",
    sortOrder: 60,
  },
  {
    groupKey: "material_category",
    value: "Aushub",
    label: "Aushub",
    sortOrder: 70,
  },
  {
    groupKey: "material_category",
    value: "Beton",
    label: "Beton",
    sortOrder: 80,
  },
  {
    groupKey: "material_category",
    value: "Sonstiges",
    label: "Sonstiges",
    sortOrder: 90,
  },

  {
    groupKey: "material_unit",
    value: "t",
    label: "t",
    sortOrder: 10,
  },
  {
    groupKey: "material_unit",
    value: "m³",
    label: "m³",
    sortOrder: 20,
  },
  {
    groupKey: "material_unit",
    value: "Stück",
    label: "Stück",
    sortOrder: 30,
  },

  {
    groupKey: "quantity_unit",
    value: "t",
    label: "t",
    sortOrder: 10,
  },
  {
    groupKey: "quantity_unit",
    value: "m³",
    label: "m³",
    sortOrder: 20,
  },
  {
    groupKey: "quantity_unit",
    value: "Stk",
    label: "Stk",
    sortOrder: 30,
  },
  {
    groupKey: "quantity_unit",
    value: "h",
    label: "h",
    sortOrder: 40,
  },
  {
    groupKey: "quantity_unit",
    value: "km",
    label: "km",
    sortOrder: 50,
  },

  // Asphalt
  {
    groupKey: "asphalt_crew",
    value: "Stürmer",
    label: "Stürmer",
    sortOrder: 10,
  },
  {
    groupKey: "asphalt_crew",
    value: "Becker",
    label: "Becker",
    sortOrder: 20,
  },
  {
    groupKey: "asphalt_unit",
    value: "t",
    label: "t",
    sortOrder: 10,
  },
  {
    groupKey: "asphalt_category",
    value: "Asphalttragschicht",
    label: "Asphalttragschicht",
    sortOrder: 10,
  },
  {
    groupKey: "asphalt_category",
    value: "Asphaltbinderschicht",
    label: "Asphaltbinderschicht",
    sortOrder: 20,
  },
  {
    groupKey: "asphalt_category",
    value: "Asphaltdeckschicht",
    label: "Asphaltdeckschicht",
    sortOrder: 30,
  },
  {
    groupKey: "asphalt_category",
    value: "Gussasphalt",
    label: "Gussasphalt",
    sortOrder: 40,
  },
  {
    groupKey: "asphalt_category",
    value: "Sondermischgut",
    label: "Sondermischgut",
    sortOrder: 50,
  },
  {
    groupKey: "asphalt_category",
    value: "Sonstiges",
    label: "Sonstiges",
    sortOrder: 60,
  },
  {
    groupKey: "asphalt_plant",
    value: "Eigene Mischanlage",
    label: "Eigene Mischanlage",
    sortOrder: 10,
  },
  {
    groupKey: "asphalt_plant",
    value: "Fremdmischgut",
    label: "Fremdmischgut",
    sortOrder: 20,
  },
  {
    groupKey: "asphalt_plant",
    value: "Sonstiges",
    label: "Sonstiges",
    sortOrder: 30,
  },

  // Beton
  {
    groupKey: "concrete_unit",
    value: "m³",
    label: "m³",
    sortOrder: 10,
  },
  {
    groupKey: "concrete_unit",
    value: "t",
    label: "t",
    sortOrder: 20,
  },
  {
    groupKey: "concrete_strength_class",
    value: "C 12/15",
    label: "C 12/15",
    sortOrder: 10,
  },
  {
    groupKey: "concrete_strength_class",
    value: "C 20/25",
    label: "C 20/25",
    sortOrder: 20,
  },
  {
    groupKey: "concrete_strength_class",
    value: "C 25/30",
    label: "C 25/30",
    sortOrder: 30,
  },
  {
    groupKey: "concrete_strength_class",
    value: "C 30/37",
    label: "C 30/37",
    sortOrder: 40,
  },
  {
    groupKey: "concrete_strength_class",
    value: "Sonstiges",
    label: "Sonstiges",
    sortOrder: 50,
  },
  {
    groupKey: "concrete_exposure_class",
    value: "XC1",
    label: "XC1",
    sortOrder: 10,
  },
  {
    groupKey: "concrete_exposure_class",
    value: "XC2",
    label: "XC2",
    sortOrder: 20,
  },
  {
    groupKey: "concrete_exposure_class",
    value: "XC3",
    label: "XC3",
    sortOrder: 30,
  },
  {
    groupKey: "concrete_exposure_class",
    value: "XC4",
    label: "XC4",
    sortOrder: 40,
  },
  {
    groupKey: "concrete_exposure_class",
    value: "XF1",
    label: "XF1",
    sortOrder: 50,
  },
  {
    groupKey: "concrete_exposure_class",
    value: "XF2",
    label: "XF2",
    sortOrder: 60,
  },
  {
    groupKey: "concrete_exposure_class",
    value: "XF3",
    label: "XF3",
    sortOrder: 70,
  },
  {
    groupKey: "concrete_exposure_class",
    value: "XF4",
    label: "XF4",
    sortOrder: 80,
  },
  {
    groupKey: "concrete_consistency",
    value: "F1",
    label: "F1",
    sortOrder: 10,
  },
  {
    groupKey: "concrete_consistency",
    value: "F2",
    label: "F2",
    sortOrder: 20,
  },
  {
    groupKey: "concrete_consistency",
    value: "F3",
    label: "F3",
    sortOrder: 30,
  },
  {
    groupKey: "concrete_consistency",
    value: "F4",
    label: "F4",
    sortOrder: 40,
  },
  {
    groupKey: "concrete_consistency",
    value: "F5",
    label: "F5",
    sortOrder: 50,
  },
  {
    groupKey: "concrete_aggregate",
    value: "0/8",
    label: "0/8",
    sortOrder: 10,
  },
  {
    groupKey: "concrete_aggregate",
    value: "0/16",
    label: "0/16",
    sortOrder: 20,
  },
  {
    groupKey: "concrete_aggregate",
    value: "0/32",
    label: "0/32",
    sortOrder: 30,
  },
];

function normalize(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function slugify(label: string) {
  return label
    .trim()
    .toLowerCase()
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("ß", "ss")
    .replaceAll("*", "")
    .replaceAll("/", "_")
    .replaceAll("-", "_")
    .replaceAll(" ", "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function revalidateOptionConsumers() {
  revalidatePath("/admin/options");
  revalidatePath("/admin/employees");
  revalidatePath("/admin/drivers");
  revalidatePath("/admin/vehicles");
  revalidatePath("/admin/materials");
  revalidatePath("/admin/asphalt-types");
  revalidatePath("/admin/concrete-types");
  revalidatePath("/admin/crews");
  revalidatePath("/asphalt-dispatch");
  revalidatePath("/truck-dispatch");
  revalidatePath("/truck-dispatch/long-haul");
  revalidatePath("/truck-dispatch/short-haul");
  revalidatePath("/crew-dispatch");
}

export async function seedDefaultOptions() {
  for (const option of defaultOptions) {
    await prisma.adminOption.upsert({
      where: {
        groupKey_value: {
          groupKey: option.groupKey,
          value: option.value,
        },
      },
      update: {
        label: option.label,
        sortOrder: option.sortOrder,
        isActive: true,
      },
      create: {
        groupKey: option.groupKey,
        value: option.value,
        label: option.label,
        sortOrder: option.sortOrder,
        isActive: true,
      },
    });
  }

  await prisma.adminOption.updateMany({
    where: {
      groupKey: "employee_company",
      value: {
        not: "stix",
      },
    },
    data: {
      isActive: false,
    },
  });

  revalidateOptionConsumers();
}

export async function createAdminOption(formData: FormData) {
  const groupKey = normalize(formData.get("groupKey"));
  const label = normalize(formData.get("label"));
  const valueInput = normalize(formData.get("value"));
  const sortOrderInput = normalize(formData.get("sortOrder"));
  const sortOrder = Number(sortOrderInput);

  if (!groupKey || !label) {
    throw new Error("Gruppe und Bezeichnung sind Pflichtfelder.");
  }

  const value = valueInput || slugify(label);

  if (!value) {
    throw new Error("Interner Wert konnte nicht erzeugt werden.");
  }

  await prisma.adminOption.create({
    data: {
      groupKey,
      value,
      label,
      sortOrder:
        sortOrderInput && !Number.isNaN(sortOrder) ? sortOrder : 9999,
      isActive: true,
    },
  });

  revalidateOptionConsumers();
}

export async function updateAdminOption(formData: FormData) {
  const id = normalize(formData.get("id"));
  const label = normalize(formData.get("label"));

  if (!id || !label) {
    throw new Error("ID und Bezeichnung sind Pflichtfelder.");
  }

  await prisma.adminOption.update({
    where: {
      id,
    },
    data: {
      label,
      isActive: formData.get("isActive") === "on",
    },
  });

  revalidateOptionConsumers();
}

export async function deleteAdminOption(formData: FormData) {
  const id = normalize(formData.get("id"));

  if (!id) {
    throw new Error("ID fehlt.");
  }

  await prisma.adminOption.delete({
    where: {
      id,
    },
  });

  revalidateOptionConsumers();
}

export async function sortAdminOptionsAlphabetically(formData: FormData) {
  const groupKey = normalize(formData.get("groupKey"));

  if (!groupKey) {
    throw new Error("Gruppe fehlt.");
  }

  const options = await prisma.adminOption.findMany({
    where: {
      groupKey,
    },
    orderBy: [{ label: "asc" }],
  });

  for (const [index, option] of options.entries()) {
    await prisma.adminOption.update({
      where: {
        id: option.id,
      },
      data: {
        sortOrder: (index + 1) * 10,
      },
    });
  }

  revalidateOptionConsumers();
}

export async function sortAdminOptionsByPosition(formData: FormData) {
  const groupKey = normalize(formData.get("groupKey"));

  if (!groupKey) {
    throw new Error("Gruppe fehlt.");
  }

  const options = await prisma.adminOption.findMany({
    where: {
      groupKey,
    },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });

  for (const [index, option] of options.entries()) {
    await prisma.adminOption.update({
      where: {
        id: option.id,
      },
      data: {
        sortOrder: (index + 1) * 10,
      },
    });
  }

  revalidateOptionConsumers();
}

export async function saveAdminOptionSortOrder(formData: FormData) {
  const optionIds = formData.getAll("optionIds").map((value) => String(value));

  for (const id of optionIds) {
    const sortOrderValue = normalize(formData.get(`sortOrder_${id}`));
    const sortOrder = Number(sortOrderValue);

    await prisma.adminOption.update({
      where: {
        id,
      },
      data: {
        sortOrder: Number.isNaN(sortOrder) ? 0 : sortOrder,
      },
    });
  }

  revalidateOptionConsumers();
}