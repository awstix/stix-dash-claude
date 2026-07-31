"use server";

import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-access";

function text(formData: FormData, name: string, maxLength = 300) {
  const value = String(formData.get(name) ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();
  return value.slice(0, maxLength);
}

function optional(value: string) {
  return value || null;
}

export async function saveCompanyInfo(formData: FormData) {
  await requireAdmin();
  const companyName = text(formData, "companyName", 160);

  if (!companyName) {
    throw new Error("Firmenname ist ein Pflichtfeld.");
  }

  const existing = await prisma.companyInfo.findUnique({
    where: { id: "default" },
  });
  const logo = formData.get("logo");
  let logoPublicUrl = existing?.logoPublicUrl ?? null;
  let logoStoragePath = existing?.logoStoragePath ?? null;

  if (logo instanceof File && logo.size > 0) {
    const allowedLogoTypes = new Set([
      "image/png",
      "image/svg+xml",
      "image/webp",
    ]);
    if (!allowedLogoTypes.has(logo.type)) {
      throw new Error(
        "Bitte ein freigestelltes Logo als PNG, SVG oder WebP hochladen. JPG unterstützt keinen transparenten Hintergrund.",
      );
    }
    if (logo.size > 15 * 1024 * 1024) {
      throw new Error("Das Firmenlogo darf höchstens 15 MB groß sein.");
    }
    const sourceBuffer = Buffer.from(await logo.arrayBuffer());
    const metadata = await sharp(sourceBuffer).metadata();
    if (metadata.format !== "svg" && !metadata.hasAlpha) {
      throw new Error(
        "Das gewählte Logo besitzt keinen transparenten Hintergrund. Bitte eine freigestellte PNG-, SVG- oder WebP-Datei verwenden.",
      );
    }

    const targetDirectory = path.join(
      process.cwd(),
      "public",
      "uploads",
      "company",
    );
    await mkdir(targetDirectory, { recursive: true });
    const fileName = `logo-${randomUUID()}.png`;
    const absolutePath = path.join(targetDirectory, fileName);
    const buffer = await sharp(sourceBuffer)
      .rotate()
      .resize({
        fit: "inside",
        height: 700,
        width: 1600,
        withoutEnlargement: true,
      })
      .png()
      .toBuffer();
    await writeFile(absolutePath, buffer);
    logoPublicUrl = `/uploads/company/${fileName}`;
    logoStoragePath = path.join("public", "uploads", "company", fileName);

    if (existing?.logoStoragePath) {
      await unlink(path.resolve(process.cwd(), existing.logoStoragePath)).catch(
        () => undefined,
      );
    }
  } else if (formData.get("removeLogo") === "on") {
    if (existing?.logoStoragePath) {
      await unlink(path.resolve(process.cwd(), existing.logoStoragePath)).catch(
        () => undefined,
      );
    }
    logoPublicUrl = null;
    logoStoragePath = null;
  }

  await prisma.companyInfo.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      city: optional(text(formData, "city", 120)),
      companyName,
      country: optional(text(formData, "country", 120)),
      email: optional(text(formData, "email", 180)),
      facebookUrl: optional(text(formData, "facebookUrl", 300)),
      instagramUrl: optional(text(formData, "instagramUrl", 300)),
      legalName: optional(text(formData, "legalName", 180)),
      linkedinUrl: optional(text(formData, "linkedinUrl", 300)),
      logoPublicUrl,
      logoStoragePath,
      managingDirector: optional(text(formData, "managingDirector", 180)),
      mobile: optional(text(formData, "mobile", 80)),
      phone: optional(text(formData, "phone", 80)),
      postalCode: optional(text(formData, "postalCode", 30)),
      registryCourt: optional(text(formData, "registryCourt", 120)),
      registryNumber: optional(text(formData, "registryNumber", 80)),
      street: optional(text(formData, "street", 180)),
      taxNumber: optional(text(formData, "taxNumber", 80)),
      tiktokUrl: optional(text(formData, "tiktokUrl", 300)),
      vatId: optional(text(formData, "vatId", 80)),
      website: optional(text(formData, "website", 240)),
      youtubeUrl: optional(text(formData, "youtubeUrl", 300)),
    },
    update: {
      city: optional(text(formData, "city", 120)),
      companyName,
      country: optional(text(formData, "country", 120)),
      email: optional(text(formData, "email", 180)),
      facebookUrl: optional(text(formData, "facebookUrl", 300)),
      instagramUrl: optional(text(formData, "instagramUrl", 300)),
      legalName: optional(text(formData, "legalName", 180)),
      linkedinUrl: optional(text(formData, "linkedinUrl", 300)),
      logoPublicUrl,
      logoStoragePath,
      managingDirector: optional(text(formData, "managingDirector", 180)),
      mobile: optional(text(formData, "mobile", 80)),
      phone: optional(text(formData, "phone", 80)),
      postalCode: optional(text(formData, "postalCode", 30)),
      registryCourt: optional(text(formData, "registryCourt", 120)),
      registryNumber: optional(text(formData, "registryNumber", 80)),
      street: optional(text(formData, "street", 180)),
      taxNumber: optional(text(formData, "taxNumber", 80)),
      tiktokUrl: optional(text(formData, "tiktokUrl", 300)),
      vatId: optional(text(formData, "vatId", 80)),
      website: optional(text(formData, "website", 240)),
      youtubeUrl: optional(text(formData, "youtubeUrl", 300)),
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/company-info");
  revalidatePath("/projects/formulare");
  revalidatePath("/projects");
}
