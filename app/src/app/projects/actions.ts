"use server";

import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { access, mkdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { ProjectStatus } from "@prisma/client";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import {
  requireProjectAccess,
  requireProjectContentDeleteOwnership,
  requireSession,
} from "@/lib/auth-access";
import {
  getProjectFormPresetOptions,
  PROJECT_FORM_FIELD_TYPES,
  parseProjectFormFields,
  projectFormFieldCollectsValue,
  projectFormFieldUsesOptions,
} from "./projectFormTypes";
import {
  dailyReportApprovalFieldIds,
  dailyReportPerformanceLineLimit,
  type DailyReportCountRow,
  type DailyReportMaterialRow,
  type DailyReportPhotoGridLayout,
} from "./dailyReportContext";
import type {
  ProjectFormFieldDefinition,
  ProjectFormFieldType,
} from "./projectFormTypes";

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

export type ProjectDailyReportSaveInput = {
  approvedByName: string;
  approvedFields: string[];
  break1From: string;
  break1To: string;
  break2From: string;
  break2To: string;
  laborRows: DailyReportCountRow[];
  machineRows: DailyReportCountRow[];
  materialRows: DailyReportMaterialRow[];
  otherRows: DailyReportMaterialRow[];
  performanceLines: string[];
  photoIds: string[];
  photoGridLayout: DailyReportPhotoGridLayout;
  projectId: string;
  projectName: string;
  projectNumber: string;
  reportDate: string;
  sheetNumber: string;
  siteDiscussionNotes: string;
  siteDiscussionRoles: string[];
  siteDiscussionThirdPartyName: string;
  subcontractorRows: DailyReportCountRow[];
  contractorSignatureDataUrl: string;
  clientSignatureDataUrl: string;
  showRealMachineNames: boolean;
  status: "APPROVED" | "DRAFT";
  trafficSafetyFirstCheckTime: string;
  trafficSafetySecondCheckTime: string;
  weatherCategory: string;
  weatherNotes: string;
  weatherTempMaxC: string;
  weatherTempMinC: string;
  weekday: string;
  workEnd: string;
  workStart: string;
};

export type ProjectDailyReportDeleteInput = {
  id: string;
};

export type ProjectPhotoUpdateInput = {
  availableForDailyReports: boolean;
  id: string;
  notes: string;
};

export type ProjectNoteInput = {
  category: string;
  content: string;
  id?: string;
  includeInDailyReport: boolean;
  noteDate: string;
  noteEndDate: string;
  projectId: string;
  title: string;
  visibility: string;
};

export type ProjectNoteDeleteInput = {
  id: string;
  projectId: string;
};

export type ProjectPhotosMoveInput = {
  photoIds: string[];
  targetProjectId: string;
};

export type ProjectDocumentFolderCreateInput = {
  name: string;
  projectId: string;
};

export type ProjectDocumentFolderDeleteInput = {
  id: string;
};

export type ProjectDocumentFolderUpdateInput = {
  id: string;
  name: string;
};

export type ProjectDocumentUpdateInput = {
  displayName: string;
  id: string;
};

export type ProjectDocumentsMoveInput = {
  documentIds: string[];
  targetFolderId?: string;
  targetProjectId: string;
};

export type ProjectFormTemplateCreateInput = {
  category: string;
  description: string;
  emailRecipients?: string[];
  fields: Array<{
    description?: string;
    label: string;
    options?: string[];
    optionsText?: string;
    required: boolean;
    type: string;
    width?: number;
  }>;
  name: string;
  paperOrientation: string;
  paperSize: string;
};

export type ProjectFormTemplateUpdateInput = ProjectFormTemplateCreateInput & {
  id: string;
};

export type ProjectFormTemplateDeleteInput = {
  id: string;
};

export type ProjectFormSubmissionInput = {
  createdByName: string;
  formDate: string;
  id?: string;
  projectId: string;
  templateId: string;
  title: string;
  values: Record<string, boolean | string>;
};

export type ProjectFormSubmissionDeleteInput = {
  id: string;
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
  hourly?: {
    precipitation?: Array<number | null>;
    temperature_2m?: Array<number | null>;
    time?: string[];
    weather_code?: Array<number | null>;
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

function cleanProjectNoteInput(input: ProjectNoteInput) {
  const projectId = cleanProjectFormText(input.projectId, 80);
  const content = cleanProjectFormText(input.content, 4000);

  if (!projectId) {
    throw new Error("Projekt fehlt.");
  }

  if (!content) {
    throw new Error("Notiztext ist Pflicht.");
  }

  const noteDate = cleanProjectNoteDate(input.noteDate);
  const noteEndDate = cleanOptionalProjectNoteDate(input.noteEndDate);

  if (noteEndDate && noteEndDate < noteDate) {
    throw new Error("Notiz-Bis-Datum darf nicht vor dem Von-Datum liegen.");
  }

  return {
    category: cleanProjectNoteCategory(input.category),
    content,
    includeInDailyReport: Boolean(input.includeInDailyReport),
    noteDate,
    noteEndDate,
    projectId,
    title: cleanProjectFormText(input.title, 180) || null,
    visibility: cleanProjectNoteVisibility(input.visibility),
  };
}

function cleanProjectNoteDate(value: string) {
  const cleaned = value.trim();

  if (!cleaned) {
    const now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  }

  const date = new Date(`${cleaned}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Notizdatum ist ungültig.");
  }

  return date;
}

function cleanOptionalProjectNoteDate(value: string) {
  const cleaned = value.trim();

  if (!cleaned) return null;

  return cleanProjectNoteDate(cleaned);
}

function cleanProjectNoteCategory(value: string) {
  const allowed = new Set([
    "GENERAL",
    "OBSTRUCTION",
    "INCIDENT",
    "CLIENT",
    "INTERNAL",
  ]);
  const cleaned = cleanProjectFormText(value, 40).toUpperCase();

  return allowed.has(cleaned) ? cleaned : "GENERAL";
}

function cleanProjectNoteVisibility(value: string) {
  const allowed = new Set(["INTERNAL", "DISPATCH", "BTB"]);
  const cleaned = cleanProjectFormText(value, 40).toUpperCase();

  return allowed.has(cleaned) ? cleaned : "INTERNAL";
}

function revalidateProjectViews(projectId?: string) {
  revalidatePath("/projects");
  revalidatePath("/projects/performance");
  revalidatePath("/projects/notizen");
  revalidatePath("/crew-dispatch");
  revalidatePath("/projects/bautagesberichte");
  if (projectId) {
    revalidatePath(`/projects/${projectId}`);
  }
}

function revalidateProjectPhotoViews(projectId?: string) {
  revalidateProjectViews(projectId);
  revalidatePath("/dashboard");
  revalidatePath("/projects/fotos");
  revalidatePath("/projects/bautagesberichte");
}

function revalidateProjectDocumentViews(projectId?: string) {
  revalidateProjectViews(projectId);
  revalidatePath("/projects/dokumente");
}

function revalidateProjectFormViews(projectId?: string) {
  revalidateProjectViews(projectId);
  revalidatePath("/projects/formulare");
  revalidatePath("/projects/bautagesberichte");
}

function revalidateProjectDailyReportViews(projectId?: string) {
  revalidateProjectViews(projectId);
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

export async function createProjectNote(input: ProjectNoteInput) {
  const data = cleanProjectNoteInput(input);
  await requireProjectAccess(data.projectId);
  const session = await requireSession();
  const author = await prisma.user.findUnique({
    select: {
      employee: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
      name: true,
    },
    where: { id: session.user.id },
  });
  const authorName = author?.employee
    ? `${author.employee.firstName} ${author.employee.lastName}`
    : author?.name || session.user.name || session.user.email;

  await prisma.projectNote.create({
    data: {
      ...data,
      createdByUserId: session.user.id,
      createdByName: authorName,
    },
  });

  revalidateProjectViews(data.projectId);
}

export async function updateProjectNote(input: ProjectNoteInput) {
  if (!input.id) {
    throw new Error("Notiz fehlt.");
  }

  const data = cleanProjectNoteInput(input);
  await requireProjectAccess(data.projectId);

  await prisma.projectNote.update({
    where: {
      id: input.id,
    },
    data: {
      category: data.category,
      content: data.content,
      includeInDailyReport: data.includeInDailyReport,
      noteDate: data.noteDate,
      noteEndDate: data.noteEndDate,
      title: data.title,
      visibility: data.visibility,
    },
  });

  revalidateProjectViews(data.projectId);
}

export async function deleteProjectNote(input: ProjectNoteDeleteInput) {
  if (!input.id) {
    throw new Error("Notiz fehlt.");
  }
  const existingNote = await prisma.projectNote.findUnique({
    select: { createdByUserId: true, projectId: true },
    where: { id: input.id },
  });
  if (!existingNote) return;
  await requireProjectAccess(existingNote.projectId);
  await requireProjectContentDeleteOwnership(existingNote.createdByUserId);

  await prisma.projectNote.delete({
    where: {
      id: input.id,
    },
  });

  revalidateProjectViews(input.projectId);
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
  url.searchParams.set(
    "hourly",
    "temperature_2m,precipitation,weather_code",
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
    const hourlyJson = buildHourlyWeatherJsonForDate(forecast, date);
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
        hourlyJson,
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
        hourlyJson,
        fetchedAt: now,
        ...currentData,
      },
    });
  }

  revalidateProjectViews(projectId);
}

export async function ensureProjectWeatherForDate(
  projectId: string,
  dateKey: string,
) {
  if (!projectId || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return false;
  }

  const weatherDate = toWeatherDate(dateKey);
  const existingWeather = await prisma.projectWeatherLog.findUnique({
    where: {
      projectId_weatherDate: {
        projectId,
        weatherDate,
      },
    },
    select: {
      hourlyJson: true,
      id: true,
    },
  });

  if (existingWeather?.hourlyJson) {
    return true;
  }

  const project = await prisma.project.findUnique({
    where: {
      id: projectId,
    },
    select: {
      mapLatitude: true,
      mapLongitude: true,
    },
  });

  if (
    !project ||
    project.mapLatitude === null ||
    project.mapLongitude === null
  ) {
    return false;
  }

  const todayKey = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Berlin",
  }).format(new Date());
  const dayDifference = getDateKeyDifference(todayKey, dateKey);

  if (dayDifference > 15) {
    return false;
  }

  const isForecastRange = dayDifference >= -92;
  const url = new URL(
    isForecastRange
      ? "https://api.open-meteo.com/v1/forecast"
      : "https://archive-api.open-meteo.com/v1/archive",
  );
  url.searchParams.set("latitude", project.mapLatitude.toString());
  url.searchParams.set("longitude", project.mapLongitude.toString());
  url.searchParams.set(
    "daily",
    [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_sum",
      "wind_speed_10m_max",
      ...(isForecastRange ? ["precipitation_probability_max"] : []),
    ].join(","),
  );
  url.searchParams.set(
    "hourly",
    "temperature_2m,precipitation,weather_code",
  );
  url.searchParams.set("timezone", "Europe/Berlin");

  if (isForecastRange) {
    url.searchParams.set("past_days", String(Math.max(0, -dayDifference)));
    url.searchParams.set(
      "forecast_days",
      String(Math.max(1, dayDifference + 1)),
    );
  } else {
    url.searchParams.set("start_date", dateKey);
    url.searchParams.set("end_date", dateKey);
  }

  try {
    const response = await fetch(url.toString(), {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return false;
    }

    const weather = (await response.json()) as OpenMeteoForecast;
    const index = (weather.daily?.time ?? []).indexOf(dateKey);

    if (index < 0) {
      return false;
    }

    const weatherCode = toNullableInteger(weather.daily?.weather_code?.[index]);
    const tempMinC = toNullableNumber(
      weather.daily?.temperature_2m_min?.[index],
    );
    const tempMaxC = toNullableNumber(
      weather.daily?.temperature_2m_max?.[index],
    );
    const weatherLabel = getWeatherCodeLabel(weatherCode);
    const hourlyJson = buildHourlyWeatherJsonForDate(weather, dateKey);

    await prisma.projectWeatherLog.upsert({
      where: {
        projectId_weatherDate: {
          projectId,
          weatherDate,
        },
      },
      create: {
        fetchedAt: new Date(),
        hourlyJson,
        precipitationMm:
          toNullableNumber(weather.daily?.precipitation_sum?.[index]) ?? 0,
        precipitationProbabilityMax: toNullableInteger(
          weather.daily?.precipitation_probability_max?.[index],
        ),
        projectId,
        source: isForecastRange ? "OPEN_METEO" : "OPEN_METEO_ARCHIVE",
        tempMaxC,
        tempMinC,
        weatherCategory: weatherLabel,
        weatherCategorySource: "AUTO",
        weatherCode,
        weatherDate,
        weatherLabel,
        windSpeedMaxKmh: toNullableNumber(
          weather.daily?.wind_speed_10m_max?.[index],
        ),
      },
      update: {
        fetchedAt: new Date(),
        hourlyJson,
        precipitationMm:
          toNullableNumber(weather.daily?.precipitation_sum?.[index]) ?? 0,
        precipitationProbabilityMax: toNullableInteger(
          weather.daily?.precipitation_probability_max?.[index],
        ),
        source: isForecastRange ? "OPEN_METEO" : "OPEN_METEO_ARCHIVE",
        tempMaxC,
        tempMinC,
        weatherCategory: weatherLabel,
        weatherCategorySource: "AUTO",
        weatherCode,
        weatherLabel,
        windSpeedMaxKmh: toNullableNumber(
          weather.daily?.wind_speed_10m_max?.[index],
        ),
      },
    });

    revalidateProjectViews(projectId);
    return true;
  } catch {
    return false;
  }
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

  revalidateProjectDailyReportViews(input.projectId);
}

export async function saveProjectDailyReport(input: ProjectDailyReportSaveInput) {
  const projectId = input.projectId.trim();
  const reportDateKey = input.reportDate.trim();

  if (!projectId || !/^\d{4}-\d{2}-\d{2}$/.test(reportDateKey)) {
    throw new Error("Projekt und Berichtdatum sind Pflichtfelder.");
  }
  await requireProjectAccess(projectId);
  const actor = await getProjectActor();

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

  const reportDate = toWeatherDate(reportDateKey);
  const status = input.status === "APPROVED" ? "APPROVED" : "DRAFT";
  const existingReport = await prisma.projectDailyReport.findUnique({
    where: {
      projectId_reportDate: {
        projectId,
        reportDate,
      },
    },
    select: {
      approvedAt: true,
      createdByName: true,
      createdByUserId: true,
    },
  });
  const approvedAt =
    status === "APPROVED" ? existingReport?.approvedAt ?? new Date() : null;
  const approvedByName =
    status === "APPROVED"
      ? cleanProjectFormText(input.approvedByName, 120) || null
      : null;
  const approvedFieldsJson = JSON.stringify(
    cleanDailyReportApprovedFields(input.approvedFields),
  );
  const laborJson = JSON.stringify(cleanDailyReportCountRows(input.laborRows));
  const machinesJson = JSON.stringify(
    cleanDailyReportCountRows(input.machineRows),
  );
  const materialJson = JSON.stringify(
    cleanDailyReportMaterialRows(input.materialRows),
  );
  const otherJson = JSON.stringify(cleanDailyReportMaterialRows(input.otherRows));
  const subcontractorJson = JSON.stringify(
    cleanDailyReportCountRows(input.subcontractorRows),
  );
  const performanceJson = JSON.stringify(
    cleanDailyReportLines(input.performanceLines, dailyReportPerformanceLineLimit),
  );
  const data = {
    approvedAt,
    approvedByName,
    approvedFieldsJson,
    break1From: cleanDailyReportTime(input.break1From),
    break1To: cleanDailyReportTime(input.break1To),
    break2From: cleanDailyReportTime(input.break2From),
    break2To: cleanDailyReportTime(input.break2To),
    laborJson,
    machinesJson,
    materialJson,
    otherJson,
    performanceJson,
    photoGridLayout: cleanDailyReportPhotoGridLayout(input.photoGridLayout),
    reportProjectName: cleanProjectFormText(input.projectName, 180) || null,
    reportProjectNumber: cleanProjectFormText(input.projectNumber, 80) || null,
    sheetNumber: cleanProjectFormText(input.sheetNumber, 20) || "1",
    siteDiscussionNotes:
      cleanProjectFormText(input.siteDiscussionNotes, 1500) || null,
    siteDiscussionRolesJson: JSON.stringify(
      cleanDailyReportSiteDiscussionRoles(input.siteDiscussionRoles),
    ),
    siteDiscussionThirdPartyName:
      cleanProjectFormText(input.siteDiscussionThirdPartyName, 180) || null,
    subcontractorJson,
    contractorSignatureDataUrl: cleanDailyReportSignatureDataUrl(
      input.contractorSignatureDataUrl,
    ),
    clientSignatureDataUrl: cleanDailyReportSignatureDataUrl(
      input.clientSignatureDataUrl,
    ),
    showRealMachineNames: input.showRealMachineNames === true,
    status,
    trafficSafetyFirstCheckTime: cleanDailyReportTime(
      input.trafficSafetyFirstCheckTime,
    ),
    trafficSafetySecondCheckTime: cleanDailyReportTime(
      input.trafficSafetySecondCheckTime,
    ),
    weatherCategory: cleanProjectFormText(input.weatherCategory, 180) || null,
    weatherNotes: cleanProjectFormText(input.weatherNotes, 1000) || null,
    weatherSource: "MANUAL",
    weatherTempMaxC: cleanOptionalFloat(input.weatherTempMaxC),
    weatherTempMinC: cleanOptionalFloat(input.weatherTempMinC),
    weekdayLabel: cleanProjectFormText(input.weekday, 30) || null,
    workEnd: cleanDailyReportTime(input.workEnd),
    workStart: cleanDailyReportTime(input.workStart),
  };

  const photoIds = cleanPhotoIds(input.photoIds);
  const validPhotos =
    photoIds.length > 0
      ? await prisma.projectPhoto.findMany({
          where: {
            availableForDailyReports: true,
            id: {
              in: photoIds,
            },
            mimeType: {
              in: ["image/jpeg", "image/png"],
            },
            projectId,
          },
          select: {
            id: true,
          },
        })
      : [];

  await prisma.$transaction(async (transaction) => {
    const report = await transaction.projectDailyReport.upsert({
      where: {
        projectId_reportDate: {
          projectId,
          reportDate,
        },
      },
      create: {
        ...data,
        createdByName: actor.name,
        createdByUserId: actor.userId,
        projectId,
        reportDate,
      },
      update: {
        ...data,
        createdByName: existingReport?.createdByName ?? actor.name,
        createdByUserId: existingReport?.createdByUserId ?? actor.userId,
      },
    });

    await transaction.projectDailyReportPhoto.deleteMany({
      where: {
        dailyReportId: report.id,
      },
    });

    if (validPhotos.length > 0) {
      const validPhotoIds = new Set(validPhotos.map((photo) => photo.id));

      await transaction.projectDailyReportPhoto.createMany({
        data: photoIds
          .filter((photoId) => validPhotoIds.has(photoId))
          .map((photoId, index) => ({
            dailyReportId: report.id,
            photoId,
            sortOrder: index,
          })),
      });
    }
  });

  await renumberApprovedDailyReports(projectId);
  revalidateProjectDailyReportViews(projectId);
}

export async function deleteProjectDailyReport(
  input: ProjectDailyReportDeleteInput,
) {
  const reportId = input.id.trim();

  if (!reportId) {
    throw new Error("Bautagesbericht-ID fehlt.");
  }

  const report = await prisma.projectDailyReport.findUnique({
    where: {
      id: reportId,
    },
    select: {
      createdByUserId: true,
      projectId: true,
    },
  });

  if (!report) {
    return {
      deleted: false,
    };
  }
  await requireProjectAccess(report.projectId);
  await requireProjectContentDeleteOwnership(report.createdByUserId);

  await prisma.projectDailyReport.delete({
    where: {
      id: reportId,
    },
  });

  await renumberApprovedDailyReports(report.projectId);
  revalidateProjectDailyReportViews(report.projectId);

  return {
    deleted: true,
  };
}

async function renumberApprovedDailyReports(projectId: string) {
  const approvedReports = await prisma.projectDailyReport.findMany({
    where: {
      projectId,
      status: "APPROVED",
    },
    orderBy: [{ reportDate: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      reportNumber: true,
    },
  });

  const updates = approvedReports
    .map((report, index) => {
      const nextNumber = index + 1;

      if (report.reportNumber === nextNumber) {
        return null;
      }

      return prisma.projectDailyReport.update({
        where: {
          id: report.id,
        },
        data: {
          reportNumber: nextNumber,
          sheetNumber: String(nextNumber),
        },
      });
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  if (updates.length > 0) {
    await prisma.$transaction(updates);
  }

  await prisma.projectDailyReport.updateMany({
    where: {
      projectId,
      status: {
        not: "APPROVED",
      },
      reportNumber: {
        not: null,
      },
    },
    data: {
      reportNumber: null,
    },
  });
}

function cleanDailyReportApprovedFields(values: string[]) {
  const allowed = new Set<string>(dailyReportApprovalFieldIds);

  return Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter((value) => allowed.has(value)),
    ),
  );
}

function cleanDailyReportCountRows(rows: DailyReportCountRow[]) {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .slice(0, 24)
    .map((row, index) => {
      const label = cleanProjectFormText(String(row.label ?? ""), 120);
      const key =
        cleanProjectFormText(String(row.key ?? ""), 80) ||
        `zeile_${index + 1}`;

      if (!label) {
        return null;
      }

      return {
        count: cleanPositiveReportNumber(row.count),
        hours: cleanPositiveReportNumber(row.hours),
        key,
        label,
      };
    })
    .filter((row): row is DailyReportCountRow => Boolean(row));
}

function cleanDailyReportMaterialRows(rows: DailyReportMaterialRow[]) {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .slice(0, 24)
    .map((row, index) => {
      const label = cleanProjectFormText(String(row.label ?? ""), 160);
      const unit = cleanProjectFormText(String(row.unit ?? ""), 20);
      const key =
        cleanProjectFormText(String(row.key ?? ""), 100) ||
        `material_${index + 1}`;

      if (!label) {
        return null;
      }

      return {
        key,
        label,
        quantity: cleanPositiveReportNumber(row.quantity),
        unit,
      };
    })
    .filter((row): row is DailyReportMaterialRow => Boolean(row));
}

function cleanDailyReportLines(lines: string[], maxLines: number) {
  if (!Array.isArray(lines)) {
    return [];
  }

  return lines
    .map((line) => cleanProjectFormText(String(line ?? ""), 500))
    .filter(Boolean)
    .slice(0, maxLines);
}

function cleanDailyReportSignatureDataUrl(value: string) {
  const cleaned = String(value ?? "").trim();

  if (!cleaned) return null;

  if (
    !cleaned.startsWith("data:image/png;base64,") ||
    cleaned.length > 300_000
  ) {
    throw new Error("Unterschrift konnte nicht gespeichert werden.");
  }

  return cleaned;
}

function cleanDailyReportPhotoGridLayout(
  value: DailyReportPhotoGridLayout,
): DailyReportPhotoGridLayout {
  return value === "1x2" ||
    value === "2x2" ||
    value === "2x3" ||
    value === "2x4"
    ? value
    : "2x4";
}

function cleanDailyReportSiteDiscussionRoles(values: string[]) {
  const allowedRoles = new Set([
    "CLIENT",
    "SUPERVISOR",
    "PLANNER",
    "THIRD_PARTY",
  ]);

  if (!Array.isArray(values)) return [];

  return Array.from(
    new Set(
      values
        .map((value) => String(value ?? "").trim())
        .filter((value) => allowedRoles.has(value)),
    ),
  );
}

function cleanDailyReportTime(value: string) {
  const cleaned = cleanProjectFormText(value, 20);

  if (!cleaned) {
    return null;
  }

  const match = cleaned.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return cleaned;
  }

  const hours = Math.min(Math.max(Number(match[1]), 0), 23);
  const minutes = Math.min(Math.max(Number(match[2]), 0), 59);

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function cleanPositiveReportNumber(value: number) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue < 0) {
    return 0;
  }

  return Math.round(numberValue * 10) / 10;
}

export async function uploadProjectPhotos(formData: FormData) {
  const projectId = cleanFormString(formData.get("projectId"));
  const notes = cleanFormString(formData.get("notes"));
  const photoNotes = formData
    .getAll("photoNotes")
    .map((value) => (typeof value === "string" ? value.trim() : ""));
  const actor = await getProjectActor();
  const takeMetadata = formData.get("takeMetadata") === "on";
  const compressPhotos = formData.get("compressPhotos") === "on";
  const availableForDailyReports =
    formData.get("availableForDailyReports") === "on";
  const files = formData
    .getAll("photos")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (!projectId) {
    throw new Error("Bitte ein Projekt auswählen.");
  }
  await requireProjectAccess(projectId);

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

    if (file.size > 50 * 1024 * 1024) {
      throw new Error(`"${file.name}" ist größer als 50 MB.`);
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
  const uploadedPublicUrls: string[] = [];

  for (const [fileIndex, file] of files.entries()) {
    const originalBuffer = Buffer.from(await file.arrayBuffer());
    const storedPhoto = compressPhotos
      ? await compressProjectPhoto(originalBuffer, file.type)
      : {
          buffer: originalBuffer,
          extension: getPhotoExtension(file),
          mimeType: file.type || "application/octet-stream",
        };
    const buffer = storedPhoto.buffer;
    const extension = getPhotoExtension(file);
    const fileName = `${new Date().toISOString().slice(0, 10)}-${randomUUID()}.${
      storedPhoto.extension || extension
    }`;
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
      ? extractPhotoMetadata(originalBuffer, file.type, {
          fileLastModified: file.lastModified,
          originalFileName: file.name,
        })
      : {};
    const storedDimensions = readImageDimensions(
      buffer,
      storedPhoto.mimeType,
    );
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
          mimeType: storedPhoto.mimeType,
          fileSizeBytes: buffer.length,
          imageWidth:
            storedDimensions.imageWidth ?? metadata.imageWidth ?? null,
          imageHeight:
            storedDimensions.imageHeight ?? metadata.imageHeight ?? null,
          notes:
            cleanProjectFormText(photoNotes[fileIndex] ?? "", 1500) ||
            cleanProjectFormText(notes, 1500) ||
            null,
          metadataTaken: takeMetadata,
          capturedAt: metadata.capturedAt ?? null,
          cameraMake: metadata.cameraMake ?? null,
          cameraModel: metadata.cameraModel ?? null,
          gpsLatitude: metadata.gpsLatitude ?? null,
          gpsLongitude: metadata.gpsLongitude ?? null,
          ...getPhotoGpsAddressData(gpsAddress),
          metadataJson: metadata.metadataJson ?? null,
          availableForDailyReports,
          uploadedByName: actor.name,
          uploadedByUserId: actor.userId,
        },
      });
      uploadedPublicUrls.push(publicUrl);
    } catch (error) {
      await unlink(absolutePath).catch(() => undefined);
      throw error;
    }
  }

  revalidateProjectPhotoViews(projectId);
  return uploadedPublicUrls;
}

export async function updateProjectPhoto(input: ProjectPhotoUpdateInput) {
  if (!input.id) {
    throw new Error("Foto-ID fehlt.");
  }

  const existingPhoto = await prisma.projectPhoto.findUnique({
    select: { projectId: true },
    where: { id: input.id },
  });
  if (!existingPhoto) throw new Error("Foto wurde nicht gefunden.");
  await requireProjectAccess(existingPhoto.projectId);
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
      uploadedByUserId: true,
    },
  });

  if (!photo) {
    return;
  }
  await requireProjectAccess(photo.projectId);
  await requireProjectContentDeleteOwnership(photo.uploadedByUserId);

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
      uploadedByUserId: true,
    },
  });

  if (photos.length === 0) {
    return;
  }
  for (const photo of photos) {
    await requireProjectAccess(photo.projectId);
    await requireProjectContentDeleteOwnership(photo.uploadedByUserId);
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

export async function createProjectDocumentFolder(
  input: ProjectDocumentFolderCreateInput,
) {
  const projectId = input.projectId.trim();
  const name = cleanFolderName(input.name);

  if (!projectId) {
    throw new Error("Bitte ein Projekt auswählen.");
  }
  await requireProjectAccess(projectId);

  if (!name) {
    throw new Error("Bitte einen Ordnernamen eintragen.");
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

  const sortOrder = await getNextProjectDocumentFolderSortOrder(projectId);

  await prisma.projectDocumentFolder.upsert({
    where: {
      projectId_name: {
        projectId,
        name,
      },
    },
    create: {
      projectId,
      name,
      sortOrder,
    },
    update: {},
  });

  revalidateProjectDocumentViews(projectId);
}

export async function deleteProjectDocumentFolder(
  input: ProjectDocumentFolderDeleteInput,
) {
  const folderId = input.id.trim();

  if (!folderId) {
    throw new Error("Ordner-ID fehlt.");
  }

  const folder = await prisma.projectDocumentFolder.findUnique({
    where: {
      id: folderId,
    },
    select: {
      projectId: true,
    },
  });

  if (!folder) {
    return;
  }

  await prisma.projectDocumentFolder.delete({
    where: {
      id: folderId,
    },
  });

  revalidateProjectDocumentViews(folder.projectId);
}

export async function updateProjectDocumentFolder(
  input: ProjectDocumentFolderUpdateInput,
) {
  const folderId = input.id.trim();
  const name = cleanFolderName(input.name);

  if (!folderId) {
    throw new Error("Ordner-ID fehlt.");
  }

  if (!name) {
    throw new Error("Bitte einen Ordnernamen eintragen.");
  }

  const folder = await prisma.projectDocumentFolder.findUnique({
    where: {
      id: folderId,
    },
    select: {
      projectId: true,
    },
  });

  if (!folder) {
    throw new Error("Ordner wurde nicht gefunden.");
  }

  const duplicateFolder = await prisma.projectDocumentFolder.findFirst({
    where: {
      id: {
        not: folderId,
      },
      name,
      projectId: folder.projectId,
    },
    select: {
      id: true,
    },
  });

  if (duplicateFolder) {
    throw new Error("Ein Ordner mit diesem Namen existiert in diesem Projekt schon.");
  }

  await prisma.projectDocumentFolder.update({
    where: {
      id: folderId,
    },
    data: {
      name,
    },
  });

  revalidateProjectDocumentViews(folder.projectId);
}

export async function uploadProjectDocuments(formData: FormData) {
  const projectId = cleanFormString(formData.get("projectId"));
  const folderId = cleanFormString(formData.get("folderId"));
  const displayName = cleanUploadText(
    cleanFormString(formData.get("displayName")),
  );
  const actor = await getProjectActor();
  const files = formData
    .getAll("documents")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (!projectId) {
    throw new Error("Bitte ein Projekt auswählen.");
  }
  await requireProjectAccess(projectId);

  if (files.length === 0) {
    throw new Error("Bitte mindestens ein Dokument auswählen.");
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

  const targetFolderId = folderId
    ? await getProjectDocumentFolderId(projectId, folderId)
    : null;

  for (const file of files) {
    if (file.size > 100 * 1024 * 1024) {
      throw new Error(`"${file.name}" ist größer als 100 MB.`);
    }
  }

  const uploadDirectory = path.join(
    process.cwd(),
    "public",
    "uploads",
    "project-documents",
    projectId,
  );
  await mkdir(uploadDirectory, { recursive: true });

  for (const [index, file] of files.entries()) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const extension = getDocumentExtension(file);
    const fileName = `${new Date().toISOString().slice(0, 10)}-${randomUUID()}.${extension}`;
    const absolutePath = path.join(uploadDirectory, fileName);
    const storagePath = path.join(
      "public",
      "uploads",
      "project-documents",
      projectId,
      fileName,
    );
    const publicUrl = `/uploads/project-documents/${projectId}/${fileName}`;
    const originalFileName = cleanDocumentFileName(file.name);
    const documentDisplayName = getDocumentDisplayName(
      files.length === 1 ? displayName : "",
      originalFileName,
      index,
    );

    await writeFile(absolutePath, buffer);

    try {
      await prisma.projectDocument.create({
        data: {
          projectId,
          folderId: targetFolderId,
          displayName: documentDisplayName,
          fileName,
          originalFileName,
          publicUrl,
          storagePath,
          mimeType: file.type || "application/octet-stream",
          fileSizeBytes: file.size,
          uploadedByName: actor.name,
          uploadedByUserId: actor.userId,
        },
      });
    } catch (error) {
      await unlink(absolutePath).catch(() => undefined);
      throw error;
    }
  }

  revalidateProjectDocumentViews(projectId);
}

export async function updateProjectDocument(input: ProjectDocumentUpdateInput) {
  if (!input.id) {
    throw new Error("Dokument-ID fehlt.");
  }

  const displayName = cleanUploadText(input.displayName);

  if (!displayName) {
    throw new Error("Name darf nicht leer sein.");
  }
  const existingDocument = await prisma.projectDocument.findUnique({
    select: { projectId: true },
    where: { id: input.id },
  });
  if (!existingDocument) throw new Error("Dokument wurde nicht gefunden.");
  await requireProjectAccess(existingDocument.projectId);

  const document = await prisma.projectDocument.update({
    where: {
      id: input.id,
    },
    data: {
      displayName,
    },
    select: {
      projectId: true,
    },
  });

  revalidateProjectDocumentViews(document.projectId);
}

export async function deleteProjectDocument(id: string) {
  if (!id) {
    throw new Error("Dokument-ID fehlt.");
  }

  const document = await prisma.projectDocument.findUnique({
    where: {
      id,
    },
    select: {
      projectId: true,
      storagePath: true,
      uploadedByUserId: true,
    },
  });

  if (!document) {
    return;
  }
  await requireProjectAccess(document.projectId);
  await requireProjectContentDeleteOwnership(document.uploadedByUserId);

  await prisma.projectDocument.delete({
    where: {
      id,
    },
  });

  try {
    await unlink(path.join(process.cwd(), document.storagePath));
  } catch {
    // Die Datenbank ist führend; eine bereits entfernte Datei blockiert das Löschen nicht.
  }

  revalidateProjectDocumentViews(document.projectId);
}

export async function deleteProjectDocuments(documentIds: string[]) {
  const uniqueDocumentIds = cleanDocumentIds(documentIds);

  if (uniqueDocumentIds.length === 0) {
    throw new Error("Bitte mindestens ein Dokument auswählen.");
  }

  const documents = await prisma.projectDocument.findMany({
    where: {
      id: {
        in: uniqueDocumentIds,
      },
    },
    select: {
      projectId: true,
      storagePath: true,
      uploadedByUserId: true,
    },
  });

  if (documents.length === 0) {
    return;
  }
  for (const document of documents) {
    await requireProjectAccess(document.projectId);
    await requireProjectContentDeleteOwnership(document.uploadedByUserId);
  }

  await prisma.projectDocument.deleteMany({
    where: {
      id: {
        in: uniqueDocumentIds,
      },
    },
  });

  await Promise.all(
    documents.map(async (document) => {
      try {
        await unlink(path.join(process.cwd(), document.storagePath));
      } catch {
        // Die Datenbank ist führend; eine bereits entfernte Datei blockiert das Löschen nicht.
      }
    }),
  );

  for (const projectId of new Set(documents.map((document) => document.projectId))) {
    revalidateProjectDocumentViews(projectId);
  }
}

export async function moveProjectDocuments(input: ProjectDocumentsMoveInput) {
  const uniqueDocumentIds = cleanDocumentIds(input.documentIds);
  const targetProjectId = input.targetProjectId.trim();
  const targetFolderId = input.targetFolderId?.trim() || null;

  if (uniqueDocumentIds.length === 0) {
    throw new Error("Bitte mindestens ein Dokument auswählen.");
  }

  if (!targetProjectId) {
    throw new Error("Bitte eine Zielbaustelle auswählen.");
  }

  const targetProject = await prisma.project.findUnique({
    where: {
      id: targetProjectId,
    },
    select: {
      id: true,
    },
  });

  if (!targetProject) {
    throw new Error("Zielbaustelle wurde nicht gefunden.");
  }

  const resolvedTargetFolderId = targetFolderId
    ? await getProjectDocumentFolderId(targetProjectId, targetFolderId)
    : null;

  const documents = await prisma.projectDocument.findMany({
    where: {
      id: {
        in: uniqueDocumentIds,
      },
    },
    select: {
      fileName: true,
      id: true,
      projectId: true,
      storagePath: true,
    },
  });

  if (documents.length === 0) {
    return;
  }

  const targetDirectory = path.join(
    process.cwd(),
    "public",
    "uploads",
    "project-documents",
    targetProjectId,
  );
  await mkdir(targetDirectory, { recursive: true });

  const affectedProjectIds = new Set<string>([targetProjectId]);

  for (const document of documents) {
    const isProjectChange = document.projectId !== targetProjectId;
    let targetFileName = document.fileName;
    let newPublicUrl: string | undefined;
    let newStoragePath: string | undefined;

    if (isProjectChange) {
      affectedProjectIds.add(document.projectId);
      targetFileName = await getAvailableMovedDocumentFileName(
        targetDirectory,
        document.fileName,
      );
      newStoragePath = path.join(
        "public",
        "uploads",
        "project-documents",
        targetProjectId,
        targetFileName,
      );
      newPublicUrl = `/uploads/project-documents/${targetProjectId}/${targetFileName}`;

      try {
        await rename(
          path.join(process.cwd(), document.storagePath),
          path.join(process.cwd(), newStoragePath),
        );
      } catch {
        // Wenn die Datei extern fehlt, wird wenigstens die Projektzuordnung korrigiert.
      }
    }

    await prisma.projectDocument.update({
      where: {
        id: document.id,
      },
      data: {
        fileName: targetFileName,
        folderId: resolvedTargetFolderId,
        projectId: targetProjectId,
        ...(newPublicUrl && newStoragePath
          ? {
              publicUrl: newPublicUrl,
              storagePath: newStoragePath,
            }
          : {}),
      },
    });
  }

  for (const projectId of affectedProjectIds) {
    revalidateProjectDocumentViews(projectId);
  }
}

export async function createProjectFormTemplate(
  input: ProjectFormTemplateCreateInput,
) {
  const name = cleanProjectFormText(input.name, 120);
  const category = cleanProjectFormText(input.category, 80);
  const description = cleanProjectFormText(input.description, 500);
  const emailRecipients = cleanFormEmailRecipients(input.emailRecipients);
  const fields = cleanProjectFormTemplateFields(input.fields);
  const paperOrientation = cleanProjectFormPaperOrientation(input.paperOrientation);
  const paperSize = cleanProjectFormPaperSize(input.paperSize);

  if (!name) {
    throw new Error("Bitte einen Namen für die Formularvorlage eintragen.");
  }

  if (fields.length === 0) {
    throw new Error("Bitte mindestens ein Feld für die Vorlage anlegen.");
  }

  const result = await prisma.projectFormTemplate.aggregate({
    _max: {
      sortOrder: true,
    },
  });

  const template = await prisma.projectFormTemplate.create({
    data: {
      category: category || null,
      description: description || null,
      fieldsJson: JSON.stringify(fields),
      name,
      paperOrientation,
      paperSize,
      sortOrder: (result._max.sortOrder ?? 0) + 10,
    },
  });

  await prisma.$executeRaw`
    UPDATE ProjectFormTemplate
    SET emailRecipientsJson = ${emailRecipients.length > 0 ? JSON.stringify(emailRecipients) : null}
    WHERE id = ${template.id}
  `;

  revalidateProjectFormViews();
}

export async function updateProjectFormTemplate(
  input: ProjectFormTemplateUpdateInput,
) {
  const templateId = input.id.trim();
  const name = cleanProjectFormText(input.name, 120);
  const category = cleanProjectFormText(input.category, 80);
  const description = cleanProjectFormText(input.description, 500);
  const emailRecipients = cleanFormEmailRecipients(input.emailRecipients);
  const fields = cleanProjectFormTemplateFields(input.fields);
  const paperOrientation = cleanProjectFormPaperOrientation(input.paperOrientation);
  const paperSize = cleanProjectFormPaperSize(input.paperSize);

  if (!templateId) {
    throw new Error("Vorlagen-ID fehlt.");
  }

  if (!name) {
    throw new Error("Bitte einen Namen für die Formularvorlage eintragen.");
  }

  if (fields.length === 0) {
    throw new Error("Bitte mindestens ein Feld für die Vorlage anlegen.");
  }

  await prisma.projectFormTemplate.update({
    where: {
      id: templateId,
    },
    data: {
      category: category || null,
      description: description || null,
      fieldsJson: JSON.stringify(fields),
      name,
      paperOrientation,
      paperSize,
    },
  });

  await prisma.$executeRaw`
    UPDATE ProjectFormTemplate
    SET emailRecipientsJson = ${emailRecipients.length > 0 ? JSON.stringify(emailRecipients) : null}
    WHERE id = ${templateId}
  `;

  revalidateProjectFormViews();
}

export async function deleteProjectFormTemplate(
  input: ProjectFormTemplateDeleteInput,
) {
  const templateId = input.id.trim();

  if (!templateId) {
    throw new Error("Vorlagen-ID fehlt.");
  }

  const template = await prisma.projectFormTemplate.findUnique({
    where: {
      id: templateId,
    },
    select: {
      id: true,
    },
  });

  if (!template) {
    return;
  }

  await prisma.projectFormTemplate.delete({
    where: {
      id: templateId,
    },
  });

  revalidateProjectFormViews();
}

export async function saveProjectFormSubmission(
  input: ProjectFormSubmissionInput,
) {
  const projectId = input.projectId.trim();
  const templateId = input.templateId.trim();

  if (!projectId) {
    throw new Error("Bitte ein Projekt auswählen.");
  }
  await requireProjectAccess(projectId);
  const actor = await getProjectActor();

  if (!templateId) {
    throw new Error("Bitte eine Formularvorlage auswählen.");
  }

  const [project, template] = await Promise.all([
    prisma.project.findUnique({
      where: {
        id: projectId,
      },
      select: {
        id: true,
      },
    }),
    prisma.projectFormTemplate.findFirst({
      where: {
        id: templateId,
        isActive: true,
      },
    }),
  ]);

  if (!project) {
    throw new Error("Projekt wurde nicht gefunden.");
  }

  if (!template) {
    throw new Error("Formularvorlage wurde nicht gefunden.");
  }

  const fields = parseProjectFormFields(template.fieldsJson);

  if (fields.length === 0) {
    throw new Error("Diese Formularvorlage hat keine Felder.");
  }

  const values = cleanProjectFormSubmissionValues(fields, input.values);
  const formDate = cleanProjectFormDate(input.formDate);
  const title =
    cleanProjectFormText(input.title, 140) ||
    `${template.name}${input.formDate ? ` ${input.formDate}` : ""}`;

  const data = {
    createdByName: actor.name,
    createdByUserId: actor.userId,
    formDate,
    projectId,
    status: "SAVED",
    templateId,
    templateSnapshotJson: JSON.stringify({
      category: template.category,
      description: template.description,
      emailRecipients: parseStoredEmailRecipients(template.emailRecipientsJson),
      fields,
      name: template.name,
      paperOrientation: template.paperOrientation,
      paperSize: template.paperSize,
      templateId: template.id,
    }),
    title,
    valuesJson: JSON.stringify(values),
  };

  const submissionId = input.id?.trim();

  if (submissionId) {
    const existingSubmission = await prisma.projectFormSubmission.findUnique({
      where: {
        id: submissionId,
      },
      select: {
        createdByName: true,
        createdByUserId: true,
        id: true,
        projectId: true,
      },
    });

    if (!existingSubmission) {
      throw new Error("Das Formular wurde nicht gefunden.");
    }

    await prisma.projectFormSubmission.update({
      where: {
        id: submissionId,
      },
      data: {
        ...data,
        createdByName: existingSubmission.createdByName ?? actor.name,
        createdByUserId: existingSubmission.createdByUserId ?? actor.userId,
      },
    });

    if (existingSubmission.projectId !== projectId) {
      revalidateProjectFormViews(existingSubmission.projectId);
    }
  } else {
    await prisma.projectFormSubmission.create({
      data,
    });
  }

  revalidateProjectFormViews(projectId);
}

export async function deleteProjectFormSubmission(
  input: ProjectFormSubmissionDeleteInput,
) {
  const submissionId = input.id.trim();

  if (!submissionId) {
    throw new Error("Formular-ID fehlt.");
  }

  const submission = await prisma.projectFormSubmission.findUnique({
    where: {
      id: submissionId,
    },
    select: {
      createdByUserId: true,
      projectId: true,
    },
  });

  if (!submission) {
    return;
  }
  await requireProjectAccess(submission.projectId);
  await requireProjectContentDeleteOwnership(submission.createdByUserId);

  await prisma.projectFormSubmission.delete({
    where: {
      id: submissionId,
    },
  });

  revalidateProjectFormViews(submission.projectId);
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
  const [photos, documents] = await Promise.all([
    prisma.projectPhoto.findMany({
      where: {
        projectId: id,
      },
      select: {
        storagePath: true,
      },
    }),
    prisma.projectDocument.findMany({
      where: {
        projectId: id,
      },
      select: {
        storagePath: true,
      },
    }),
  ]);
  const storagePaths = [
    ...photos.map((photo) => photo.storagePath),
    ...documents.map((document) => document.storagePath),
  ];

  await prisma.$transaction(async (tx) => {
    await tx.shortHaulTour.deleteMany({
      where: {
        projectId: id,
      },
    });

    await tx.shortHaulAssignment.deleteMany({
      where: {
        projectId: id,
      },
    });

    await tx.truckLongHaulEntry.deleteMany({
      where: {
        projectId: id,
      },
    });

    await tx.asphaltDispatchEntry.deleteMany({
      where: {
        projectId: id,
      },
    });

    await tx.asphaltLoadAllocation.deleteMany({
      where: {
        projectId: id,
      },
    });

    await tx.tackCoatLoadAllocation.deleteMany({
      where: {
        projectId: id,
      },
    });

    await tx.specialVehicleDispatchAssignment.deleteMany({
      where: {
        projectId: id,
      },
    });

    await tx.crewPlanningRow.deleteMany({
      where: {
        projectId: id,
      },
    });

    await tx.project.delete({
      where: {
        id,
      },
    });
  });

  await Promise.all(
    storagePaths.map(async (storagePath) => {
      try {
        await unlink(path.join(process.cwd(), storagePath));
      } catch {
        // Die Datenbank ist führend; eine bereits entfernte Datei blockiert das Projektlöschen nicht.
      }
    }),
  );

  revalidateProjectViews();
  revalidatePath("/asphalt-dispatch");
  revalidatePath("/truck-dispatch");
  revalidatePath("/truck-dispatch/short-haul");
  revalidatePath("/truck-dispatch/long-haul");
  revalidatePath("/special-vehicle-dispatch");
  revalidatePath("/crew-dispatch");
  revalidatePath("/equipment-dispatch");
  revalidatePath("/employee-dispatch");
}

function toWeatherDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}

function getDateKeyDifference(fromDateKey: string, toDateKey: string) {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;

  return Math.round(
    (toWeatherDate(toDateKey).getTime() - toWeatherDate(fromDateKey).getTime()) /
      millisecondsPerDay,
  );
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

function buildHourlyWeatherJsonForDate(
  weather: OpenMeteoForecast,
  dateKey: string,
) {
  const times = weather.hourly?.time ?? [];
  const result = {
    precipitation: [] as Array<number | null>,
    temperature_2m: [] as Array<number | null>,
    time: [] as string[],
    weather_code: [] as Array<number | null>,
  };

  times.forEach((time, index) => {
    if (!time.startsWith(dateKey)) return;

    result.time.push(time);
    result.temperature_2m.push(
      toNullableNumber(weather.hourly?.temperature_2m?.[index]),
    );
    result.precipitation.push(
      toNullableNumber(weather.hourly?.precipitation?.[index]),
    );
    result.weather_code.push(
      toNullableInteger(weather.hourly?.weather_code?.[index]),
    );
  });

  return result.time.length > 0 ? JSON.stringify(result) : null;
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

async function compressProjectPhoto(buffer: Buffer, mimeType: string) {
  if (!["image/jpeg", "image/png", "image/webp", "image/heic"].includes(mimeType)) {
    throw new Error(
      "Komprimierung wird für JPEG, PNG, WebP und HEIC unterstützt.",
    );
  }

  try {
    const compressedBuffer = await sharp(buffer)
      .resize({
        fit: "inside",
        height: 2560,
        width: 2560,
        withoutEnlargement: true,
      })
      .keepMetadata()
      .jpeg({
        mozjpeg: true,
        quality: 82,
      })
      .toBuffer();

    return {
      buffer: compressedBuffer,
      extension: "jpg",
      mimeType: "image/jpeg",
    };
  } catch {
    throw new Error(
      "Mindestens ein Foto konnte nicht komprimiert werden. Bitte als Original hochladen.",
    );
  }
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

function cleanDocumentIds(documentIds: string[]) {
  return Array.from(
    new Set(
      documentIds
        .filter((documentId) => typeof documentId === "string")
        .map((documentId) => documentId.trim())
        .filter(Boolean),
    ),
  );
}

function cleanFolderName(value: string) {
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return cleaned.length > 80 ? cleaned.slice(0, 80) : cleaned;
}

function cleanDocumentFileName(value: string) {
  const cleaned =
    value.replace(/[\u0000-\u001f\u007f]/g, "").trim() || "Dokument";
  return cleaned.length > 220 ? cleaned.slice(0, 220) : cleaned;
}

function cleanProjectFormText(value: string, maxLength: number) {
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return cleaned.length > maxLength ? cleaned.slice(0, maxLength) : cleaned;
}

function cleanFormEmailRecipients(values: string[] | undefined) {
  return Array.from(
    new Set(
      (values ?? [])
        .flatMap((value) => String(value ?? "").split(/[\n,;]/))
        .map((value) => cleanProjectFormText(value, 180).toLowerCase())
        .filter(Boolean),
    ),
  );
}

function parseStoredEmailRecipients(value: string | null | undefined) {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((entry) => String(entry ?? "").trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function cleanProjectFormPaperSize(value: string) {
  return value === "A5" ? "A5" : "A4";
}

function cleanProjectFormPaperOrientation(value: string) {
  return value === "LANDSCAPE" ? "LANDSCAPE" : "PORTRAIT";
}

function cleanProjectFormDate(value: string) {
  const cleaned = value.trim();

  if (!cleaned) {
    return null;
  }

  const date = new Date(`${cleaned}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Das Formulardatum ist ungültig.");
  }

  return date;
}

function cleanProjectFormTemplateFields(
  fields: ProjectFormTemplateCreateInput["fields"],
) {
  if (!Array.isArray(fields)) {
    return [];
  }

  const usedIds = new Set<string>();

  return fields
    .slice(0, 60)
    .map((field, index) => {
      const label = cleanProjectFormText(field.label ?? "", 120);

      if (!label) {
        return null;
      }

      const type = PROJECT_FORM_FIELD_TYPES.includes(
        field.type as ProjectFormFieldType,
      )
        ? (field.type as ProjectFormFieldType)
        : "text";
      const options = projectFormFieldUsesOptions(type)
        ? cleanProjectFormFieldOptions(field)
        : getProjectFormPresetOptions(type);

      if (projectFormFieldUsesOptions(type) && options.length === 0) {
        throw new Error(`Auswahlfeld "${label}" braucht mindestens eine Option.`);
      }

      return {
        description: cleanProjectFormText(field.description ?? "", 300),
        id: getProjectFormFieldId(label, index, usedIds),
        label,
        options,
        required: Boolean(field.required),
        type,
        width:
          typeof field.width === "number" &&
          Number.isInteger(field.width) &&
          field.width >= 1 &&
          field.width <= 6
            ? field.width
            : 6,
      } satisfies ProjectFormFieldDefinition;
    })
    .filter((field): field is ProjectFormFieldDefinition => Boolean(field));
}

function cleanProjectFormFieldOptions(
  field: ProjectFormTemplateCreateInput["fields"][number],
) {
  const rawOptions = [
    ...(Array.isArray(field.options) ? field.options : []),
    ...(field.optionsText ? field.optionsText.split(/\r?\n|,/) : []),
  ];
  const seen = new Set<string>();

  return rawOptions
    .map((option) => cleanProjectFormText(option, 80))
    .filter((option) => {
      if (!option || seen.has(option.toLowerCase())) {
        return false;
      }

      seen.add(option.toLowerCase());
      return true;
    })
    .slice(0, 40);
}

function getProjectFormFieldId(
  label: string,
  index: number,
  usedIds: Set<string>,
) {
  const baseId =
    label
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || `feld_${index + 1}`;
  let candidate = baseId;
  let suffix = 2;

  while (usedIds.has(candidate)) {
    candidate = `${baseId}_${suffix}`;
    suffix += 1;
  }

  usedIds.add(candidate);
  return candidate;
}

function cleanProjectFormSubmissionValues(
  fields: ProjectFormFieldDefinition[],
  rawValues: Record<string, boolean | string>,
) {
  const values: Record<string, boolean | string> = {};

  for (const field of fields) {
    if (!projectFormFieldCollectsValue(field.type)) {
      values[field.id] = "";
      continue;
    }

    const rawValue = rawValues[field.id];

    if (field.type === "checkbox") {
      const checked = rawValue === true || rawValue === "true" || rawValue === "on";

      if (field.required && !checked) {
        throw new Error(`Pflichtfeld "${field.label}" ist nicht ausgefüllt.`);
      }

      values[field.id] = checked;
      continue;
    }

    const value =
      typeof rawValue === "string" ? cleanProjectFormText(rawValue, 4000) : "";

    if (field.required && !value) {
      throw new Error(`Pflichtfeld "${field.label}" ist nicht ausgefüllt.`);
    }

    if (
      (projectFormFieldUsesOptions(field.type) ||
        field.type === "trafficlight" ||
        field.type === "grade") &&
      value &&
      field.options.length > 0 &&
      !field.options.includes(value)
    ) {
      throw new Error(`Auswahl für "${field.label}" ist ungültig.`);
    }

    if (
      field.type === "number" &&
      value &&
      !Number.isFinite(Number(value.replace(",", ".")))
    ) {
      throw new Error(`"${field.label}" muss eine Zahl sein.`);
    }

    values[field.id] = value;
  }

  return values;
}

function getDocumentDisplayName(
  displayName: string,
  originalFileName: string,
  index: number,
) {
  if (displayName) {
    return displayName;
  }

  const extension = path.extname(originalFileName);
  const baseName = cleanUploadText(path.basename(originalFileName, extension));

  if (baseName) {
    return baseName;
  }

  return `Dokument ${index + 1}`;
}

function getDocumentExtension(file: File) {
  const extensionFromName = path
    .extname(file.name)
    .replace(".", "")
    .toLowerCase();
  const extensionByMime: Record<string, string> = {
    "application/msword": "doc",
    "application/pdf": "pdf",
    "application/vnd.ms-excel": "xls",
    "application/vnd.ms-powerpoint": "ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation":
      "pptx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      "docx",
    "image/jpeg": "jpg",
    "image/png": "png",
    "text/csv": "csv",
    "text/plain": "txt",
  };

  if (/^[a-z0-9]{1,12}$/.test(extensionFromName)) {
    return extensionFromName === "jpeg" ? "jpg" : extensionFromName;
  }

  return extensionByMime[file.type] ?? "bin";
}

async function getProjectDocumentFolderId(projectId: string, folderId: string) {
  const folder = await prisma.projectDocumentFolder.findFirst({
    where: {
      id: folderId,
      projectId,
    },
    select: {
      id: true,
    },
  });

  if (!folder) {
    throw new Error("Ordner wurde für dieses Projekt nicht gefunden.");
  }

  return folder.id;
}

async function getNextProjectDocumentFolderSortOrder(projectId: string) {
  const result = await prisma.projectDocumentFolder.aggregate({
    where: {
      projectId,
    },
    _max: {
      sortOrder: true,
    },
  });

  return (result._max.sortOrder ?? 0) + 10;
}

async function getProjectActor() {
  const session = await requireSession();
  const user = await prisma.user.findUnique({
    select: {
      employee: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
      name: true,
    },
    where: { id: session.user.id },
  });
  return {
    name: user?.employee
      ? `${user.employee.firstName} ${user.employee.lastName}`
      : user?.name || session.user.name || session.user.email,
    userId: session.user.id,
  };
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

async function getAvailableMovedDocumentFileName(
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
