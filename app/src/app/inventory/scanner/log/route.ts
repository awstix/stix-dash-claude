import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const geocoderUserAgent = "stix-dash/0.1 inventory-scan-location";
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
      id: true,
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

  await prisma.inventoryScanLog.create({
    data: {
      accuracyMeters: optionalNumber(body?.accuracyMeters),
      action: optionalString(body?.action) ?? "VIEW",
      itemId,
      latitude,
      longitude,
      ...getScanLocationAddressData(locationAddress),
      notes: optionalString(body?.notes),
      rawValue: optionalString(body?.rawValue),
      scannedByName: optionalString(body?.scannedByName) ?? "Unbekannt",
      userAgent: request.headers.get("user-agent"),
    },
  });

  return NextResponse.json({
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
