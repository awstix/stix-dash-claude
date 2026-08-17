"use client";

import { useEffect, useState } from "react";
import { buildPhotoFileName } from "@/lib/project-photo-file-name";
import {
  getPhotoMapThumbnail,
  getPhotoWatermarkSettings,
  savePhotoWatermarkSettings,
} from "./actions";
import type { ProjectPhotoGalleryItem } from "./ProjectPhotoGallery";
import {
  DEFAULT_WATERMARK_FIELDS,
  DEFAULT_WATERMARK_POSITION,
  renderPhotoWithWatermark,
  type WatermarkFields,
  type WatermarkPhotoInput,
  type WatermarkPosition,
} from "./photoWatermark";

const POSITION_ROWS: WatermarkPosition["row"][] = [0, 1, 2, 3];
const POSITION_COLS: WatermarkPosition["col"][] = [0, 1, 2, 3];

function toWatermarkInput(photo: ProjectPhotoGalleryItem): WatermarkPhotoInput {
  return {
    publicUrl: photo.publicUrl,
    capturedAt: photo.capturedAt,
    uploadedAt: photo.uploadedAt,
    uploadedByName: photo.uploadedByName,
    gpsStreet: photo.gpsStreet,
    gpsHouseNumber: photo.gpsHouseNumber,
    gpsPostcode: photo.gpsPostcode,
    gpsCity: photo.gpsCity,
    gpsLatitude: photo.gpsLatitude,
    gpsLongitude: photo.gpsLongitude,
    gpsHeading: photo.gpsHeading,
    gpsAltitude: photo.gpsAltitude,
    cameraMake: photo.cameraMake,
    cameraModel: photo.cameraModel,
    cameraAperture: photo.cameraAperture,
    cameraExposureTime: photo.cameraExposureTime,
    cameraFocalLength: photo.cameraFocalLength,
    cameraIso: photo.cameraIso,
  };
}

export function PhotoWatermarkDialog({
  onClose,
  photo,
}: {
  onClose: () => void;
  photo: ProjectPhotoGalleryItem;
}) {
  const [fields, setFields] = useState<WatermarkFields>(DEFAULT_WATERMARK_FIELDS);
  const [position, setPosition] = useState<WatermarkPosition>(DEFAULT_WATERMARK_POSITION);
  const [opacity, setOpacity] = useState(1);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapThumbnail, setMapThumbnail] = useState<string | null>(null);

  const hasCompassData = typeof photo.gpsHeading === "number";
  const hasAltitudeData = typeof photo.gpsAltitude === "number";
  const hasLocationData =
    typeof photo.gpsLatitude === "number" && typeof photo.gpsLongitude === "number";
  const hasCameraData = Boolean(photo.cameraMake || photo.cameraModel);
  const hasCameraSettingsData = Boolean(
    photo.cameraFocalLength || photo.cameraAperture || photo.cameraExposureTime || photo.cameraIso,
  );
  const hasUploaderNameData = Boolean(photo.uploadedByName);

  // Loaded once per dialog open - tied to the account (not the browser),
  // so the chosen position/fields/opacity follow the user across devices
  // instead of resetting every time they save photos.
  useEffect(() => {
    let cancelled = false;

    getPhotoWatermarkSettings()
      .then((json) => {
        if (cancelled || !json) return;
        const parsed = JSON.parse(json) as {
          fields?: Partial<WatermarkFields>;
          position?: WatermarkPosition;
          opacity?: number;
        };
        if (parsed.fields) setFields((current) => ({ ...current, ...parsed.fields }));
        if (parsed.position) setPosition(parsed.position);
        if (typeof parsed.opacity === "number") setOpacity(parsed.opacity);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setSettingsLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced so dragging the opacity slider doesn't fire a save per tick.
  useEffect(() => {
    if (!settingsLoaded) return;

    const timeout = setTimeout(() => {
      savePhotoWatermarkSettings(JSON.stringify({ fields, opacity, position })).catch(
        () => undefined,
      );
    }, 600);

    return () => clearTimeout(timeout);
  }, [settingsLoaded, fields, position, opacity]);

  useEffect(() => {
    if (!fields.map || !hasLocationData || mapThumbnail) return;
    getPhotoMapThumbnail({
      latitude: photo.gpsLatitude as number,
      longitude: photo.gpsLongitude as number,
    })
      .then(setMapThumbnail)
      .catch(() => setMapThumbnail(null));
  }, [fields.map, hasLocationData, mapThumbnail, photo.gpsLatitude, photo.gpsLongitude]);

  useEffect(() => {
    let cancelled = false;

    Promise.resolve().then(async () => {
      if (cancelled) return;
      setIsRendering(true);
      setError(null);

      try {
        const blob = await renderPhotoWithWatermark({
          fields,
          mapThumbnailDataUrl: mapThumbnail,
          opacity,
          photo: toWatermarkInput(photo),
          position,
        });
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        setPreviewUrl((current) => {
          if (current) URL.revokeObjectURL(current);
          return url;
        });
      } catch (renderError) {
        if (!cancelled) {
          setError(
            renderError instanceof Error
              ? renderError.message
              : "Vorschau konnte nicht erzeugt werden.",
          );
        }
      } finally {
        if (!cancelled) setIsRendering(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [photo, fields, position, mapThumbnail, opacity]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function toggleField(key: keyof WatermarkFields) {
    setFields((current) => ({ ...current, [key]: !current[key] }));
  }

  function setUploaderNameStyle(style: "full" | "initials") {
    setFields((current) => ({ ...current, uploaderNameStyle: style }));
  }

  async function downloadWithWatermark() {
    setIsDownloading(true);
    try {
      const blob = await renderPhotoWithWatermark({
        fields,
        mapThumbnailDataUrl: mapThumbnail,
        opacity,
        photo: toWatermarkInput(photo),
        position,
      });
      const link = document.createElement("a");
      const objectUrl = URL.createObjectURL(blob);
      link.href = objectUrl;
      link.download = buildPhotoFileName({
        date: new Date(photo.uploadedAt),
        extension: "jpg",
        projectNumber: photo.projectNumber,
        uniqueSuffix: "mit-infos",
        uploadedByName: photo.uploadedByName,
      });
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "Foto konnte nicht heruntergeladen werden.",
      );
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[var(--z-modal-nested)] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-gray-900">Foto mit Infos</h3>
          <button
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-50"
            onClick={onClose}
            type="button"
          >
            Schließen
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[1fr_260px]">
          <div className="relative flex min-h-[240px] items-center justify-center overflow-hidden rounded-xl bg-gray-100">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt="Vorschau mit Infos"
                className="max-h-[60vh] w-full object-contain"
                src={previewUrl}
              />
            ) : (
              <span className="text-sm text-gray-500">
                {isRendering ? "Erzeuge Vorschau..." : "Keine Vorschau verfügbar"}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <div className="text-xs font-semibold uppercase text-gray-500">
                Position
              </div>
              <div
                className="mt-2 grid grid-cols-4 gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1"
                style={{ aspectRatio: "1 / 1" }}
              >
                {POSITION_ROWS.flatMap((row) =>
                  POSITION_COLS.map((col) => {
                    const isSelected = position.row === row && position.col === col;
                    return (
                      <button
                        aria-label={`Position Zeile ${row + 1}, Spalte ${col + 1}`}
                        className={`rounded border ${
                          isSelected
                            ? "border-gray-900 bg-gray-900"
                            : "border-gray-200 bg-white hover:bg-gray-100"
                        }`}
                        key={`${row}-${col}`}
                        onClick={() => setPosition({ col, row })}
                        type="button"
                      />
                    );
                  }),
                )}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase text-gray-500">
                Angezeigte Infos
              </div>
              <div className="mt-2 flex flex-col gap-1.5">
                <WatermarkFieldCheckbox
                  checked={fields.date}
                  label="Datum"
                  onChange={() => toggleField("date")}
                />
                <WatermarkFieldCheckbox
                  checked={fields.time}
                  label="Uhrzeit"
                  onChange={() => toggleField("time")}
                />
                <WatermarkFieldCheckbox
                  checked={fields.address}
                  disabled={!hasLocationData}
                  label="Adresse"
                  onChange={() => toggleField("address")}
                />
                <WatermarkFieldCheckbox
                  checked={fields.postalCity}
                  disabled={!hasLocationData}
                  label="PLZ / Ort"
                  onChange={() => toggleField("postalCity")}
                />
                <WatermarkFieldCheckbox
                  checked={fields.compass}
                  disabled={!hasCompassData}
                  hint={!hasCompassData ? "Keine Ausrichtung im Foto hinterlegt" : undefined}
                  label="Kompass / Ausrichtung"
                  onChange={() => toggleField("compass")}
                />
                <WatermarkFieldCheckbox
                  checked={fields.altitude}
                  disabled={!hasAltitudeData}
                  hint={!hasAltitudeData ? "Keine Höhe im Foto hinterlegt" : undefined}
                  label="Höhe über NN"
                  onChange={() => toggleField("altitude")}
                />
                <WatermarkFieldCheckbox
                  checked={fields.camera}
                  disabled={!hasCameraData}
                  hint={!hasCameraData ? "Keine Kamera-Daten im Foto hinterlegt" : undefined}
                  label="Kamera"
                  onChange={() => toggleField("camera")}
                />
                <WatermarkFieldCheckbox
                  checked={fields.cameraSettings}
                  disabled={!hasCameraSettingsData}
                  hint={
                    !hasCameraSettingsData
                      ? "Keine Kameraeinstellungen im Foto hinterlegt"
                      : undefined
                  }
                  label="Kameraeinstellungen"
                  onChange={() => toggleField("cameraSettings")}
                />
                <WatermarkFieldCheckbox
                  checked={fields.map}
                  disabled={!hasLocationData}
                  label="Kartenausschnitt"
                  onChange={() => toggleField("map")}
                />
                <div>
                  <WatermarkFieldCheckbox
                    checked={fields.uploaderName}
                    disabled={!hasUploaderNameData}
                    hint={!hasUploaderNameData ? "Kein Name beim Foto hinterlegt" : undefined}
                    label="Name (Fotograf)"
                    onChange={() => toggleField("uploaderName")}
                  />
                  {fields.uploaderName && hasUploaderNameData ? (
                    <div className="mt-1.5 flex gap-1 pl-6">
                      <button
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          fields.uploaderNameStyle === "full"
                            ? "bg-gray-900 text-white"
                            : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                        }`}
                        onClick={() => setUploaderNameStyle("full")}
                        type="button"
                      >
                        Vorname Nachname
                      </button>
                      <button
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          fields.uploaderNameStyle === "initials"
                            ? "bg-gray-900 text-white"
                            : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                        }`}
                        onClick={() => setUploaderNameStyle("initials")}
                        type="button"
                      >
                        Nur Initialen
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-semibold uppercase text-gray-500">
                <span>Deckkraft</span>
                <span className="normal-case text-gray-700">
                  {Math.round(opacity * 100)}%
                </span>
              </div>
              <input
                className="mt-2 w-full"
                max={1}
                min={0.2}
                onChange={(event) => setOpacity(Number(event.currentTarget.value))}
                step={0.05}
                type="range"
                value={opacity}
              />
            </div>

            <button
              className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-60"
              disabled={isRendering || isDownloading || !previewUrl}
              onClick={downloadWithWatermark}
              type="button"
            >
              {isDownloading ? "Lädt herunter..." : "Mit Infos herunterladen"}
            </button>
            {error ? <p className="text-xs text-red-600">{error}</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function WatermarkFieldCheckbox({
  checked,
  disabled,
  hint,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  hint?: string;
  label: string;
  onChange: () => void;
}) {
  return (
    <label
      className={`flex items-start gap-2 text-sm ${disabled ? "text-gray-400" : "text-gray-800"}`}
      title={hint}
    >
      <input
        checked={checked && !disabled}
        className="mt-0.5 h-4 w-4"
        disabled={disabled}
        onChange={onChange}
        type="checkbox"
      />
      <span>
        {label}
        {hint ? <span className="block text-xs text-gray-400">{hint}</span> : null}
      </span>
    </label>
  );
}
