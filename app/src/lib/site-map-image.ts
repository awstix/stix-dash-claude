import sharp from "sharp";

const TILE_SIZE = 256;

export type SiteMarkerType =
  | "ZUFAHRT"
  | "AUSFAHRT"
  | "ZUFAHRT_AUSFAHRT"
  | "BAUSTELLENEINRICHTUNG";

export const SITE_MARKER_LABELS: Record<SiteMarkerType, string> = {
  AUSFAHRT: "Ausfahrt",
  BAUSTELLENEINRICHTUNG: "Baustelleneinrichtung",
  ZUFAHRT: "Zufahrt",
  ZUFAHRT_AUSFAHRT: "Zufahrt & Ausfahrt",
};

export const SITE_MARKER_COLORS: Record<SiteMarkerType, string> = {
  AUSFAHRT: "#dc2626",
  BAUSTELLENEINRICHTUNG: "#b45309",
  ZUFAHRT: "#16a34a",
  ZUFAHRT_AUSFAHRT: "#7c3aed",
};

type Coordinate = [number, number];

type SiteMarker = {
  latitude: number;
  longitude: number;
  rotationDegrees: number;
  type: SiteMarkerType;
};

type ParsedBoundary = {
  lines: Coordinate[][];
  rings: Coordinate[][];
  siteMarkers: SiteMarker[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSiteMarkerType(value: unknown): value is SiteMarkerType {
  return (
    value === "ZUFAHRT" ||
    value === "AUSFAHRT" ||
    value === "ZUFAHRT_AUSFAHRT" ||
    value === "BAUSTELLENEINRICHTUNG"
  );
}

function normalizeCoordinate(value: unknown): Coordinate | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const lng = Number(value[0]);
  const lat = Number(value[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  return [lng, lat];
}

function normalizeRing(value: unknown): Coordinate[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => normalizeCoordinate(entry))
    .filter((entry): entry is Coordinate => entry !== null);
}

function normalizeRotation(value: number) {
  if (!Number.isFinite(value)) return 0;
  return ((Math.round(value) % 360) + 360) % 360;
}

function collectFeatures(
  value: unknown,
): Array<{ geometry: unknown; properties: Record<string, unknown> }> {
  if (!isRecord(value)) return [];
  if (value.type === "FeatureCollection" && Array.isArray(value.features)) {
    return value.features.flatMap((feature) => collectFeatures(feature));
  }
  if (value.type === "Feature" && "geometry" in value) {
    const properties = isRecord(value.properties) ? value.properties : {};
    return [{ geometry: value.geometry, properties }];
  }
  if (typeof value.type === "string" && "coordinates" in value) {
    return [{ geometry: value, properties: {} }];
  }
  return [];
}

/** Mirrors ProjectMap.tsx's parseBoundaryGeoJson (client component, can't be
 * imported into a route handler) - keep the two in sync if the GeoJSON
 * shape changes. */
function parseBoundaryGeoJson(value: string | null | undefined): ParsedBoundary {
  if (!value?.trim()) return { lines: [], rings: [], siteMarkers: [] };

  try {
    const parsed = JSON.parse(value) as unknown;
    const features = collectFeatures(parsed);
    const rings: Coordinate[][] = [];
    const lines: Coordinate[][] = [];
    const siteMarkers: SiteMarker[] = [];

    for (const { geometry, properties } of features) {
      if (!isRecord(geometry) || typeof geometry.type !== "string") continue;

      if (geometry.type === "Polygon" && Array.isArray(geometry.coordinates)) {
        const ring = normalizeRing((geometry.coordinates as unknown[])[0]);
        if (ring.length >= 3) rings.push(ring);
      }

      if (geometry.type === "MultiPolygon" && Array.isArray(geometry.coordinates)) {
        for (const polygon of geometry.coordinates as unknown[]) {
          const ring = normalizeRing((polygon as unknown[])?.[0]);
          if (ring.length >= 3) rings.push(ring);
        }
      }

      if (geometry.type === "LineString" && Array.isArray(geometry.coordinates)) {
        const line = normalizeRing(geometry.coordinates);
        if (line.length > 0) lines.push(line);
      }

      if (
        geometry.type === "Point" &&
        properties.kind === "site-marker" &&
        isSiteMarkerType(properties.markerType)
      ) {
        const point = normalizeCoordinate(
          (geometry as { coordinates?: unknown }).coordinates,
        );
        if (point) {
          siteMarkers.push({
            latitude: point[1],
            longitude: point[0],
            rotationDegrees: normalizeRotation(Number(properties.rotationDegrees)),
            type: properties.markerType,
          });
        }
      }
    }

    return { lines, rings, siteMarkers };
  } catch {
    return { lines: [], rings: [], siteMarkers: [] };
  }
}

function clampLatitude(lat: number) {
  return Math.min(Math.max(lat, -85.05112878), 85.05112878);
}

function lngLatToPixel(lng: number, lat: number, zoom: number) {
  const sinLat = Math.sin((clampLatitude(lat) * Math.PI) / 180);
  const scale = TILE_SIZE * 2 ** zoom;

  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale,
  };
}

function markerShapeSvg(type: SiteMarkerType, color: string) {
  if (type === "BAUSTELLENEINRICHTUNG") {
    return `<rect x="-9" y="-9" width="18" height="18" rx="4" fill="${color}" stroke="white" stroke-width="2" />`;
  }
  if (type === "ZUFAHRT_AUSFAHRT") {
    return `<path d="M 0 -14 L 8 -2 L 3 -2 L 3 2 L 8 2 L 0 14 L -8 2 L -3 2 L -3 -2 L -8 -2 Z" fill="${color}" stroke="white" stroke-width="2" stroke-linejoin="round" />`;
  }
  return `<path d="M 0 -14 L 8 2 L 3 2 L 3 12 L -3 12 L -3 2 L -8 2 Z" fill="${color}" stroke="white" stroke-width="2" stroke-linejoin="round" />`;
}

/** Renders a static PNG map excerpt (real OSM tiles) fitted so every drawn
 * boundary/line/marker is visible, with the same marker glyphs as the
 * interactive Baufeld editor drawn on top. Falls back to the stored
 * center/zoom when nothing is plotted, or returns null when there's no
 * location at all. */
export async function renderSiteMapImage(input: {
  boundaryGeoJson: string | null;
  height: number;
  latitude: number | null;
  longitude: number | null;
  width: number;
  zoom: number | null;
}): Promise<{ png: Buffer; usedMarkerTypes: SiteMarkerType[] } | null> {
  const boundary = parseBoundaryGeoJson(input.boundaryGeoJson);
  const allPoints: Coordinate[] = [
    ...boundary.rings.flat(),
    ...boundary.lines.flat(),
    ...boundary.siteMarkers.map(
      (marker): Coordinate => [marker.longitude, marker.latitude],
    ),
  ];

  let centerLng: number;
  let centerLat: number;
  let zoom: number;

  if (allPoints.length > 0) {
    const lngs = allPoints.map((point) => point[0]);
    const lats = allPoints.map((point) => point[1]);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    centerLng = (minLng + maxLng) / 2;
    centerLat = (minLat + maxLat) / 2;

    const padding = 56;
    const availableWidth = Math.max(40, input.width - padding * 2);
    const availableHeight = Math.max(40, input.height - padding * 2);
    let bestZoom = 3;
    for (let candidateZoom = 19; candidateZoom >= 3; candidateZoom -= 1) {
      const topLeft = lngLatToPixel(minLng, maxLat, candidateZoom);
      const bottomRight = lngLatToPixel(maxLng, minLat, candidateZoom);
      const bboxWidth = Math.abs(bottomRight.x - topLeft.x);
      const bboxHeight = Math.abs(bottomRight.y - topLeft.y);
      if (bboxWidth <= availableWidth && bboxHeight <= availableHeight) {
        bestZoom = candidateZoom;
        break;
      }
    }
    zoom = bestZoom;
  } else if (input.latitude !== null && input.longitude !== null) {
    centerLng = input.longitude;
    centerLat = input.latitude;
    zoom = input.zoom ?? 17;
  } else {
    return null;
  }

  const center = lngLatToPixel(centerLng, centerLat, zoom);
  const origin = { x: center.x - input.width / 2, y: center.y - input.height / 2 };
  const tileLimit = 2 ** zoom;
  const tileMinX = Math.floor(origin.x / TILE_SIZE);
  const tileMaxX = Math.floor((origin.x + input.width) / TILE_SIZE);
  const tileMinY = Math.floor(origin.y / TILE_SIZE);
  const tileMaxY = Math.floor((origin.y + input.height) / TILE_SIZE);

  const tileLayers: sharp.OverlayOptions[] = [];
  const tileFetches: Promise<void>[] = [];
  for (let tileX = tileMinX; tileX <= tileMaxX; tileX += 1) {
    for (let tileY = tileMinY; tileY <= tileMaxY; tileY += 1) {
      if (tileY < 0 || tileY >= tileLimit) continue;
      const wrappedTileX = ((tileX % tileLimit) + tileLimit) % tileLimit;
      const left = Math.round(tileX * TILE_SIZE - origin.x);
      const top = Math.round(tileY * TILE_SIZE - origin.y);
      tileFetches.push(
        fetch(`https://tile.openstreetmap.org/${zoom}/${wrappedTileX}/${tileY}.png`, {
          headers: { "User-Agent": "stix-dash/0.1 (site-map-pdf-export)" },
        })
          .then(async (response) => {
            if (!response.ok) return;
            const buffer = Buffer.from(await response.arrayBuffer());
            tileLayers.push({ input: buffer, left, top });
          })
          .catch(() => undefined),
      );
    }
  }
  await Promise.all(tileFetches);

  const svgParts: string[] = [];
  for (const ring of boundary.rings) {
    const points = ring
      .map((point) => {
        const pixel = lngLatToPixel(point[0], point[1], zoom);
        return `${(pixel.x - origin.x).toFixed(1)},${(pixel.y - origin.y).toFixed(1)}`;
      })
      .join(" ");
    svgParts.push(
      `<polygon points="${points}" fill="rgba(249,115,22,0.24)" stroke="#ea580c" stroke-width="3" />`,
    );
  }
  for (const line of boundary.lines) {
    const points = line
      .map((point) => {
        const pixel = lngLatToPixel(point[0], point[1], zoom);
        return `${(pixel.x - origin.x).toFixed(1)},${(pixel.y - origin.y).toFixed(1)}`;
      })
      .join(" ");
    svgParts.push(
      `<polyline points="${points}" fill="none" stroke="#ea580c" stroke-width="3" stroke-dasharray="8 6" />`,
    );
  }

  const usedMarkerTypes = new Set<SiteMarkerType>();
  for (const marker of boundary.siteMarkers) {
    usedMarkerTypes.add(marker.type);
    const pixel = lngLatToPixel(marker.longitude, marker.latitude, zoom);
    const x = pixel.x - origin.x;
    const y = pixel.y - origin.y;
    const rotation = marker.type === "BAUSTELLENEINRICHTUNG" ? 0 : marker.rotationDegrees;
    svgParts.push(
      `<g transform="translate(${x.toFixed(1)},${y.toFixed(1)}) rotate(${rotation})">${markerShapeSvg(
        marker.type,
        SITE_MARKER_COLORS[marker.type],
      )}</g>`,
    );
  }

  // Deliberately no <text> here: sharp/librsvg has no reliable system font
  // in the serverless runtime, so any text baked into this raster renders
  // as solid boxes instead of glyphs. The "© OpenStreetMap" attribution
  // is drawn separately as real PDF text by the caller (pdf-lib's embedded
  // font doesn't have this problem).
  const overlaySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${input.width}" height="${input.height}">${svgParts.join(
    "",
  )}</svg>`;

  const png = await sharp({
    create: {
      background: { alpha: 1, b: 232, g: 232, r: 226 },
      channels: 4,
      height: input.height,
      width: input.width,
    },
  })
    .composite([...tileLayers, { input: Buffer.from(overlaySvg) }])
    .png()
    .toBuffer();

  return { png, usedMarkerTypes: Array.from(usedMarkerTypes) };
}
