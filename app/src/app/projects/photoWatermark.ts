export type WatermarkPosition = { col: 0 | 1 | 2; row: 0 | 1 | 2 | 3 };

export const DEFAULT_WATERMARK_POSITION: WatermarkPosition = { col: 2, row: 0 };

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
};

export type WatermarkPhotoInput = {
  publicUrl: string;
  capturedAt: string | null;
  uploadedAt: string;
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

function buildTextLines(photo: WatermarkPhotoInput, fields: WatermarkFields): string[] {
  const lines: string[] = [];
  const timestamp = photo.capturedAt ?? photo.uploadedAt;
  const dateTimeParts = [
    fields.date ? formatDateLine(timestamp) : null,
    fields.time ? formatTimeLine(timestamp) : null,
  ].filter((part): part is string => Boolean(part));
  if (dateTimeParts.length > 0) lines.push(dateTimeParts.join(", "));

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
  ctx.lineWidth = Math.max(1.5, radius * 0.04);
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.font = `${Math.round(radius * 0.32)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  const labelRadius = radius * 0.72;
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

  // Needle points in the direction the photo was taken (0deg = North, up).
  const headingRad = (headingDegrees * Math.PI) / 180;
  const needleLength = radius * 0.62;
  const tipX = centerX + Math.sin(headingRad) * needleLength;
  const tipY = centerY - Math.cos(headingRad) * needleLength;
  const backX = centerX - Math.sin(headingRad) * (needleLength * 0.35);
  const backY = centerY + Math.cos(headingRad) * (needleLength * 0.35);
  const perpRad = headingRad + Math.PI / 2;
  const spread = radius * 0.14;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(backX + Math.sin(perpRad) * spread, backY - Math.cos(perpRad) * spread);
  ctx.lineTo(backX - Math.sin(perpRad) * spread, backY + Math.cos(perpRad) * spread);
  ctx.closePath();
  ctx.fillStyle = "#2dd4bf";
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = Math.max(1, radius * 0.02);
  ctx.stroke();
  ctx.restore();
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
  mapThumbnailDataUrl,
  opacity,
}: {
  photo: WatermarkPhotoInput;
  fields: WatermarkFields;
  position: WatermarkPosition;
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

  const horizontalAlign: CanvasTextAlign =
    position.col === 0 ? "left" : position.col === 2 ? "right" : "center";
  const anchorX =
    position.col === 0
      ? padding
      : position.col === 2
        ? canvas.width - padding
        : canvas.width / 2;

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

  // The text block can land in either bottom corner depending on the
  // chosen position - the compass rose and map thumbnail default to the
  // bottom-left/bottom-right corner respectively, so whichever one would
  // collide with the text picks the free corner instead. If text AND the
  // other graphic already claimed both corners (all three enabled with
  // text placed in a bottom cell), there's no free corner left at all -
  // the map stacks above whichever corner the compass ended up in rather
  // than drawing directly on top of it.
  let leftCornerFree = !(lines.length > 0 && position.row >= 2 && position.col === 0);
  let rightCornerFree = !(lines.length > 0 && position.row >= 2 && position.col === 2);
  let compassOnLeft: boolean | null = null;

  const compassRadius = Math.round(Math.min(canvas.width, canvas.height) * 0.09);
  if (showCompassRose && typeof photo.gpsHeading === "number") {
    compassOnLeft = leftCornerFree ? true : !rightCornerFree;
    if (compassOnLeft) leftCornerFree = false;
    else rightCornerFree = false;
    drawCompassRose(
      ctx,
      compassOnLeft ? padding + compassRadius : canvas.width - padding - compassRadius,
      canvas.height - padding - compassRadius,
      compassRadius,
      photo.gpsHeading,
    );
  }

  if (showMap && mapThumbnailDataUrl) {
    const bothCornersTaken = !leftCornerFree && !rightCornerFree;
    const mapOnRight = bothCornersTaken ? compassOnLeft === false : rightCornerFree;
    if (!bothCornersTaken) {
      if (mapOnRight) rightCornerFree = false;
      else leftCornerFree = false;
    }
    const mapImage = await loadImage(mapThumbnailDataUrl);
    const mapSize = Math.round(Math.min(canvas.width, canvas.height) * 0.22);
    const mapX = mapOnRight ? canvas.width - padding - mapSize : padding;
    const mapY = bothCornersTaken
      ? canvas.height - padding - compassRadius * 2 - Math.round(mapSize * 0.08) - mapSize
      : canvas.height - padding - mapSize;
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = Math.max(2, mapSize * 0.015);
    ctx.drawImage(mapImage, mapX, mapY, mapSize, mapSize);
    ctx.strokeRect(mapX, mapY, mapSize, mapSize);
    ctx.restore();

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
