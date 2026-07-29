"use server";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

const LKW_DRIVER_POSITION_VALUE = "lkw_fahrer_in";
const employeePhotoUploadDirectory = path.join(
  process.cwd(),
  "public",
  "uploads",
  "employee-photos",
);
const allowedEmployeePhotoTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

function optionalString(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function optionalDate(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();

  if (!text) {
    return null;
  }

  return new Date(`${text}T00:00:00.000Z`);
}

async function storeEmployeePhoto(file: FormDataEntryValue | null) {
  if (!(file instanceof File) || file.size === 0) {
    return null;
  }

  const extension = allowedEmployeePhotoTypes.get(file.type);

  if (!extension) {
    throw new Error("Bitte ein Mitarbeiterfoto als JPG, PNG oder WebP hochladen.");
  }

  await mkdir(employeePhotoUploadDirectory, { recursive: true });

  const fileName = `${new Date().toISOString().slice(0, 10)}-${randomUUID()}.${extension}`;
  const absolutePath = path.join(employeePhotoUploadDirectory, fileName);
  const bytes = Buffer.from(await file.arrayBuffer());

  await writeFile(absolutePath, bytes);

  return `/uploads/employee-photos/${fileName}`;
}

function employeePhotoFromFormData(formData: FormData) {
  const cameraPhoto = formData.get("photoCamera");

  if (cameraPhoto instanceof File && cameraPhoto.size > 0) {
    return cameraPhoto;
  }

  return formData.get("photo");
}

async function getOptionLabel(groupKey: string, value: string | null) {
  if (!value) {
    return null;
  }

  const option = await prisma.adminOption.findFirst({
    where: {
      groupKey,
      value,
    },
  });

  return option?.label ?? value;
}

async function getPositionItems(values: string[]) {
  const cleanValues = Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean))
  );

  const options = await prisma.adminOption.findMany({
    where: {
      groupKey: "employee_position",
      value: {
        in: cleanValues,
      },
    },
  });

  return cleanValues.map((value, index) => {
    const option = options.find((item) => item.value === value);

    return {
      positionValue: value,
      positionLabel: option?.label ?? value,
      sortOrder: index,
    };
  });
}

function isActiveEmployee(statusValue: string) {
  return statusValue === "active";
}

async function syncDriverForEmployee({
  tx,
  employeeId,
  driverId,
  firstName,
  lastName,
  phone,
  statusValue,
  positionItems,
}: {
  tx: Prisma.TransactionClient;
  employeeId: string;
  driverId: string | null;
  firstName: string;
  lastName: string;
  phone: string | null;
  statusValue: string;
  positionItems: {
    positionValue: string;
    positionLabel: string;
    sortOrder: number;
  }[];
}) {
  const hasLkwDriverPosition = positionItems.some(
    (position) => position.positionValue === LKW_DRIVER_POSITION_VALUE
  );

  const shouldBeActiveDriver =
    hasLkwDriverPosition && isActiveEmployee(statusValue);

  if (!hasLkwDriverPosition) {
    if (driverId) {
      await tx.driver.update({
        where: {
          id: driverId,
        },
        data: {
          isActive: false,
          notes: "Automatisch deaktiviert, weil Mitarbeiter nicht mehr als LKW Fahrer*in geführt wird.",
        },
      });
    }

    return null;
  }

  if (driverId) {
    await tx.driver.update({
      where: {
        id: driverId,
      },
      data: {
        firstName,
        lastName,
        phone,
        isActive: shouldBeActiveDriver,
        notes: "Automatisch aus Mitarbeiterstamm synchronisiert.",
      },
    });

    return driverId;
  }

  const driver = await tx.driver.create({
    data: {
      firstName,
      lastName,
      phone,
      isActive: shouldBeActiveDriver,
      notes: "Automatisch aus Mitarbeiterstamm erstellt.",
    },
  });

  await tx.employee.update({
    where: {
      id: employeeId,
    },
    data: {
      driverId: driver.id,
    },
  });

  return driver.id;
}

function getEmployeePayload(formData: FormData) {
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();

  if (!firstName) {
    throw new Error("Vorname fehlt.");
  }

  if (!lastName) {
    throw new Error("Nachname fehlt.");
  }

  return {
    statusValue: String(formData.get("statusValue") ?? "active"),
    entryDate: optionalDate(formData.get("entryDate")),
    exitDate: optionalDate(formData.get("exitDate")),
    companyValue: optionalString(formData.get("companyValue")),
    departmentValue: optionalString(formData.get("departmentValue")),
    firstName,
    lastName,
    isLeadership: formData.get("isLeadership") === "on",
    canManagePersonalInventory:
      formData.get("canManagePersonalInventory") === "on",
    birthDate: optionalDate(formData.get("birthDate")),
    genderValue: optionalString(formData.get("genderValue")),
    mobilePhone: optionalString(formData.get("mobilePhone")),
    homePhone: optionalString(formData.get("homePhone")),
    email: optionalString(formData.get("email")),
    emergencyFirstName: optionalString(formData.get("emergencyFirstName")),
    emergencyLastName: optionalString(formData.get("emergencyLastName")),
    emergencyPhone: optionalString(formData.get("emergencyPhone")),
    street: optionalString(formData.get("street")),
    postalCode: optionalString(formData.get("postalCode")),
    city: optionalString(formData.get("city")),
    notes: optionalString(formData.get("notes")),
    positionValues: formData
      .getAll("positionValues")
      .map((value) => String(value)),
  };
}

export async function createEmployee(formData: FormData) {
  const payload = getEmployeePayload(formData);
  const photoUrl = await storeEmployeePhoto(employeePhotoFromFormData(formData));

  const [
    statusLabel,
    companyLabel,
    departmentLabel,
    genderLabel,
    positionItems,
  ] = await Promise.all([
    getOptionLabel("employee_status", payload.statusValue),
    getOptionLabel("employee_company", payload.companyValue),
    getOptionLabel("employee_department", payload.departmentValue),
    getOptionLabel("employee_gender", payload.genderValue),
    getPositionItems(payload.positionValues),
  ]);

  await prisma.$transaction(async (tx) => {
    const employee = await tx.employee.create({
      data: {
        statusValue: payload.statusValue,
        statusLabel: statusLabel ?? payload.statusValue,
        entryDate: payload.entryDate,
        exitDate: payload.exitDate,
        companyValue: payload.companyValue,
        companyLabel,
        departmentValue: payload.departmentValue,
        departmentLabel,
        firstName: payload.firstName,
        lastName: payload.lastName,
        isLeadership: payload.isLeadership,
        canManagePersonalInventory: payload.canManagePersonalInventory,
        birthDate: payload.birthDate,
        genderValue: payload.genderValue,
        genderLabel,
        mobilePhone: payload.mobilePhone,
        homePhone: payload.homePhone,
        email: payload.email,
        emergencyFirstName: payload.emergencyFirstName,
        emergencyLastName: payload.emergencyLastName,
        emergencyPhone: payload.emergencyPhone,
        street: payload.street,
        postalCode: payload.postalCode,
        city: payload.city,
        photoUrl,
        notes: payload.notes,
        positions: {
          create: positionItems,
        },
      },
    });

    await syncDriverForEmployee({
      tx,
      employeeId: employee.id,
      driverId: null,
      firstName: payload.firstName,
      lastName: payload.lastName,
      phone: payload.mobilePhone,
      statusValue: payload.statusValue,
      positionItems,
    });
  });

  revalidatePath("/admin/employees");
  revalidatePath("/employees");
  revalidatePath("/admin/drivers");
}

export async function updateEmployee(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    throw new Error("Mitarbeiter-ID fehlt.");
  }

  const existingEmployee = await prisma.employee.findUnique({
    where: {
      id,
    },
  });

  if (!existingEmployee) {
    throw new Error("Mitarbeiter wurde nicht gefunden.");
  }

  const payload = getEmployeePayload(formData);
  const photoUrl = await storeEmployeePhoto(employeePhotoFromFormData(formData));

  const [
    statusLabel,
    companyLabel,
    departmentLabel,
    genderLabel,
    positionItems,
  ] = await Promise.all([
    getOptionLabel("employee_status", payload.statusValue),
    getOptionLabel("employee_company", payload.companyValue),
    getOptionLabel("employee_department", payload.departmentValue),
    getOptionLabel("employee_gender", payload.genderValue),
    getPositionItems(payload.positionValues),
  ]);

  await prisma.$transaction(async (tx) => {
    await tx.employee.update({
      where: {
        id,
      },
      data: {
        statusValue: payload.statusValue,
        statusLabel: statusLabel ?? payload.statusValue,
        entryDate: payload.entryDate,
        exitDate: payload.exitDate,
        companyValue: payload.companyValue,
        companyLabel,
        departmentValue: payload.departmentValue,
        departmentLabel,
        firstName: payload.firstName,
        lastName: payload.lastName,
        isLeadership: payload.isLeadership,
        canManagePersonalInventory: payload.canManagePersonalInventory,
        birthDate: payload.birthDate,
        genderValue: payload.genderValue,
        genderLabel,
        mobilePhone: payload.mobilePhone,
        homePhone: payload.homePhone,
        email: payload.email,
        emergencyFirstName: payload.emergencyFirstName,
        emergencyLastName: payload.emergencyLastName,
        emergencyPhone: payload.emergencyPhone,
        street: payload.street,
        postalCode: payload.postalCode,
        city: payload.city,
        ...(photoUrl ? { photoUrl } : {}),
        notes: payload.notes,
      },
    });

    await tx.employeePositionAssignment.deleteMany({
      where: {
        employeeId: id,
      },
    });

    await tx.employeePositionAssignment.createMany({
      data: positionItems.map((position) => ({
        ...position,
        employeeId: id,
      })),
    });

    await syncDriverForEmployee({
      tx,
      employeeId: id,
      driverId: existingEmployee.driverId,
      firstName: payload.firstName,
      lastName: payload.lastName,
      phone: payload.mobilePhone,
      statusValue: payload.statusValue,
      positionItems,
    });
  });

  revalidatePath("/admin/employees");
  revalidatePath("/employees");
  revalidatePath("/admin/drivers");
}

export async function deleteEmployee(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    throw new Error("Mitarbeiter-ID fehlt.");
  }

  const employee = await prisma.employee.findUnique({
    where: {
      id,
    },
  });

  await prisma.$transaction(async (tx) => {
    await tx.employee.delete({
      where: {
        id,
      },
    });

    if (employee?.driverId) {
      await tx.driver.update({
        where: {
          id: employee.driverId,
        },
        data: {
          isActive: false,
          notes: "Automatisch deaktiviert, weil Mitarbeiter gelöscht wurde.",
        },
      });
    }
  });

  revalidatePath("/admin/employees");
  revalidatePath("/employees");
  revalidatePath("/admin/drivers");
}
