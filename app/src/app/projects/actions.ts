"use server";

import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { access, mkdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { ProjectStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ProjectFormInput = {
  id?: string;
  projectNumber: string;
  name: string;
  constructionManager: string;
  plannedStart: string;
  plannedEnd: string;
  actualStart: string;
  actualEnd: string;
  status: ProjectStatus;
  contractValueNet: number;
  changeOrdersNet: number;
  progressPercent: number;
  paymentsNet: number;
  notes: string;
};

export type ProjectMapInput = {
  id: string;
  siteAddress: string;
  mapLatitude: string;
  mapLongitude: string;
  mapZoom: string;
  siteBoundaryGeoJson: string;
};

export type ProjectDailyReportWeatherInput = {
  projectId: string;
  reportDate: string;
  weatherCategory: string;
  weatherNotes: string;
  weatherTempMaxC: string;
  weatherTempMinC: string;
};

export type ProjectPhotoUpdateInput = {
  availableForDailyReports: boolean;
  id: string;
  notes: string;
};

export type ProjectPhotosMoveInput = {
  photoIds: string[];
  targetProjectId: string;
};

type PhotoGpsAddress = {
  gpsAddressJson: string | null;
  gpsAddressLabel: string | null;
  gpsCity: string | null;
  gpsCountry: string | null;
  gpsHouseNumber: string | null;
  gpsPostcode: string | null;
  gpsReverseGeocodeSource: string | null;
  gpsReverseGeocodedAt: Date | null;
  gpsStreet: string | null;
};

type NominatimReverseResponse = {
  address?: Record<string, string | undefined>;
  display_name?: string;
  error?: string;
};

type OpenMeteoForecast = {
  current?: {
    precipitation?: number;
    temperature_2m?: number;
    time?: string;
    weather_code?: number;
    wind_speed_10m?: number;
  };
  daily?: {
    precipitation_probability_max?: Array<number | null>;
    precipitation_sum?: Array<number | null>;
    temperature_2m_max?: Array<number | null>;
    temperature_2m_min?: Array<number | null>;
    time?: string[];
    weather_code?: Array<number | null>;
    wind_speed_10m_max?: Array<number | null>;
  };
};

const geocoderUserAgent =
  process.env.STIX_DASH_GEOCODER_USER_AGENT ??
  "stix-dash/0.1 project-photo-gps-address";
const photoGpsAddressCache = new Map<string, PhotoGpsAddress | null>();
let lastReverseGeocodeRequestAt = 0;

function parseDate(value: string) {
  if (!value) return null;
  return new Date(value);
}

function cleanNumber(value: number) {
  if (Number.isNaN(value)) return 0;
  return value;
}

function cleanOptionalFloat(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanOptionalInt(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function cleanBoundaryGeoJson(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  try {
    JSON.parse(trimmed);
  } catch {
    throw new Error("Baufeld GeoJSON ist kein gültiges JSON.");
  }

  return trimmed;
}

function revalidateProjectViews(projectId?: string) {
  revalidatePath("/projects");
  revalidatePath("/projects/performance");
  if (projectId) {
    revalidatePath(`/projects/${projectId}`);
  }
}

function revalidateProjectPhotoViews(projectId?: string) {
  revalidateProjectViews(projectId);
  revalidatePath("/projects/fotos");
  revalidatePath("/projects/bautagesberichte");
}

export async function createProject(input: ProjectFormInput) {
  if (!input.projectNumber || !input.name) {
    throw new Error("Projektnummer und Projektname sind Pflichtfelder.");
  }

  await prisma.project.create({
    data: {
      projectNumber: input.projectNumber,
      name: input.name,
      constructionManager: input.constructionManager || null,
      plannedStart: parseDate(input.plannedStart),
      plannedEnd: parseDate(input.plannedEnd),
      actualStart: parseDate(input.actualStart),
      actualEnd: parseDate(input.actualEnd),
      status: input.status,
      contractValueNet: cleanNumber(input.contractValueNet),
      changeOrdersNet: cleanNumber(input.changeOrdersNet),
      progressPercent: cleanNumber(input.progressPercent),
      paymentsNet: cleanNumber(input.paymentsNet),
      notes: input.notes || null,
    },
  });

  revalidateProjectViews();
}

export async function updateProject(input: ProjectFormInput) {
  if (!input.id) {
    throw new Error("Projekt-ID fehlt.");
  }

  if (!input.projectNumber || !input.name) {
    throw new Error("Projektnummer und Projektname sind Pflichtfelder.");
  }

  await prisma.project.update({
    where: {
      id: input.id,
    },
    data: {
      projectNumber: input.projectNumber,
      name: input.name,
      constructionManager: input.constructionManager || null,
      plannedStart: parseDate(input.plannedStart),
      plannedEnd: parseDate(input.plannedEnd),
      actualStart: parseDate(input.actualStart),
      actualEnd: parseDate(input.actualEnd),
      status: input.status,
      contractValueNet: cleanNumber(input.contractValueNet),
      changeOrdersNet: cleanNumber(input.changeOrdersNet),
      progressPercent: cleanNumber(input.progressPercent),
      paymentsNet: cleanNumber(input.paymentsNet),
      notes: input.notes || null,
    },
  });

  revalidateProjectViews(input.id);
}

export async function updateProjectMap(input: ProjectMapInput) {
  if (!input.id) {
    throw new Error("Projekt-ID fehlt.");
  }

  await prisma.project.update({
    where: {
      id: input.id,
    },
    data: {
      siteAddress: input.siteAddress || null,
      mapLatitude: cleanOptionalFloat(input.mapLatitude),
      mapLongitude: cleanOptionalFloat(input.mapLongitude),
      mapZoom: cleanOptionalInt(input.mapZoom),
      siteBoundaryGeoJson: cleanBoundaryGeoJson(input.siteBoundaryGeoJson),
    },
  });

  revalidateProjectViews(input.id);
}

export async function refreshProjectWeather(projectId: string) {
  const project = await prisma.project.findUnique({
    where: {
      id: projectId,
    },
    select: {
      id: true,
      mapLatitude: true,
      mapLongitude: true,
    },
  });

  if (!project) {
    throw new Error("Projekt wurde nicht gefunden.");
  }

  if (project.mapLatitude === null || project.mapLongitude === null) {
    throw new Error("Für die Wetterabfrage fehlen Koordinaten im Kartenausschnitt.");
  }

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", project.mapLatitude.toString());
  url.searchParams.set("longitude", project.mapLongitude.toString());
  url.searchParams.set(
    "current",
    "temperature_2m,precipitation,weather_code,wind_speed_10m",
  );
  url.searchParams.set(
    "daily",
    [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_sum",
      "precipitation_probability_max",
      "wind_speed_10m_max",
    ].join(","),
  );
  url.searchParams.set("forecast_days", "16");
  url.searchParams.set("timezone", "Europe/Berlin");

  const response = await fetch(url.toString(), {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Wetterdaten konnten nicht geladen werden.");
  }

  const forecast = (await response.json()) as OpenMeteoForecast;
  const dates = forecast.daily?.time ?? [];

  if (dates.length === 0) {
    throw new Error("Wetterdienst hat keine Tagesprognose geliefert.");
  }

  const now = new Date();

  for (const [index, date] of dates.entries()) {
    const weatherDate = toWeatherDate(date);
    const weatherCode = toNullableInteger(forecast.daily?.weather_code?.[index]);
    const tempMinC = toNullableNumber(forecast.daily?.temperature_2m_min?.[index]);
    const tempMaxC = toNullableNumber(forecast.daily?.temperature_2m_max?.[index]);
    const precipitationMm =
      toNullableNumber(forecast.daily?.precipitation_sum?.[index]) ?? 0;
    const precipitationProbabilityMax = toNullableInteger(
      forecast.daily?.precipitation_probability_max?.[index],
    );
    const windSpeedMaxKmh = toNullableNumber(
      forecast.daily?.wind_speed_10m_max?.[index],
    );
    const weatherLabel = getWeatherCodeLabel(weatherCode);
    const weatherCategory = weatherLabel;
    const currentData =
      index === 0
        ? {
            currentPrecipitationMm:
              toNullableNumber(forecast.current?.precipitation) ?? null,
            currentTemperatureC:
              toNullableNumber(forecast.current?.temperature_2m) ?? null,
            currentWeatherCode: toNullableInteger(forecast.current?.weather_code),
            currentWeatherLabel: getWeatherCodeLabel(
              toNullableInteger(forecast.current?.weather_code),
            ),
            currentWindSpeedKmh:
              toNullableNumber(forecast.current?.wind_speed_10m) ?? null,
            observedAt: forecast.current?.time
              ? new Date(forecast.current.time)
              : now,
          }
        : {
            currentPrecipitationMm: null,
            currentTemperatureC: null,
            currentWeatherCode: null,
            currentWeatherLabel: null,
            currentWindSpeedKmh: null,
            observedAt: null,
          };

    await prisma.projectWeatherLog.upsert({
      where: {
        projectId_weatherDate: {
          projectId,
          weatherDate,
        },
      },
      create: {
        projectId,
        weatherDate,
        tempMinC,
        tempMaxC,
        precipitationMm,
        precipitationProbabilityMax,
        windSpeedMaxKmh,
        weatherCode,
        weatherLabel,
        weatherCategory,
        weatherCategorySource: "AUTO",
        fetchedAt: now,
        ...currentData,
      },
      update: {
        tempMinC,
        tempMaxC,
        precipitationMm,
        precipitationProbabilityMax,
        windSpeedMaxKmh,
        weatherCode,
        weatherLabel,
        weatherCategory,
        weatherCategorySource: "AUTO",
        fetchedAt: now,
        ...currentData,
      },
    });
  }

  revalidateProjectViews(projectId);
}

export async function saveProjectDailyReportWeather(
  input: ProjectDailyReportWeatherInput,
) {
  if (!input.projectId || !input.reportDate) {
    throw new Error("Projekt und Datum sind Pflichtfelder.");
  }

  await prisma.projectDailyReport.upsert({
    where: {
      projectId_reportDate: {
        projectId: input.projectId,
        reportDate: toWeatherDate(input.reportDate),
      },
    },
    create: {
      projectId: input.projectId,
      reportDate: toWeatherDate(input.reportDate),
      weatherCategory: input.weatherCategory || null,
      weatherNotes: input.weatherNotes || null,
      weatherSource: "MANUAL",
      weatherTempMaxC: cleanOptionalFloat(input.weatherTempMaxC),
      weatherTempMinC: cleanOptionalFloat(input.weatherTempMinC),
    },
    update: {
      weatherCategory: input.weatherCategory || null,
      weatherNotes: input.weatherNotes || null,
      weatherSource: "MANUAL",
      weatherTempMaxC: cleanOptionalFloat(input.weatherTempMaxC),
      weatherTempMinC: cleanOptionalFloat(input.weatherTempMinC),
    },
  });

  revalidateProjectViews(input.projectId);
}

export async function uploadProjectPhotos(formData: FormData) {
  const projectId = cleanFormString(formData.get("projectId"));
  const notes = cleanFormString(formData.get("notes"));
  const uploadedByName = cleanUploadText(
    cleanFormString(formData.get("uploadedByName")),
  );
  const uploadedByUserId = cleanFormString(formData.get("uploadedByUserId"));
  const takeMetadata = formData.get("takeMetadata") === "on";
  const availableForDailyReports =
    formData.get("availableForDailyReports") === "on";
  const files = formData
    .getAll("photos")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (!projectId) {
    throw new Error("Bitte ein Projekt auswählen.");
  }

  if (files.length === 0) {
    throw new Error("Bitte mindestens ein Foto auswählen.");
  }

  const project = await prisma.project.findUnique({
    where: {
      id: projectId,
    },
    select: {
      id: true,
    },
  });

  if (!project) {
    throw new Error("Projekt wurde nicht gefunden.");
  }

  for (const file of files) {
    if (!file.type.startsWith("image/")) {
      throw new Error(`"${file.name}" ist keine Bilddatei.`);
    }

    if (file.size > 15 * 1024 * 1024) {
      throw new Error(`"${file.name}" ist größer als 15 MB.`);
    }
  }

  const uploadDirectory = path.join(
    process.cwd(),
    "public",
    "uploads",
    "project-photos",
    projectId,
  );
  await mkdir(uploadDirectory, { recursive: true });

  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const extension = getPhotoExtension(file);
    const fileName = `${new Date().toISOString().slice(0, 10)}-${randomUUID()}.${extension}`;
    const absolutePath = path.join(uploadDirectory, fileName);
    const storagePath = path.join(
      "public",
      "uploads",
      "project-photos",
      projectId,
      fileName,
    );
    const publicUrl = `/uploads/project-photos/${projectId}/${fileName}`;
    const metadata = takeMetadata
      ? extractPhotoMetadata(buffer, file.type, {
          fileLastModified: file.lastModified,
          originalFileName: file.name,
        })
      : {};
    const gpsAddress =
      typeof metadata.gpsLatitude === "number" &&
      typeof metadata.gpsLongitude === "number"
        ? await reverseGeocodePhotoLocation(
            metadata.gpsLatitude,
            metadata.gpsLongitude,
          )
        : null;

    await writeFile(absolutePath, buffer);

    try {
      await prisma.projectPhoto.create({
        data: {
          projectId,
          fileName,
          originalFileName: takeMetadata ? cleanUploadText(file.name) : null,
          publicUrl,
          storagePath,
          mimeType: file.type || "application/octet-stream",
          fileSizeBytes: file.size,
          imageWidth: metadata.imageWidth ?? null,
          imageHeight: metadata.imageHeight ?? null,
          notes: notes || null,
          metadataTaken: takeMetadata,
          capturedAt: metadata.capturedAt ?? null,
          cameraMake: metadata.cameraMake ?? null,
          cameraModel: metadata.cameraModel ?? null,
          gpsLatitude: metadata.gpsLatitude ?? null,
          gpsLongitude: metadata.gpsLongitude ?? null,
          ...getPhotoGpsAddressData(gpsAddress),
          metadataJson: metadata.metadataJson ?? null,
          availableForDailyReports,
          uploadedByName: uploadedByName || null,
          uploadedByUserId: uploadedByUserId || null,
        },
      });
    } catch (error) {
      await unlink(absolutePath).catch(() => undefined);
      throw error;
    }
  }

  revalidateProjectPhotoViews(projectId);
}

export async function updateProjectPhoto(input: ProjectPhotoUpdateInput) {
  if (!input.id) {
    throw new Error("Foto-ID fehlt.");
  }

  const photo = await prisma.projectPhoto.update({
    where: {
      id: input.id,
    },
    data: {
      availableForDailyReports: input.availableForDailyReports,
      notes: input.notes || null,
    },
    select: {
      projectId: true,
    },
  });

  revalidateProjectPhotoViews(photo.projectId);
}

export async function refreshProjectPhotoLocations(projectId: string) {
  if (!projectId) {
    throw new Error("Projekt-ID fehlt.");
  }

  const photos = await prisma.projectPhoto.findMany({
    where: {
      projectId,
      gpsAddressLabel: null,
      gpsLatitude: {
        not: null,
      },
      gpsLongitude: {
        not: null,
      },
    },
    select: {
      gpsLatitude: true,
      gpsLongitude: true,
      id: true,
    },
  });

  let updated = 0;

  for (const photo of photos) {
    if (photo.gpsLatitude === null || photo.gpsLongitude === null) {
      continue;
    }

    const gpsAddress = await reverseGeocodePhotoLocation(
      photo.gpsLatitude,
      photo.gpsLongitude,
    );

    if (!gpsAddress) {
      continue;
    }

    await prisma.projectPhoto.update({
      where: {
        id: photo.id,
      },
      data: getPhotoGpsAddressData(gpsAddress),
    });
    updated += 1;
  }

  revalidateProjectPhotoViews(projectId);

  return {
    checked: photos.length,
    updated,
  };
}

export async function deleteProjectPhoto(id: string) {
  if (!id) {
    throw new Error("Foto-ID fehlt.");
  }

  const photo = await prisma.projectPhoto.findUnique({
    where: {
      id,
    },
    select: {
      projectId: true,
      storagePath: true,
    },
  });

  if (!photo) {
    return;
  }

  await prisma.projectPhoto.delete({
    where: {
      id,
    },
  });

  try {
    await unlink(path.join(process.cwd(), photo.storagePath));
  } catch {
    // Die Datenbank ist führend; eine bereits entfernte Datei blockiert das Löschen nicht.
  }

  revalidateProjectPhotoViews(photo.projectId);
}

export async function deleteProjectPhotos(photoIds: string[]) {
  const uniquePhotoIds = cleanPhotoIds(photoIds);

  if (uniquePhotoIds.length === 0) {
    throw new Error("Bitte mindestens ein Foto auswählen.");
  }

  const photos = await prisma.projectPhoto.findMany({
    where: {
      id: {
        in: uniquePhotoIds,
      },
    },
    select: {
      projectId: true,
      storagePath: true,
    },
  });

  if (photos.length === 0) {
    return;
  }

  await prisma.projectPhoto.deleteMany({
    where: {
      id: {
        in: uniquePhotoIds,
      },
    },
  });

  await Promise.all(
    photos.map(async (photo) => {
      try {
        await unlink(path.join(process.cwd(), photo.storagePath));
      } catch {
        // Die Datenbank ist führend; eine bereits entfernte Datei blockiert das Löschen nicht.
      }
    }),
  );

  for (const projectId of new Set(photos.map((photo) => photo.projectId))) {
    revalidateProjectPhotoViews(projectId);
  }
}

export async function moveProjectPhotos(input: ProjectPhotosMoveInput) {
  const uniquePhotoIds = cleanPhotoIds(input.photoIds);

  if (uniquePhotoIds.length === 0) {
    throw new Error("Bitte mindestens ein Foto auswählen.");
  }

  if (!input.targetProjectId) {
    throw new Error("Bitte eine Zielbaustelle auswählen.");
  }

  const targetProject = await prisma.project.findUnique({
    where: {
      id: input.targetProjectId,
    },
    select: {
      id: true,
    },
  });

  if (!targetProject) {
    throw new Error("Zielbaustelle wurde nicht gefunden.");
  }

  const photos = await prisma.projectPhoto.findMany({
    where: {
      id: {
        in: uniquePhotoIds,
      },
    },
    select: {
      fileName: true,
      id: true,
      projectId: true,
      storagePath: true,
    },
  });

  if (photos.length === 0) {
    return;
  }

  const targetDirectory = path.join(
    process.cwd(),
    "public",
    "uploads",
    "project-photos",
    input.targetProjectId,
  );
  await mkdir(targetDirectory, { recursive: true });

  const affectedProjectIds = new Set<string>([input.targetProjectId]);

  for (const photo of photos) {
    if (photo.projectId === input.targetProjectId) {
      continue;
    }

    affectedProjectIds.add(photo.projectId);

    const targetFileName = await getAvailableMovedPhotoFileName(
      targetDirectory,
      photo.fileName,
    );
    const newStoragePath = path.join(
      "public",
      "uploads",
      "project-photos",
      input.targetProjectId,
      targetFileName,
    );
    const newPublicUrl = `/uploads/project-photos/${input.targetProjectId}/${targetFileName}`;

    try {
      await rename(
        path.join(process.cwd(), photo.storagePath),
        path.join(process.cwd(), newStoragePath),
      );
    } catch {
      // Wenn die Datei extern fehlt, wird wenigstens die Projektzuordnung korrigiert.
    }

    await prisma.projectPhoto.update({
      where: {
        id: photo.id,
      },
      data: {
        fileName: targetFileName,
        projectId: input.targetProjectId,
        publicUrl: newPublicUrl,
        storagePath: newStoragePath,
      },
    });
  }

  for (const projectId of affectedProjectIds) {
    revalidateProjectPhotoViews(projectId);
  }
}

export async function cancelProject(id: string) {
  await prisma.project.update({
    where: {
      id,
    },
    data: {
      status: ProjectStatus.CANCELLED,
    },
  });

  revalidateProjectViews();
}

export async function deleteProject(id: string) {
  await prisma.project.delete({
    where: {
      id,
    },
  });

  revalidateProjectViews();
}

function toWeatherDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}

function toNullableNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toNullableInteger(value: number | null | undefined) {
  const numberValue = toNullableNumber(value);
  return numberValue === null ? null : Math.round(numberValue);
}

type PhotoMetadata = {
  cameraMake?: string;
  cameraModel?: string;
  capturedAt?: Date;
  gpsLatitude?: number;
  gpsLongitude?: number;
  imageHeight?: number;
  imageWidth?: number;
  metadataJson?: string;
};

type RawPhotoMetadataInput = {
  fileLastModified: number;
  originalFileName: string;
};

function cleanFormString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanUploadText(value: string) {
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return cleaned.length > 180 ? cleaned.slice(0, 180) : cleaned;
}

function getPhotoExtension(file: File) {
  const extensionFromName = path
    .extname(file.name)
    .replace(".", "")
    .toLowerCase();
  const extensionByMime: Record<string, string> = {
    "image/gif": "gif",
    "image/heic": "heic",
    "image/heif": "heif",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };

  if (/^[a-z0-9]{2,5}$/.test(extensionFromName)) {
    return extensionFromName === "jpeg" ? "jpg" : extensionFromName;
  }

  return extensionByMime[file.type] ?? "jpg";
}

function cleanPhotoIds(photoIds: string[]) {
  return Array.from(
    new Set(
      photoIds
        .filter((photoId) => typeof photoId === "string")
        .map((photoId) => photoId.trim())
        .filter(Boolean),
    ),
  );
}

async function getAvailableMovedPhotoFileName(
  targetDirectory: string,
  fileName: string,
) {
  const extension = path.extname(fileName);
  const baseName = path.basename(fileName, extension);
  let candidate = fileName;
  let index = 1;

  while (await fileExists(path.join(targetDirectory, candidate))) {
    candidate = `${baseName}-${index}${extension}`;
    index += 1;
  }

  return candidate;
}

async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function extractPhotoMetadata(
  buffer: Buffer,
  mimeType: string,
  rawInput: RawPhotoMetadataInput,
): PhotoMetadata {
  const dimensions = readImageDimensions(buffer, mimeType);
  const exif = mimeType === "image/jpeg" ? readJpegExif(buffer) : {};
  const metadata = {
    cameraMake: exif.cameraMake,
    cameraModel: exif.cameraModel,
    capturedAt: exif.capturedAt?.toISOString(),
    fileLastModified: Number.isFinite(rawInput.fileLastModified)
      ? new Date(rawInput.fileLastModified).toISOString()
      : null,
    gpsLatitude: exif.gpsLatitude,
    gpsLongitude: exif.gpsLongitude,
    imageHeight: dimensions.imageHeight,
    imageWidth: dimensions.imageWidth,
    originalFileName: cleanUploadText(rawInput.originalFileName),
  };

  return {
    ...dimensions,
    ...exif,
    metadataJson: JSON.stringify(metadata),
  };
}

function getPhotoGpsAddressData(location: PhotoGpsAddress | null) {
  return {
    gpsAddressJson: location?.gpsAddressJson ?? null,
    gpsAddressLabel: location?.gpsAddressLabel ?? null,
    gpsCity: location?.gpsCity ?? null,
    gpsCountry: location?.gpsCountry ?? null,
    gpsHouseNumber: location?.gpsHouseNumber ?? null,
    gpsPostcode: location?.gpsPostcode ?? null,
    gpsReverseGeocodeSource: location?.gpsReverseGeocodeSource ?? null,
    gpsReverseGeocodedAt: location?.gpsReverseGeocodedAt ?? null,
    gpsStreet: location?.gpsStreet ?? null,
  };
}

async function reverseGeocodePhotoLocation(
  latitude: number,
  longitude: number,
): Promise<PhotoGpsAddress | null> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const cacheKey = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
  if (photoGpsAddressCache.has(cacheKey)) {
    return photoGpsAddressCache.get(cacheKey) ?? null;
  }

  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", latitude.toString());
  url.searchParams.set("lon", longitude.toString());
  url.searchParams.set("zoom", "18");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "de");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    await waitForReverseGeocoderSlot();
    const response = await fetch(url.toString(), {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent": geocoderUserAgent,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      photoGpsAddressCache.set(cacheKey, null);
      return null;
    }

    const data = (await response.json()) as NominatimReverseResponse;
    const result = normalizeNominatimPhotoLocation(data);
    photoGpsAddressCache.set(cacheKey, result);
    return result;
  } catch {
    photoGpsAddressCache.set(cacheKey, null);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForReverseGeocoderSlot() {
  const now = Date.now();
  const waitMs = Math.max(0, 1100 - (now - lastReverseGeocodeRequestAt));

  if (waitMs > 0) {
    await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
  }

  lastReverseGeocodeRequestAt = Date.now();
}

function normalizeNominatimPhotoLocation(
  data: NominatimReverseResponse,
): PhotoGpsAddress | null {
  if (data.error || (!data.display_name && !data.address)) {
    return null;
  }

  const address = data.address ?? {};
  const street = getAddressPart(address, [
    "road",
    "pedestrian",
    "footway",
    "cycleway",
    "path",
    "residential",
  ]);
  const houseNumber = getAddressPart(address, ["house_number"]);
  const postcode = getAddressPart(address, ["postcode"]);
  const city = getAddressPart(address, [
    "city",
    "town",
    "village",
    "municipality",
    "hamlet",
  ]);
  const country = getAddressPart(address, ["country"]);
  const streetLine = [street, houseNumber].filter(Boolean).join(" ");
  const cityLine = [postcode, city].filter(Boolean).join(" ");
  const addressLabel =
    [streetLine, cityLine, country].filter(Boolean).join(", ") ||
    cleanGeocoderText(data.display_name);

  return {
    gpsAddressJson: cleanGeocoderJson(data),
    gpsAddressLabel: addressLabel || null,
    gpsCity: city,
    gpsCountry: country,
    gpsHouseNumber: houseNumber,
    gpsPostcode: postcode,
    gpsReverseGeocodeSource: "NOMINATIM",
    gpsReverseGeocodedAt: new Date(),
    gpsStreet: street,
  };
}

function getAddressPart(
  address: Record<string, string | undefined>,
  keys: string[],
) {
  for (const key of keys) {
    const value = cleanGeocoderText(address[key]);

    if (value) {
      return value;
    }
  }

  return null;
}

function cleanGeocoderText(value: string | null | undefined) {
  const cleaned = (value ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return cleaned.length > 180 ? cleaned.slice(0, 180) : cleaned;
}

function cleanGeocoderJson(value: NominatimReverseResponse) {
  const serialized = JSON.stringify(value);
  return serialized.length > 6000 ? serialized.slice(0, 6000) : serialized;
}

function readImageDimensions(buffer: Buffer, mimeType: string) {
  if (mimeType === "image/jpeg") {
    return readJpegDimensions(buffer);
  }

  if (
    mimeType === "image/png" &&
    buffer.length >= 24 &&
    buffer.toString("ascii", 1, 4) === "PNG"
  ) {
    return {
      imageHeight: buffer.readUInt32BE(20),
      imageWidth: buffer.readUInt32BE(16),
    };
  }

  if (mimeType === "image/gif" && buffer.length >= 10) {
    return {
      imageHeight: buffer.readUInt16LE(8),
      imageWidth: buffer.readUInt16LE(6),
    };
  }

  if (mimeType === "image/webp") {
    return readWebpDimensions(buffer);
  }

  return {};
}

function readJpegDimensions(buffer: Buffer) {
  if (buffer.length < 4 || buffer.readUInt16BE(0) !== 0xffd8) {
    return {};
  }

  let offset = 2;
  const sofMarkers = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce,
    0xcf,
  ]);

  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    if (marker === 0xda || marker === 0xd9) {
      break;
    }

    const segmentLength = buffer.readUInt16BE(offset + 2);
    if (segmentLength < 2 || offset + 2 + segmentLength > buffer.length) {
      break;
    }

    if (sofMarkers.has(marker)) {
      return {
        imageHeight: buffer.readUInt16BE(offset + 5),
        imageWidth: buffer.readUInt16BE(offset + 7),
      };
    }

    offset += 2 + segmentLength;
  }

  return {};
}

function readWebpDimensions(buffer: Buffer) {
  if (
    buffer.length < 30 ||
    buffer.toString("ascii", 0, 4) !== "RIFF" ||
    buffer.toString("ascii", 8, 12) !== "WEBP"
  ) {
    return {};
  }

  const format = buffer.toString("ascii", 12, 16);

  if (format === "VP8X" && buffer.length >= 30) {
    return {
      imageHeight: readUInt24LE(buffer, 27) + 1,
      imageWidth: readUInt24LE(buffer, 24) + 1,
    };
  }

  if (format === "VP8 " && buffer.length >= 30) {
    return {
      imageHeight: buffer.readUInt16LE(28) & 0x3fff,
      imageWidth: buffer.readUInt16LE(26) & 0x3fff,
    };
  }

  return {};
}

function readUInt24LE(buffer: Buffer, offset: number) {
  return buffer[offset] + (buffer[offset + 1] << 8) + (buffer[offset + 2] << 16);
}

function readJpegExif(buffer: Buffer): PhotoMetadata {
  const tiffOffset = findExifTiffOffset(buffer);

  if (tiffOffset === null || tiffOffset + 8 >= buffer.length) {
    return {};
  }

  const littleEndian = buffer.toString("ascii", tiffOffset, tiffOffset + 2) === "II";
  const read16 = (offset: number) =>
    littleEndian ? buffer.readUInt16LE(offset) : buffer.readUInt16BE(offset);
  const read32 = (offset: number) =>
    littleEndian ? buffer.readUInt32LE(offset) : buffer.readUInt32BE(offset);

  if (read16(tiffOffset + 2) !== 42) {
    return {};
  }

  const readValue = (
    type: number,
    count: number,
    valueOffset: number,
  ): number | number[] | string | null => {
    const typeSize: Record<number, number> = {
      1: 1,
      2: 1,
      3: 2,
      4: 4,
      5: 8,
    };
    const size = typeSize[type];
    if (!size) return null;

    const totalSize = size * count;
    const dataOffset =
      totalSize <= 4 ? valueOffset : tiffOffset + read32(valueOffset);

    if (dataOffset < 0 || dataOffset + totalSize > buffer.length) {
      return null;
    }

    if (type === 2) {
      return buffer
        .toString("ascii", dataOffset, dataOffset + count)
        .replace(/\0+$/, "")
        .trim();
    }

    if (type === 3) {
      const values = Array.from({ length: count }, (_, index) =>
        read16(dataOffset + index * 2),
      );
      return count === 1 ? values[0] : values;
    }

    if (type === 4) {
      const values = Array.from({ length: count }, (_, index) =>
        read32(dataOffset + index * 4),
      );
      return count === 1 ? values[0] : values;
    }

    if (type === 5) {
      const values = Array.from({ length: count }, (_, index) => {
        const numerator = read32(dataOffset + index * 8);
        const denominator = read32(dataOffset + index * 8 + 4);
        return denominator === 0 ? 0 : numerator / denominator;
      });
      return count === 1 ? values[0] : values;
    }

    return null;
  };

  const readIfd = (ifdOffset: number) => {
    if (ifdOffset < 0 || ifdOffset + 2 > buffer.length) {
      return new Map<number, number | number[] | string | null>();
    }

    const entryCount = read16(ifdOffset);
    const result = new Map<number, number | number[] | string | null>();

    for (let index = 0; index < entryCount; index += 1) {
      const entryOffset = ifdOffset + 2 + index * 12;
      if (entryOffset + 12 > buffer.length) break;

      const tag = read16(entryOffset);
      const type = read16(entryOffset + 2);
      const count = read32(entryOffset + 4);
      result.set(tag, readValue(type, count, entryOffset + 8));
    }

    return result;
  };

  const ifd0Offset = tiffOffset + read32(tiffOffset + 4);
  const ifd0 = readIfd(ifd0Offset);
  const exifIfdPointer = asNumber(ifd0.get(0x8769));
  const gpsIfdPointer = asNumber(ifd0.get(0x8825));
  const exifIfd = exifIfdPointer ? readIfd(tiffOffset + exifIfdPointer) : null;
  const gpsIfd = gpsIfdPointer ? readIfd(tiffOffset + gpsIfdPointer) : null;
  const capturedAt =
    parseExifDate(asString(exifIfd?.get(0x9003))) ??
    parseExifDate(asString(exifIfd?.get(0x9004)));

  return {
    cameraMake: asString(ifd0.get(0x010f)) || undefined,
    cameraModel: asString(ifd0.get(0x0110)) || undefined,
    capturedAt: capturedAt ?? undefined,
    ...readGpsCoordinates(gpsIfd),
  };
}

function findExifTiffOffset(buffer: Buffer) {
  if (buffer.length < 4 || buffer.readUInt16BE(0) !== 0xffd8) {
    return null;
  }

  let offset = 2;

  while (offset + 4 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    const segmentLength = buffer.readUInt16BE(offset + 2);
    const segmentStart = offset + 4;
    const segmentEnd = offset + 2 + segmentLength;

    if (marker === 0xe1 && segmentEnd <= buffer.length) {
      const header = buffer.toString("ascii", segmentStart, segmentStart + 6);
      if (header === "Exif\0\0") {
        return segmentStart + 6;
      }
    }

    if (marker === 0xda || segmentLength < 2) {
      break;
    }

    offset += 2 + segmentLength;
  }

  return null;
}

function asString(value: number | number[] | string | null | undefined) {
  return typeof value === "string" ? value : "";
}

function asNumber(value: number | number[] | string | null | undefined) {
  return typeof value === "number" ? value : null;
}

function asNumberArray(value: number | number[] | string | null | undefined) {
  return Array.isArray(value) ? value : [];
}

function parseExifDate(value: string) {
  const match = value.match(
    /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/,
  );

  if (!match) return null;

  const [, year, month, day, hour, minute, second] = match;
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
}

function readGpsCoordinates(
  gpsIfd: Map<number, number | number[] | string | null> | null,
) {
  if (!gpsIfd) return {};

  const latitude = gpsToDecimal(asNumberArray(gpsIfd.get(0x0002)));
  const longitude = gpsToDecimal(asNumberArray(gpsIfd.get(0x0004)));
  const latitudeRef = asString(gpsIfd.get(0x0001));
  const longitudeRef = asString(gpsIfd.get(0x0003));

  if (latitude === null || longitude === null) {
    return {};
  }

  return {
    gpsLatitude: latitudeRef.toUpperCase() === "S" ? -latitude : latitude,
    gpsLongitude: longitudeRef.toUpperCase() === "W" ? -longitude : longitude,
  };
}

function gpsToDecimal(values: number[]) {
  if (values.length < 3) return null;
  return values[0] + values[1] / 60 + values[2] / 3600;
}

function getWeatherCodeLabel(code: number | null) {
  const labels: Record<number, string> = {
    0: "klar",
    1: "überwiegend klar",
    2: "teilweise bewölkt",
    3: "bedeckt",
    45: "Nebel",
    48: "Reifnebel",
    51: "leichter Nieselregen",
    53: "Nieselregen",
    55: "starker Nieselregen",
    56: "gefrierender Nieselregen",
    57: "starker gefrierender Nieselregen",
    61: "leichter Regen",
    63: "Regen",
    65: "starker Regen",
    66: "gefrierender Regen",
    67: "starker gefrierender Regen",
    71: "leichter Schneefall",
    73: "Schneefall",
    75: "starker Schneefall",
    77: "Schneegriesel",
    80: "leichte Regenschauer",
    81: "Regenschauer",
    82: "starke Regenschauer",
    85: "leichte Schneeschauer",
    86: "starke Schneeschauer",
    95: "Gewitter",
    96: "Gewitter mit Hagel",
    99: "starkes Gewitter mit Hagel",
  };

  return code === null ? null : labels[code] ?? `Wettercode ${code}`;
}
