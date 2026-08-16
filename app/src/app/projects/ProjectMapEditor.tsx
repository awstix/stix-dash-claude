"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SiteContactEntry } from "@/lib/construction-managers";
import type { SiteContactOption } from "@/lib/construction-manager-options";
import { updateProjectMap } from "./actions";
import { ProjectMap } from "./ProjectMap";
import { SiteContactsField } from "./SiteContactsField";

type ProjectMapEditorProps = {
  mapLatitude: number | null;
  mapLongitude: number | null;
  mapZoom: number | null;
  projectId: string;
  siteAddress: string | null;
  siteBoundaryGeoJson: string | null;
  siteContactOptions?: SiteContactOption[];
  siteContacts: SiteContactEntry[];
  siteDirectionsNote: string | null;
};

export function ProjectMapEditor({
  mapLatitude,
  mapLongitude,
  mapZoom,
  projectId,
  siteAddress,
  siteBoundaryGeoJson,
  siteContactOptions = [],
  siteContacts,
  siteDirectionsNote,
}: ProjectMapEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [addressSearchResult, setAddressSearchResult] = useState("");
  const [locationInput, setLocationInput] = useState("");
  const [siteContactsValue, setSiteContactsValue] = useState(siteContacts);
  const [form, setForm] = useState({
    siteAddress: siteAddress ?? "",
    siteDirectionsNote: siteDirectionsNote ?? "",
    mapLatitude: mapLatitude?.toString() ?? "",
    mapLongitude: mapLongitude?.toString() ?? "",
    mapZoom: mapZoom?.toString() ?? "17",
    siteBoundaryGeoJson: siteBoundaryGeoJson ?? "",
  });

  const previewLatitude = parseOptionalNumber(form.mapLatitude);
  const previewLongitude = parseOptionalNumber(form.mapLongitude);
  const previewZoom = parseOptionalNumber(form.mapZoom);
  const openStreetMapHref =
    previewLatitude !== null && previewLongitude !== null
      ? `https://www.openstreetmap.org/#map=${clampZoom(
          previewZoom ?? 17,
        )}/${previewLatitude}/${previewLongitude}`
      : null;
  // Uses coordinates when available (most precise), falls back to the
  // address text otherwise. This is a plain https link, so it works the
  // same everywhere: opens the Google Maps app if installed (iOS/Android),
  // otherwise Google Maps in the browser - the OS decides, not us.
  const directionsHref =
    mapLatitude !== null && mapLongitude !== null
      ? `https://www.google.com/maps/dir/?api=1&destination=${mapLatitude},${mapLongitude}`
      : siteAddress
        ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(siteAddress)}`
        : null;

  function resetForm() {
    setForm({
      siteAddress: siteAddress ?? "",
      siteDirectionsNote: siteDirectionsNote ?? "",
      mapLatitude: mapLatitude?.toString() ?? "",
      mapLongitude: mapLongitude?.toString() ?? "",
      mapZoom: mapZoom?.toString() ?? "17",
      siteBoundaryGeoJson: siteBoundaryGeoJson ?? "",
    });
    setSiteContactsValue(siteContacts);
    setLocationInput("");
    setAddressSearchResult("");
    setIsEditing(false);
  }

  async function searchAddress() {
    const query = form.siteAddress.trim();

    if (!query) {
      alert("Bitte zuerst eine Baustellenadresse eintragen.");
      return;
    }

    setIsSearchingAddress(true);
    setAddressSearchResult("");

    try {
      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("limit", "1");
      url.searchParams.set("countrycodes", "de");
      url.searchParams.set("q", query);

      const response = await fetch(url.toString(), {
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Adresssuche konnte nicht ausgeführt werden.");
      }

      const results = (await response.json()) as NominatimResult[];
      const result = results[0];

      if (!result) {
        alert("Adresse wurde nicht gefunden.");
        return;
      }

      const latitude = Number(result.lat);
      const longitude = Number(result.lon);

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new Error("Adresse wurde gefunden, aber ohne gültige Koordinaten.");
      }

      setForm((current) => ({
        ...current,
        mapLatitude: formatCoordinate(latitude),
        mapLongitude: formatCoordinate(longitude),
        mapZoom: current.mapZoom || "17",
      }));
      setAddressSearchResult(result.display_name);
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Fehler bei der Adresssuche.",
      );
    } finally {
      setIsSearchingAddress(false);
    }
  }

  function applyLocationInput() {
    const parsedLocation = parseLocationInput(locationInput);

    if (!parsedLocation) {
      alert("OSM-Link oder Koordinaten konnten nicht gelesen werden.");
      return;
    }

    setForm((current) => ({
      ...current,
      mapLatitude: formatCoordinate(parsedLocation.latitude),
      mapLongitude: formatCoordinate(parsedLocation.longitude),
      mapZoom:
        parsedLocation.zoom !== null
          ? parsedLocation.zoom.toString()
          : current.mapZoom || "17",
    }));
  }

  function saveMap() {
    startTransition(async () => {
      try {
        await updateProjectMap({
          id: projectId,
          ...form,
          siteContactsJson: JSON.stringify(siteContactsValue),
        });
        setIsEditing(false);
        router.refresh();
      } catch (error) {
        alert(error instanceof Error ? error.message : "Fehler beim Speichern.");
      }
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-semibold text-gray-900">
          Kartenausschnitt
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {directionsHref ? (
            <a
              className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-900 hover:bg-blue-100"
              href={directionsHref}
              rel="noreferrer"
              target="_blank"
            >
              Route zur Baustelle öffnen
            </a>
          ) : null}
          <a
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-50"
            href={`/projects/${projectId}/directions/pdf`}
            rel="noreferrer"
            target="_blank"
          >
            Wegbeschreibung als PDF
          </a>
          <button
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-50"
            onClick={() => setIsEditing((current) => !current)}
            type="button"
          >
            {isEditing ? "Bearbeitung schließen" : "Karte bearbeiten"}
          </button>
        </div>
      </div>

      {!isEditing && siteDirectionsNote ? (
        <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-800">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Wegbeschreibung
          </p>
          <p className="mt-1 whitespace-pre-line">{siteDirectionsNote}</p>
        </div>
      ) : null}

      {!isEditing && siteContacts.length ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Kontaktpersonen
          </p>
          {siteContacts.map((contact, index) => (
            <span
              className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-800"
              key={`${contact.employeeId ?? "manuell"}-${contact.name}-${index}`}
            >
              {contact.name}
            </span>
          ))}
        </div>
      ) : null}

      <ProjectMap
        address={isEditing ? form.siteAddress : siteAddress}
        boundaryGeoJson={
          isEditing ? form.siteBoundaryGeoJson : siteBoundaryGeoJson
        }
        className="mt-3"
        editable={isEditing}
        heightClass={isEditing ? "h-80" : "h-56"}
        latitude={isEditing ? previewLatitude : mapLatitude}
        longitude={isEditing ? previewLongitude : mapLongitude}
        onBoundaryChange={
          isEditing
            ? (value) =>
                setForm((current) => ({
                  ...current,
                  siteBoundaryGeoJson: value,
                }))
            : undefined
        }
        onViewChange={
          isEditing
            ? (view) =>
                setForm((current) => ({
                  ...current,
                  mapLatitude: formatCoordinate(view.latitude),
                  mapLongitude: formatCoordinate(view.longitude),
                  mapZoom: view.zoom.toString(),
                }))
            : undefined
        }
        zoom={isEditing ? previewZoom : mapZoom}
      />

      {isEditing ? (
        <div className="mt-4 space-y-4 rounded-xl border border-gray-200 bg-white p-4">
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700">
                Baustellenadresse
              </label>
              <div className="mt-2 flex flex-col gap-2 lg:flex-row">
                <input
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      siteAddress: event.target.value,
                    }))
                  }
                  placeholder="Straße, Ort oder Baustellenadresse"
                  type="text"
                  value={form.siteAddress}
                />
                <button
                  className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                  disabled={isSearchingAddress}
                  onClick={searchAddress}
                  type="button"
                >
                  {isSearchingAddress ? "Sucht..." : "Adresse suchen"}
                </button>
              </div>
              {addressSearchResult ? (
                <p className="mt-2 text-xs font-medium text-gray-600">
                  Gefunden: {addressSearchResult}
                </p>
              ) : null}
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">
                Wegbeschreibung
              </label>
              <p className="mt-1 text-xs text-gray-500">
                Freitext für Details, die eine Adresse nicht abdeckt, z. B.
                Zufahrt über Feldweg, Tor-Code, Ansprechpartner vor Ort.
              </p>
              <textarea
                className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    siteDirectionsNote: event.target.value,
                  }))
                }
                placeholder="z. B. Zufahrt über den Feldweg hinter der Scheune, Tor-Code 1234"
                rows={3}
                value={form.siteDirectionsNote}
              />
            </div>

            <SiteContactsField
              onChange={setSiteContactsValue}
              options={siteContactOptions}
              value={siteContactsValue}
            />

            <div>
              <details className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                <summary className="cursor-pointer text-sm font-semibold text-gray-800">
                  Erweitert
                </summary>
                <div className="mt-3 flex flex-col gap-2 lg:flex-row">
                  <input
                    className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
                    onChange={(event) => setLocationInput(event.target.value)}
                    placeholder="49.995, 9.146 oder OpenStreetMap-Link"
                    type="text"
                    value={locationInput}
                  />
                  <button
                    className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                    onClick={applyLocationInput}
                    type="button"
                  >
                    Übernehmen
                  </button>
                  {openStreetMapHref ? (
                    <a
                      className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-center text-sm font-semibold text-gray-800 hover:bg-gray-50"
                      href={openStreetMapHref}
                      rel="noreferrer"
                      target="_blank"
                    >
                      In OSM öffnen
                    </a>
                  ) : null}
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <TextField
                    label="Latitude"
                    step="0.000001"
                    type="number"
                    value={form.mapLatitude}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        mapLatitude: value,
                      }))
                    }
                  />
                  <TextField
                    label="Longitude"
                    step="0.000001"
                    type="number"
                    value={form.mapLongitude}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        mapLongitude: value,
                      }))
                    }
                  />
                  <TextField
                    label="Zoom"
                    max="19"
                    min="1"
                    step="1"
                    type="number"
                    value={form.mapZoom}
                    onChange={(value) =>
                      setForm((current) => ({ ...current, mapZoom: value }))
                    }
                  />
                </div>

                <div className="mt-3">
                  <label className="text-sm font-medium text-gray-700">
                    Baufeld GeoJSON
                  </label>
                  <textarea
                    className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 font-mono text-xs text-gray-900 outline-none focus:border-gray-900"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        siteBoundaryGeoJson: event.target.value,
                      }))
                    }
                    rows={5}
                    value={form.siteBoundaryGeoJson}
                  />
                </div>
              </details>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              disabled={isPending}
              onClick={resetForm}
              type="button"
            >
              Abbrechen
            </button>
            <button
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-60"
              disabled={isPending}
              onClick={saveMap}
              type="button"
            >
              {isPending ? "Speichert..." : "Karte speichern"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type NominatimResult = {
  display_name: string;
  lat: string;
  lon: string;
};

function TextField({
  label,
  max,
  min,
  step,
  type = "text",
  value,
  onChange,
}: {
  label: string;
  max?: string;
  min?: string;
  step?: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <input
        className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
        max={max}
        min={min}
        onChange={(event) => onChange(event.target.value)}
        step={step}
        type={type}
        value={value}
      />
    </div>
  );
}

function parseOptionalNumber(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseLocationInput(value: string): {
  latitude: number;
  longitude: number;
  zoom: number | null;
} | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const urlLocation = parseUrlLocation(trimmed);
  if (urlLocation) {
    return urlLocation;
  }

  return parseCoordinatePair(trimmed);
}

function parseUrlLocation(value: string) {
  const urlText =
    value.includes("://") || value.startsWith("www.")
      ? value.replace(/^www\./, "https://www.")
      : value.includes("openstreetmap.org")
        ? `https://${value}`
        : value;

  try {
    const url = new URL(urlText);
    const hashLocation = parseOpenStreetMapHash(url.hash);
    const queryLatitude = parseOptionalNumber(url.searchParams.get("mlat") ?? "");
    const queryLongitude = parseOptionalNumber(url.searchParams.get("mlon") ?? "");

    if (queryLatitude !== null && queryLongitude !== null) {
      return normalizeLocation({
        latitude: queryLatitude,
        longitude: queryLongitude,
        zoom: hashLocation?.zoom ?? parseOptionalNumber(url.searchParams.get("zoom") ?? ""),
      });
    }

    if (hashLocation) {
      return hashLocation;
    }
  } catch {
    const hashLocation = parseOpenStreetMapHash(value);
    if (hashLocation) {
      return hashLocation;
    }
  }

  const atMatch = value.match(
    /@(-?\d+(?:[.,]\d+)?),(-?\d+(?:[.,]\d+)?),(\d+(?:[.,]\d+)?)z?/,
  );

  if (atMatch) {
    return normalizeLocation({
      latitude: parseFloatValue(atMatch[1]),
      longitude: parseFloatValue(atMatch[2]),
      zoom: parseFloatValue(atMatch[3]),
    });
  }

  return null;
}

function parseOpenStreetMapHash(value: string) {
  const match = value.match(
    /#?map=(\d+(?:[.,]\d+)?)\/(-?\d+(?:[.,]\d+)?)\/(-?\d+(?:[.,]\d+)?)/,
  );

  if (!match) {
    return null;
  }

  return normalizeLocation({
    latitude: parseFloatValue(match[2]),
    longitude: parseFloatValue(match[3]),
    zoom: parseFloatValue(match[1]),
  });
}

function parseCoordinatePair(value: string) {
  const separatorMatch = value.match(
    /^\s*(-?\d+(?:[.,]\d+)?)\s*[,;]\s*(-?\d+(?:[.,]\d+)?)\s*$/,
  );
  const whitespaceMatch = value.match(
    /^\s*(-?\d+(?:[.,]\d+)?)\s+(-?\d+(?:[.,]\d+)?)\s*$/,
  );
  const match = separatorMatch ?? whitespaceMatch;

  if (!match) {
    return null;
  }

  return normalizeLocation({
    latitude: parseFloatValue(match[1]),
    longitude: parseFloatValue(match[2]),
    zoom: null,
  });
}

function normalizeLocation(location: {
  latitude: number;
  longitude: number;
  zoom: number | null;
}) {
  if (isValidCoordinate(location.latitude, location.longitude)) {
    return {
      latitude: location.latitude,
      longitude: location.longitude,
      zoom: location.zoom !== null ? clampZoom(location.zoom) : null,
    };
  }

  if (isValidCoordinate(location.longitude, location.latitude)) {
    return {
      latitude: location.longitude,
      longitude: location.latitude,
      zoom: location.zoom !== null ? clampZoom(location.zoom) : null,
    };
  }

  return null;
}

function isValidCoordinate(latitude: number, longitude: number) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180
  );
}

function parseFloatValue(value: string) {
  return Number(value.replace(",", "."));
}

function formatCoordinate(value: number) {
  return (Math.round(value * 1_000_000) / 1_000_000).toFixed(6);
}

function clampZoom(value: number) {
  return Math.min(Math.max(Math.round(value), 1), 19);
}
