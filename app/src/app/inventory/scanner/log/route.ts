import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveActorNameForSession } from "@/lib/auth-access";

const geocoderUserAgent = "stix-dash/0.1 inventory-scan-location";
const projectMatchRadiusMeters = 750;
let lastReverseGeocodeRequestAt = 0;
const scanLocationCache = new Map<string, ScanLocationAddress | null>();

type NominatimReverseResponse = {
  address?: Record<string, string | undefined>;
  display_name?: string;
  error?: string;
};

type ScanLocationAddress = {
  locationAddressJson: string | null;
  locationAddressLabel: string | null;
  locationCity: string | null;
  locationCountry: string | null;
  locationHouseNumber: string | null;
  locationPostcode: string | null;
  locationReverseGeocodeSource: string | null;
  locationReverseGeocodedAt: Date | null;
  locationStreet: string | null;
};

type ProjectLocationCandidate = {
  id: string;
  name: string;
  projectNumber: string;
  mapLatitude: number | null;
  mapLongitude: number | null;
  siteAddress: string | null;
  siteBoundaryGeoJson: string | null;
};

function optionalString(value: unknown) {
  const text = String(value ?? "").trim();
  return text.length ? text : null;
}

function optionalNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const itemId = optionalString(body?.itemId);

  if (!itemId) {
    return NextResponse.json(
      {
        error: "Inventarobjekt fehlt.",
      },
      {
        status: 400,
      },
    );
  }

  const item = await prisma.inventoryItem.findUnique({
    where: {
      id: itemId,
    },
    select: {
      currentProjectId: true,
      id: true,
      name: true,
      currentProject: {
        select: {
          id: true,
          mapLatitude: true,
          mapLongitude: true,
          name: true,
          projectNumber: true,
          siteAddress: true,
          siteBoundaryGeoJson: true,
        },
      },
    },
  });

  if (!item) {
    return NextResponse.json(
      {
        error: "Inventarobjekt wurde nicht gefunden.",
      },
      {
        status: 404,
      },
    );
  }

  const latitude = optionalNumber(body?.latitude);
  const longitude = optionalNumber(body?.longitude);
  const locationAddress =
    latitude !== null && longitude !== null
      ? await reverseGeocodeScanLocation(latitude, longitude)
      : null;

  const scannedByName = await resolveActorNameForSession(session);
  const scanLog = await prisma.inventoryScanLog.create({
    data: {
      accuracyMeters: optionalNumber(body?.accuracyMeters),
      action: optionalString(body?.action) ?? "VIEW",
      itemId,
      latitude,
      longitude,
      ...getScanLocationAddressData(locationAddress),
      notes: optionalString(body?.notes),
      rawValue: optionalString(body?.rawValue),
      scannedByName,
      scannedByUserId: session.user.id,
      userAgent: request.headers.get("user-agent"),
    },
  });

  const locationAlertCreated =
    latitude !== null && longitude !== null
      ? await createLocationAlertIfNeeded({
          addressLabel: locationAddress?.locationAddressLabel ?? null,
          item,
          latitude,
          longitude,
          scanLogId: scanLog.id,
          scannedByName,
        })
      : false;

  return NextResponse.json({
    locationAlertCreated,
    ok: true,
  });
}

function getScanLocationAddressData(location: ScanLocationAddress | null) {
  return {
    locationAddressJson: location?.locationAddressJson ?? null,
    locationAddressLabel: location?.locationAddressLabel ?? null,
    locationCity: location?.locationCity ?? null,
    locationCountry: location?.locationCountry ?? null,
    locationHouseNumber: location?.locationHouseNumber ?? null,
    locationPostcode: location?.locationPostcode ?? null,
    locationReverseGeocodeSource: location?.locationReverseGeocodeSource ?? null,
    locationReverseGeocodedAt: location?.locationReverseGeocodedAt ?? null,
    locationStreet: location?.locationStreet ?? null,
  };
}

async function createLocationAlertIfNeeded({
  addressLabel,
  item,
  latitude,
  longitude,
  scanLogId,
  scannedByName,
}: {
  addressLabel: string | null;
  item: {
    currentProject: ProjectLocationCandidate | null;
    currentProjectId: string | null;
    id: string;
    name: string;
  };
  latitude: number;
  longitude: number;
  scanLogId: string;
  scannedByName: string;
}) {
  const currentProjectMatch = item.currentProject
    ? getDistanceToProject(latitude, longitude, item.currentProject)
    : null;
  const suggestedProjectMatch = await findNearestProject(latitude, longitude);

  const currentProjectFits =
    currentProjectMatch !== null &&
    currentProjectMatch.distanceMeters <= projectMatchRadiusMeters;
  const suggestedProject =
    suggestedProjectMatch?.project.id === item.currentProjectId
      ? null
      : suggestedProjectMatch;

  const shouldCreateAlert =
    (!item.currentProjectId && suggestedProjectMatch) ||
    (item.currentProjectId && !currentProjectFits);

  if (!shouldCreateAlert) {
    return false;
  }

  const reason = !item.currentProjectId
    ? "NO_DISPOSITION_PROJECT"
    : suggestedProject
      ? "SCAN_PROJECT_DIFFERS_FROM_DISPOSITION"
      : "SCAN_OUTSIDE_DISPOSITION_PROJECT";

  const locationAlert = await prisma.inventoryLocationAlert
    .create({
      data: {
        currentProjectId: item.currentProjectId,
        distanceToCurrentMeters: currentProjectMatch?.distanceMeters ?? null,
        distanceToSuggestedMeters:
          suggestedProjectMatch?.distanceMeters ?? null,
        itemId: item.id,
        reason,
        scanAddressLabel: addressLabel,
        scanLogId,
        scannedByName,
        suggestedProjectId: suggestedProjectMatch?.project.id ?? null,
      },
    })
    .catch(() => null);

  return Boolean(locationAlert);
}

async function findNearestProject(latitude: number, longitude: number) {
  const projects = await prisma.project.findMany({
    where: {
      OR: [
        {
          mapLatitude: {
            not: null,
          },
          mapLongitude: {
            not: null,
          },
        },
        {
          siteBoundaryGeoJson: {
            not: null,
          },
        },
      ],
      status: {
        in: ["ACTIVE", "NOT_STARTED", "PAUSED"],
      },
    },
    select: {
      id: true,
      mapLatitude: true,
      mapLongitude: true,
      name: true,
      projectNumber: true,
      siteAddress: true,
      siteBoundaryGeoJson: true,
    },
  });

  let nearest:
    | {
        distanceMeters: number;
        project: ProjectLocationCandidate;
      }
    | null = null;

  for (const project of projects) {
    const match = getDistanceToProject(latitude, longitude, project);
    if (!match) continue;

    if (!nearest || match.distanceMeters < nearest.distanceMeters) {
      nearest = {
        distanceMeters: match.distanceMeters,
        project,
      };
    }
  }

  return nearest;
}

function getDistanceToProject(
  latitude: number,
  longitude: number,
  project: ProjectLocationCandidate,
) {
  if (isPointInProjectBoundary(latitude, longitude, project.siteBoundaryGeoJson)) {
    return {
      distanceMeters: 0,
      project,
    };
  }

  if (project.mapLatitude === null || project.mapLongitude === null) {
    return null;
  }

  return {
    distanceMeters: distanceMeters(
      latitude,
      longitude,
      project.mapLatitude,
      project.mapLongitude,
    ),
    project,
  };
}

function distanceMeters(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
) {
  const earthRadiusMeters = 6_371_000;
  const lat1 = toRadians(latitudeA);
  const lat2 = toRadians(latitudeB);
  const deltaLat = toRadians(latitudeB - latitudeA);
  const deltaLon = toRadians(longitudeB - longitudeA);

  const haversine =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLon / 2) *
      Math.sin(deltaLon / 2);
  const centralAngle =
    2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));

  return Math.round(earthRadiusMeters * centralAngle);
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function isPointInProjectBoundary(
  latitude: number,
  longitude: number,
  boundaryGeoJson: string | null,
) {
  if (!boundaryGeoJson) return false;

  try {
    const geometry = JSON.parse(boundaryGeoJson) as {
      coordinates?: unknown;
      geometry?: {
        coordinates?: unknown;
        type?: string;
      };
      type?: string;
    };
    const type = geometry.geometry?.type ?? geometry.type;
    const coordinates = geometry.geometry?.coordinates ?? geometry.coordinates;

    if (type === "Polygon" && Array.isArray(coordinates)) {
      return coordinates.some((ring) =>
        pointInPolygonRing(longitude, latitude, ring),
      );
    }

    if (type === "MultiPolygon" && Array.isArray(coordinates)) {
      return coordinates.some(
        (polygon) =>
          Array.isArray(polygon) &&
          polygon.some((ring) => pointInPolygonRing(longitude, latitude, ring)),
      );
    }
  } catch {
    return false;
  }

  return false;
}

function pointInPolygonRing(
  longitude: number,
  latitude: number,
  ring: unknown,
) {
  if (!Array.isArray(ring)) return false;

  let isInside = false;
  for (let index = 0, previousIndex = ring.length - 1; index < ring.length; previousIndex = index++) {
    const current = ring[index];
    const previous = ring[previousIndex];

    if (!Array.isArray(current) || !Array.isArray(previous)) continue;

    const currentLongitude = Number(current[0]);
    const currentLatitude = Number(current[1]);
    const previousLongitude = Number(previous[0]);
    const previousLatitude = Number(previous[1]);

    if (
      !Number.isFinite(currentLongitude) ||
      !Number.isFinite(currentLatitude) ||
      !Number.isFinite(previousLongitude) ||
      !Number.isFinite(previousLatitude)
    ) {
      continue;
    }

    const intersects =
      currentLatitude > latitude !== previousLatitude > latitude &&
      longitude <
        ((previousLongitude - currentLongitude) *
          (latitude - currentLatitude)) /
          (previousLatitude - currentLatitude) +
          currentLongitude;

    if (intersects) {
      isInside = !isInside;
    }
  }

  return isInside;
}

async function reverseGeocodeScanLocation(
  latitude: number,
  longitude: number,
): Promise<ScanLocationAddress | null> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const cacheKey = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
  if (scanLocationCache.has(cacheKey)) {
    return scanLocationCache.get(cacheKey) ?? null;
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
      scanLocationCache.set(cacheKey, null);
      return null;
    }

    const data = (await response.json()) as NominatimReverseResponse;
    const result = normalizeNominatimScanLocation(data);
    scanLocationCache.set(cacheKey, result);
    return result;
  } catch {
    scanLocationCache.set(cacheKey, null);
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

function normalizeNominatimScanLocation(
  data: NominatimReverseResponse,
): ScanLocationAddress | null {
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
    [streetLine, cityLine].filter(Boolean).join(", ") ||
    country ||
    cleanGeocoderText(data.display_name);

  return {
    locationAddressJson: cleanGeocoderJson(data),
    locationAddressLabel: addressLabel || null,
    locationCity: city,
    locationCountry: country,
    locationHouseNumber: houseNumber,
    locationPostcode: postcode,
    locationReverseGeocodeSource: "NOMINATIM",
    locationReverseGeocodedAt: new Date(),
    locationStreet: street,
  };
}

function getAddressPart(
  address: Record<string, string | undefined>,
  keys: string[],
) {
  for (const key of keys) {
    const value = cleanGeocoderText(address[key]);

    if (value) return value;
  }

  return null;
}

function cleanGeocoderText(value: unknown) {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, 500) : null;
}

function cleanGeocoderJson(value: unknown) {
  try {
    return JSON.stringify(value).slice(0, 10_000);
  } catch {
    return null;
  }
}
