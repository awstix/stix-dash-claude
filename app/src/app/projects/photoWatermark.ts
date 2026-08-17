export type WatermarkPosition = { col: 0 | 1 | 2 | 3; row: 0 | 1 | 2 | 3 };

export const DEFAULT_WATERMARK_POSITION: WatermarkPosition = { col: 3, row: 0 };

export type WatermarkCorner =
  | "auto"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

type ResolvedCorner = Exclude<WatermarkCorner, "auto">;

const ALL_CORNERS: ResolvedCorner[] = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
];

export type WatermarkFields = {
  date: boolean;
  time: boolean;
  address: boolean;
  postalCity: boolean;
  compass: boolean;
  altitude: boolean;
  map: boolean;
  camera: boolean;
  cameraSettings: boolean;
  uploaderName: boolean;
  uploaderNameStyle: "full" | "initials";
};

export const DEFAULT_WATERMARK_FIELDS: WatermarkFields = {
  date: true,
  time: true,
  address: true,
  postalCity: true,
  compass: true,
  altitude: false,
  map: false,
  camera: false,
  cameraSettings: false,
  uploaderName: false,
  uploaderNameStyle: "full",
};

export type WatermarkPhotoInput = {
  publicUrl: string;
  capturedAt: string | null;
  uploadedAt: string;
  uploadedByName: string | null;
  gpsStreet: string | null;
  gpsHouseNumber: string | null;
  gpsPostcode: string | null;
  gpsCity: string | null;
  gpsLatitude: number | null;
  gpsLongitude: number | null;
  gpsHeading: number | null;
  gpsAltitude: number | null;
  cameraMake: string | null;
  cameraModel: string | null;
  cameraAperture: string | null;
  cameraExposureTime: string | null;
  cameraFocalLength: string | null;
  cameraIso: number | null;
};

const COMPASS_DIRECTIONS = [
  "N", "NNO", "NO", "ONO", "O", "OSO", "SO", "SSO",
  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
];

function headingToCardinal(headingDegrees: number) {
  const normalized = ((headingDegrees % 360) + 360) % 360;
  return COMPASS_DIRECTIONS[Math.round(normalized / 22.5) % 16];
}

function formatDateLine(isoDate: string) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    timeZone: "Europe/Berlin",
  }).format(new Date(isoDate));
}

function formatTimeLine(isoDate: string) {
  return new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Berlin",
  }).format(new Date(isoDate));
}

function toInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0]?.toUpperCase())
    .filter(Boolean)
    .join(".")
    .concat(".");
}

function buildTextLines(photo: WatermarkPhotoInput, fields: WatermarkFields): string[] {
  const lines: string[] = [];
  const timestamp = photo.capturedAt ?? photo.uploadedAt;
  const dateTimeParts = [
    fields.date ? formatDateLine(timestamp) : null,
    fields.time ? formatTimeLine(timestamp) : null,
  ].filter((part): part is string => Boolean(part));
  if (dateTimeParts.length > 0) lines.push(dateTimeParts.join(", "));

  if (fields.uploaderName && photo.uploadedByName) {
    lines.push(
      fields.uploaderNameStyle === "initials"
        ? toInitials(photo.uploadedByName)
        : photo.uploadedByName,
    );
  }

  if (fields.compass && typeof photo.gpsHeading === "number") {
    lines.push(`${Math.round(photo.gpsHeading)}° ${headingToCardinal(photo.gpsHeading)}`);
  }

  if (fields.address) {
    const streetLine = [photo.gpsStreet, photo.gpsHouseNumber].filter(Boolean).join(" ");
    if (streetLine) lines.push(streetLine);
  }

  if (fields.postalCity) {
    const cityLine = [photo.gpsPostcode, photo.gpsCity].filter(Boolean).join(" ");
    if (cityLine) lines.push(cityLine);
  }

  if (fields.altitude && typeof photo.gpsAltitude === "number") {
    lines.push(`${Math.round(photo.gpsAltitude)} m ü. NN`);
  }

  if (fields.camera) {
    const cameraLine = [photo.cameraMake, photo.cameraModel].filter(Boolean).join(" ");
    if (cameraLine) lines.push(cameraLine);
  }

  if (fields.cameraSettings) {
    const settingsLine = [
      photo.cameraFocalLength,
      photo.cameraAperture,
      photo.cameraExposureTime,
      photo.cameraIso ? `ISO ${photo.cameraIso}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    if (settingsLine) lines.push(settingsLine);
  }

  return lines;
}

function drawCompassRose(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  headingDegrees: number,
) {
  ctx.save();

  const dialGradient = ctx.createRadialGradient(
    centerX,
    centerY,
    radius * 0.15,
    centerX,
    centerY,
    radius,
  );
  dialGradient.addColorStop(0, "rgba(30,41,59,0.5)");
  dialGradient.addColorStop(1, "rgba(15,23,42,0.78)");
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fillStyle = dialGradient;
  ctx.fill();
  ctx.lineWidth = Math.max(1, radius * 0.05);
  ctx.strokeStyle = "rgba(255,255,255,0.75)";
  ctx.stroke();

  // Tick marks every 30deg, longer + brighter at the four cardinal points.
  for (let degrees = 0; degrees < 360; degrees += 30) {
    const isCardinal = degrees % 90 === 0;
    const rad = (degrees * Math.PI) / 180;
    const outerR = radius * 0.93;
    const innerR = isCardinal ? radius * 0.74 : radius * 0.83;
    ctx.beginPath();
    ctx.moveTo(centerX + Math.sin(rad) * outerR, centerY - Math.cos(rad) * outerR);
    ctx.lineTo(centerX + Math.sin(rad) * innerR, centerY - Math.cos(rad) * innerR);
    ctx.strokeStyle = isCardinal ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)";
    ctx.lineWidth = isCardinal ? Math.max(1, radius * 0.05) : Math.max(0.75, radius * 0.025);
    ctx.stroke();
  }

  ctx.font = `700 ${Math.round(radius * 0.3)}px "Segoe UI", Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  const labelRadius = radius * 0.55;
  const labels: [string, number][] = [
    ["N", 0], ["O", 90], ["S", 180], ["W", 270],
  ];
  for (const [label, angle] of labels) {
    const rad = (angle * Math.PI) / 180;
    ctx.fillText(
      label,
      centerX + Math.sin(rad) * labelRadius,
      centerY - Math.cos(rad) * labelRadius,
    );
  }

  // Two-tone needle (teal tip = where the camera was pointing, pale tail)
  // pivoting on a small center hub - the dial itself stays fixed (N is
  // always up), only the needle rotates to the recorded heading.
  const headingRad = (headingDegrees * Math.PI) / 180;
  const tipLength = radius * 0.68;
  const tailLength = radius * 0.5;
  const width = radius * 0.09;
  const perpRad = headingRad + Math.PI / 2;
  const tipX = centerX + Math.sin(headingRad) * tipLength;
  const tipY = centerY - Math.cos(headingRad) * tipLength;
  const tailX = centerX - Math.sin(headingRad) * tailLength;
  const tailY = centerY + Math.cos(headingRad) * tailLength;
  const leftX = centerX + Math.sin(perpRad) * width;
  const leftY = centerY - Math.cos(perpRad) * width;
  const rightX = centerX - Math.sin(perpRad) * width;
  const rightY = centerY + Math.cos(perpRad) * width;

  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = Math.max(0.75, radius * 0.02);

  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(leftX, leftY);
  ctx.lineTo(rightX, rightY);
  ctx.closePath();
  ctx.fillStyle = "#2dd4bf";
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(tailX, tailY);
  ctx.lineTo(leftX, leftY);
  ctx.lineTo(rightX, rightY);
  ctx.closePath();
  ctx.fillStyle = "rgba(241,245,249,0.92)";
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(centerX, centerY, radius * 0.09, 0, Math.PI * 2);
  ctx.fillStyle = "#f8fafc";
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = Math.max(0.75, radius * 0.02);
  ctx.stroke();

  ctx.restore();
}

/** Static "N" + arrow in a map thumbnail's corner - the map tiles
 * themselves are always north-up (see renderSiteMapImage), so this is
 * just a fixed label affirming that, not something derived per-photo. */
function drawMapNorthIndicator(
  ctx: CanvasRenderingContext2D,
  mapX: number,
  mapY: number,
  mapSize: number,
) {
  ctx.save();
  const cx = mapX + mapSize * 0.16;
  const baseY = mapY + mapSize * 0.28;
  const tipY = mapY + mapSize * 0.09;

  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.lineWidth = Math.max(1.5, mapSize * 0.022);
  ctx.beginPath();
  ctx.moveTo(cx, baseY);
  ctx.lineTo(cx, tipY);
  ctx.stroke();

  const arrowWidth = mapSize * 0.05;
  ctx.beginPath();
  ctx.moveTo(cx, tipY - mapSize * 0.015);
  ctx.lineTo(cx - arrowWidth, tipY + arrowWidth);
  ctx.lineTo(cx + arrowWidth, tipY + arrowWidth);
  ctx.closePath();
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.lineWidth = Math.max(1, mapSize * 0.012);
  ctx.stroke();

  ctx.font = `700 ${Math.round(mapSize * 0.13)}px "Segoe UI", Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.lineWidth = Math.max(1, mapSize * 0.018);
  ctx.strokeText("N", cx, baseY + mapSize * 0.14);
  ctx.fillText("N", cx, baseY + mapSize * 0.14);
  ctx.restore();
}

function textOccupiedCorner(
  position: WatermarkPosition,
  hasText: boolean,
): ResolvedCorner | null {
  if (!hasText) return null;
  const top = position.row <= 1;
  const bottom = position.row >= 2;
  if (top && position.col === 0) return "top-left";
  if (top && position.col === 3) return "top-right";
  if (bottom && position.col === 0) return "bottom-left";
  if (bottom && position.col === 3) return "bottom-right";
  return null;
}

/** Picks a corner for a graphic element (compass rose / map thumbnail):
 * uses the user's chosen corner (or the built-in default for "auto") if
 * it's free, otherwise the first remaining free corner, otherwise falls
 * back to the preferred corner anyway (only happens if every corner is
 * already spoken for). */
function resolveCorner(
  preferred: WatermarkCorner,
  fallbackDefault: ResolvedCorner,
  freeCorners: Set<ResolvedCorner>,
): ResolvedCorner {
  const wanted = preferred === "auto" ? fallbackDefault : preferred;
  if (freeCorners.has(wanted)) return wanted;

  for (const corner of ALL_CORNERS) {
    if (freeCorners.has(corner)) return corner;
  }

  return wanted;
}

function cornerToXY(
  corner: ResolvedCorner,
  size: number,
  padding: number,
  canvasWidth: number,
  canvasHeight: number,
) {
  return {
    x: corner.endsWith("left") ? padding : canvasWidth - padding - size,
    y: corner.startsWith("top") ? padding : canvasHeight - padding - size,
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Foto konnte nicht geladen werden."));
    img.src = src;
  });
}

/** Composites date/time/address/compass/altitude/map info directly onto a
 * copy of the photo, entirely client-side. Text is drawn via canvas
 * fillText (real browser font rendering) rather than server-side - sharp/
 * librsvg has no reliable system font in Vercel's serverless runtime, so
 * baking text into a raster there renders as solid boxes instead of
 * glyphs (see src/lib/site-map-image.ts). The original photo in storage
 * is never touched; this only ever produces a new, separate image. */
export async function renderPhotoWithWatermark({
  photo,
  fields,
  position,
  compassPosition,
  mapPosition,
  mapThumbnailDataUrl,
  opacity,
}: {
  photo: WatermarkPhotoInput;
  fields: WatermarkFields;
  position: WatermarkPosition;
  compassPosition?: WatermarkCorner;
  mapPosition?: WatermarkCorner;
  mapThumbnailDataUrl?: string | null;
  opacity?: number;
}): Promise<Blob> {
  const image = await loadImage(photo.publicUrl);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas wird nicht unterstützt.");

  ctx.drawImage(image, 0, 0);
  // Only the overlay (text/compass/map) respects the opacity slider - the
  // photo itself is always drawn fully opaque above.
  ctx.globalAlpha = Math.min(1, Math.max(0.1, opacity ?? 1));

  const padding = Math.round(Math.min(canvas.width, canvas.height) * 0.03);
  const fontSize = Math.max(14, Math.round(Math.min(canvas.width, canvas.height) * 0.028));
  const lineHeight = Math.round(fontSize * 135 / 1000) + fontSize;

  const lines = buildTextLines(photo, fields);
  const showCompassRose = fields.compass && typeof photo.gpsHeading === "number";
  const showMap = fields.map && Boolean(mapThumbnailDataUrl);

  // 4x4 position grid: the left two columns hug the left edge, the right
  // two hug the right edge - a middle "centered" bucket isn't useful once
  // there's no single center column left.
  const horizontalAlign: CanvasTextAlign = position.col <= 1 ? "left" : "right";
  const anchorX = position.col <= 1 ? padding : canvas.width - padding;

  if (lines.length > 0) {
    ctx.font = `600 ${fontSize}px "Segoe UI", Arial, sans-serif`;
    ctx.textAlign = horizontalAlign;
    ctx.shadowColor = "rgba(0,0,0,0.75)";
    ctx.shadowBlur = fontSize * 0.3;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle = "#ffffff";

    const blockHeight = lines.length * lineHeight;
    const topAnchored = position.row <= 1;
    const startY = topAnchored
      ? padding + fontSize + (position.row === 1 ? (canvas.height - padding * 2) / 3 : 0)
      : canvas.height - padding - blockHeight + fontSize -
        (position.row === 2 ? (canvas.height - padding * 2) / 3 : 0);

    ctx.textBaseline = "alphabetic";
    lines.forEach((line, index) => {
      ctx.fillText(line, anchorX, startY + index * lineHeight);
    });
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
  }

  // Each graphic gets its own corner: the user's choice if given (or a
  // sensible default for "auto"), falling back to whatever corner is
  // still free if that one's already taken by the text block or the
  // other graphic. With 4 corners and at most 3 things wanting one
  // (text, compass, map), an actual overlap essentially never happens.
  const freeCorners = new Set<ResolvedCorner>(ALL_CORNERS);
  const textCorner = textOccupiedCorner(position, lines.length > 0);
  if (textCorner) freeCorners.delete(textCorner);

  const compassRadius = Math.round(Math.min(canvas.width, canvas.height) * 0.065);
  if (showCompassRose && typeof photo.gpsHeading === "number") {
    const corner = resolveCorner(compassPosition ?? "auto", "bottom-left", freeCorners);
    freeCorners.delete(corner);
    const { x, y } = cornerToXY(corner, compassRadius * 2, padding, canvas.width, canvas.height);
    drawCompassRose(ctx, x + compassRadius, y + compassRadius, compassRadius, photo.gpsHeading);
  }

  if (showMap && mapThumbnailDataUrl) {
    const corner = resolveCorner(mapPosition ?? "auto", "bottom-right", freeCorners);
    freeCorners.delete(corner);
    const mapImage = await loadImage(mapThumbnailDataUrl);
    const mapSize = Math.round(Math.min(canvas.width, canvas.height) * 0.22);
    const { x: mapX, y: mapY } = cornerToXY(corner, mapSize, padding, canvas.width, canvas.height);
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = Math.max(2, mapSize * 0.015);
    ctx.drawImage(mapImage, mapX, mapY, mapSize, mapSize);
    ctx.strokeRect(mapX, mapY, mapSize, mapSize);
    ctx.restore();

    drawMapNorthIndicator(ctx, mapX, mapY, mapSize);

    // The map thumbnail is always centered on the photo's own GPS point
    // (see getPhotoMapThumbnail), so the standpoint marker just sits at
    // its center - a heading arrow off of it shows which way the camera
    // was pointing when the map itself doesn't carry text labels for it.
    const markerX = mapX + mapSize / 2;
    const markerY = mapY + mapSize / 2;
    ctx.save();
    if (typeof photo.gpsHeading === "number") {
      const headingRad = (photo.gpsHeading * Math.PI) / 180;
      const arrowLength = mapSize * 0.34;
      const tipX = markerX + Math.sin(headingRad) * arrowLength;
      const tipY = markerY - Math.cos(headingRad) * arrowLength;
      const perpRad = headingRad + Math.PI / 2;
      const spread = mapSize * 0.05;
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(
        markerX + Math.sin(perpRad) * spread,
        markerY - Math.cos(perpRad) * spread,
      );
      ctx.lineTo(
        markerX - Math.sin(perpRad) * spread,
        markerY + Math.cos(perpRad) * spread,
      );
      ctx.closePath();
      ctx.fillStyle = "#2dd4bf";
      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      ctx.lineWidth = Math.max(1, mapSize * 0.012);
      ctx.fill();
      ctx.stroke();
    }
    const dotRadius = Math.max(3, mapSize * 0.035);
    ctx.beginPath();
    ctx.arc(markerX, markerY, dotRadius, 0, Math.PI * 2);
    ctx.fillStyle = "#2dd4bf";
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = Math.max(1, mapSize * 0.012);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Bild konnte nicht erzeugt werden."))),
      "image/jpeg",
      0.92,
    );
  });
}
