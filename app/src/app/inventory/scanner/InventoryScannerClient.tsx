"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { IScannerControls } from "@zxing/browser";

class LocationRequiredError extends Error {}

function getInventoryTarget(value: string) {
  const text = value.trim();

  if (!text) return null;

  try {
    const url = new URL(text);
    const match = url.pathname.match(/^\/inventory\/([^/]+)$/);

    if (match?.[1]) {
      return `/inventory/${match[1]}`;
    }
  } catch {
    // plain object id or copied path
  }

  const pathMatch = text.match(/^\/?inventory\/([^/\s]+)$/);
  if (pathMatch?.[1]) return `/inventory/${pathMatch[1]}`;

  if (/^[a-z0-9]{8,}$/i.test(text)) {
    return `/inventory/${text}`;
  }

  return null;
}

async function resolveInventoryTarget(value: string) {
  const directTarget = getInventoryTarget(value);

  if (directTarget) return directTarget;

  const text = value.trim();

  if (!text) return null;

  const response = await fetch(
    `/inventory/scanner/resolve?q=${encodeURIComponent(text)}`,
  );

  if (!response.ok) return null;

  const payload = (await response.json()) as {
    target?: string | null;
  };

  return payload.target ?? null;
}

function getInventoryItemIdFromTarget(target: string) {
  return target.match(/^\/inventory\/([^/]+)$/)?.[1] ?? null;
}

export function InventoryScannerClient() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [manualValue, setManualValue] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  const [isOpening, setIsOpening] = useState(false);
  const [isPhotoScanning, setIsPhotoScanning] = useState(false);
  const [isSecureContext, setIsSecureContext] = useState<boolean | null>(null);
  // Kamera-/Foto-Scan brauchen den Standort zwingend (steuert die
  // automatische Baustellen-Abgleich-Warnung serverseitig) - schlägt der
  // Standort fehl, wird der Scan blockiert statt ihn stillschweigend ohne
  // Standort zu speichern. Manuelle Eingabe bleibt best-effort (kein Scan
  // im eigentlichen Sinn, z.B. Nachschlagen vom Büro-PC ohne GPS).
  const [locationBlockedError, setLocationBlockedError] = useState<string | null>(null);
  const [isRetryingLocation, setIsRetryingLocation] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setIsSecureContext(window.isSecureContext);
      void refreshScannerSupport();
    }, 0);

    return () => {
      window.clearTimeout(timeout);
      stopCamera();
    };
  }, []);

  async function refreshScannerSupport() {
    // Decoding itself runs in pure JS via @zxing/browser, so it works the
    // same everywhere (Safari/iOS included) once the browser can hand us a
    // camera stream at all - no more native-BarcodeDetector dependency,
    // which only Chromium browsers implemented and left iPhones stuck on
    // the photo-only fallback.
    const hasCameraApi = Boolean(navigator.mediaDevices?.getUserMedia);
    setIsSupported(hasCameraApi);

    if (navigator.mediaDevices?.enumerateDevices) {
      const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
      setAvailableCameras(devices.filter((device) => device.kind === "videoinput"));
    }
  }

  function stopCamera() {
    // controls.stop() (from @zxing/browser) stops the scan loop, stops all
    // media tracks and detaches the video element's srcObject - no manual
    // stream/track bookkeeping needed here anymore.
    controlsRef.current?.stop();
    controlsRef.current = null;
    setIsScanning(false);
  }

  function describeGeolocationError(geoError: unknown) {
    if (
      geoError &&
      typeof geoError === "object" &&
      "code" in geoError &&
      (geoError as GeolocationPositionError).code === 1
    ) {
      return "Standort-Zugriff wurde blockiert. Bitte für diese Seite erlauben (Anleitung unten) und erneut versuchen.";
    }
    return "Standort konnte nicht ermittelt werden (z. B. schwaches GPS-Signal). Bitte erneut versuchen, möglichst im Freien.";
  }

  async function getLocationPayload(required: boolean) {
    if (!navigator.geolocation) {
      if (required) {
        throw new LocationRequiredError(
          "Dieses Gerät/dieser Browser unterstützt keine Standortermittlung.",
        );
      }
      return {};
    }

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          maximumAge: 60_000,
          timeout: 8_000,
        });
      });

      return {
        accuracyMeters: position.coords.accuracy,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
    } catch (geoError) {
      if (required) {
        throw new LocationRequiredError(describeGeolocationError(geoError));
      }
      return {};
    }
  }

  async function recordScan(target: string, rawValue: string, requireLocation: boolean) {
    const itemId = getInventoryItemIdFromTarget(target);

    if (!itemId) return false;

    const locationPayload = await getLocationPayload(requireLocation);

    const response = await fetch("/inventory/scanner/log", {
      body: JSON.stringify({
        action: "VIEW",
        itemId,
        rawValue,
        ...locationPayload,
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    if (!response.ok) return false;

    const payload = (await response.json().catch(() => null)) as {
      locationAlertCreated?: boolean;
    } | null;

    return Boolean(payload?.locationAlertCreated);
  }

  async function openTarget(rawValue: string, requireLocation: boolean) {
    setLastScan(rawValue);
    setError(null);
    setLocationBlockedError(null);
    setIsOpening(true);
    const target = await resolveInventoryTarget(rawValue);

    if (!target) {
      setIsOpening(false);
      setError("Keine gültige Inventar-Objektadresse oder Objekt-ID gefunden.");
      return;
    }

    stopCamera();

    try {
      const locationAlertCreated = await recordScan(target, rawValue, requireLocation);
      window.location.href = locationAlertCreated ? `${target}?locationAlert=1` : target;
    } catch (recordError) {
      if (recordError instanceof LocationRequiredError) {
        setIsOpening(false);
        setLocationBlockedError(recordError.message);
        return;
      }
      setError("Scan konnte nicht gespeichert werden. Objekt wird trotzdem geöffnet.");
      window.location.href = target;
    }
  }

  function retryLocationAndOpen() {
    if (!lastScan) return;
    setIsRetryingLocation(true);
    void openTarget(lastScan, true).finally(() => setIsRetryingLocation(false));
  }

  async function startCamera() {
    setError(null);

    if (!window.isSecureContext) {
      setIsSupported(false);
      setError(
        "Der Live-Scanner benötigt HTTPS. Nutze auf dem Tablet „Code fotografieren“ – das funktioniert auch im lokalen WLAN.",
      );
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setIsSupported(false);
      setError(
        "Dieser Browser unterstützt den Kamera-Scanner nicht. Bitte „Code fotografieren“ oder die Objekt-ID manuell eingeben.",
      );
      return;
    }

    try {
      stopCamera();

      const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType, NotFoundException }] =
        await Promise.all([import("@zxing/browser"), import("@zxing/library")]);

      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.QR_CODE,
        BarcodeFormat.DATA_MATRIX,
      ]);
      const reader = new BrowserMultiFormatReader(hints, {
        delayBetweenScanAttempts: 300,
        delayBetweenScanSuccess: 1500,
      });

      setIsScanning(true);

      const controls = await reader.decodeFromConstraints(
        {
          audio: false,
          video: selectedCameraId
            ? { deviceId: { exact: selectedCameraId } }
            : { facingMode: { ideal: "environment" } },
        },
        videoRef.current ?? undefined,
        (result, decodeError, scanControls) => {
          if (result) {
            scanControls.stop();
            controlsRef.current = null;
            setIsScanning(false);
            void openTarget(result.getText(), true);
            return;
          }

          // NotFoundException just means "no code in this frame yet" -
          // fires constantly while scanning and is not an actual error.
          if (decodeError && !(decodeError instanceof NotFoundException)) {
            setError(
              "Code konnte gerade nicht gelesen werden. Etikett näher ran, gerade halten oder manuelle Objekt-ID nutzen.",
            );
          }
        },
      );

      controlsRef.current = controls;
      await refreshScannerSupport();
    } catch {
      setError(
        "Kamera konnte nicht geöffnet werden. Bitte Berechtigung prüfen, andere Kamera wählen oder manuelle Eingabe nutzen.",
      );
      stopCamera();
    }
  }

  async function scanPhoto(file: File | null) {
    if (!file) return;
    setError(null);
    setIsPhotoScanning(true);
    const imageUrl = URL.createObjectURL(file);
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      const result = await reader.decodeFromImageUrl(imageUrl);
      const rawValue = result.getText();
      if (!rawValue) {
        throw new Error("Kein Code erkannt");
      }
      await openTarget(rawValue, true);
    } catch {
      setError(
        "Auf dem Foto wurde kein lesbarer QR- oder DataMatrix-Code erkannt. Bitte Code gerade, vollständig und bei gutem Licht fotografieren.",
      );
    } finally {
      URL.revokeObjectURL(imageUrl);
      setIsPhotoScanning(false);
    }
  }

  function submitManualCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void openTarget(manualValue, false);
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">QR-Code scannen</h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              Kamera öffnen, Etikett scannen und direkt zum Inventarobjekt
              springen. Funktioniert auf iPhone und Android. Falls die Kamera
              mal nicht mitspielt, bleiben „Code fotografieren“ oder die
              Objekt-ID als stabiler Fallback.
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              isSupported === false
                ? "bg-orange-100 text-orange-950"
                : "bg-green-100 text-green-900"
            }`}
          >
            {isSupported === false ? "Fallback" : "Scanner bereit"}
          </span>
        </div>

        <div className="mt-4 rounded-2xl border-2 border-blue-300 bg-blue-50 p-4">
          <p className="text-sm font-bold text-blue-950">
            📍 Standort ist beim Scannen zwingend erforderlich
          </p>
          <p className="mt-1 text-xs leading-5 text-blue-900">
            Nur so kann automatisch erkannt werden, wenn ein Objekt auf der falschen
            Baustelle steht. Beim ersten Scan fragt der Browser nach der
            Standort-Berechtigung – bitte „Erlauben“ antippen. Ohne Standort wird der
            Scan (Kamera/Foto) nicht gespeichert.
          </p>
          <details className="mt-3 text-xs text-blue-900">
            <summary className="cursor-pointer font-semibold">
              Standort ist deaktiviert oder wurde blockiert? So aktivierst du ihn
            </summary>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-blue-200 bg-white p-3">
                <p className="font-bold text-blue-950">Android (Chrome)</p>
                <ol className="mt-1.5 list-decimal space-y-1 pl-4 leading-5">
                  <li>Schloss-/Info-Symbol links in der Adressleiste antippen.</li>
                  <li>„Berechtigungen“ → „Standort“ → „Zulassen“ wählen.</li>
                  <li>
                    Falls die Seite gar nicht auftaucht: Chrome-Menü (⋮) →
                    Einstellungen → Website-Einstellungen → Standort → diese Seite
                    suchen und erlauben.
                  </li>
                  <li>
                    Zusätzlich prüfen: Handy-Einstellungen → Apps → Chrome →
                    Berechtigungen → Standort auf „Nur bei Nutzung der App“ oder
                    „Immer“, und der Standortdienst des Handys selbst muss an sein.
                  </li>
                </ol>
              </div>
              <div className="rounded-xl border border-blue-200 bg-white p-3">
                <p className="font-bold text-blue-950">iPhone (Safari)</p>
                <ol className="mt-1.5 list-decimal space-y-1 pl-4 leading-5">
                  <li>
                    Einstellungen → Datenschutz &amp; Sicherheit → Ortungsdienste →
                    sicherstellen, dass Ortungsdienste generell an sind.
                  </li>
                  <li>
                    Dort runterscrollen zu „Safari-Websites“ → „Beim Verwenden der
                    App fragen“ auswählen.
                  </li>
                  <li>
                    Zurück in Safari auf dieser Seite erneut scannen – die
                    Standortabfrage erscheint wieder, „Erlauben“ antippen.
                  </li>
                  <li>
                    Schon einmal „Nicht erlauben“ gewählt? In Safari auf „aA“ in der
                    Adressleiste → „Website-Einstellungen“ → Standort auf
                    „Erlauben“ stellen.
                  </li>
                </ol>
              </div>
            </div>
          </details>
        </div>

        {locationBlockedError ? (
          <div className="mt-4 rounded-2xl border-2 border-red-300 bg-red-50 p-4">
            <p className="text-sm font-bold text-red-950">
              Scan nicht gespeichert – Standort fehlt
            </p>
            <p className="mt-1 text-xs leading-5 text-red-900">{locationBlockedError}</p>
            <button
              className="mt-3 rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:cursor-wait disabled:opacity-70"
              disabled={isRetryingLocation || !lastScan}
              onClick={retryLocationAndOpen}
              type="button"
            >
              {isRetryingLocation ? "Versucht erneut..." : "Standort erneut versuchen"}
            </button>
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm md:grid-cols-2">
          <label className="font-semibold text-gray-800">
            Kamera
            <select
              className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              disabled={isScanning}
              onChange={(event) => setSelectedCameraId(event.currentTarget.value)}
              value={selectedCameraId}
            >
              <option value="">Automatisch / Rückkamera bevorzugt</option>
              {availableCameras.map((camera, index) => (
                <option key={camera.deviceId || index} value={camera.deviceId}>
                  {camera.label || `Kamera ${index + 1}`}
                </option>
              ))}
            </select>
          </label>
          <div className="font-semibold text-gray-800">
            Unterstützte Codes
            <div className="mt-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600">
              {isSupported === false ? "nicht verfügbar" : "QR-Code · ECC200/DataMatrix"}
            </div>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-gray-200 bg-gray-950">
          <video
            className="aspect-video w-full object-cover"
            muted
            playsInline
            ref={videoRef}
          />
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <label className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white hover:bg-blue-600">
            {isPhotoScanning ? "Foto wird gelesen …" : "Code fotografieren"}
            <input
              accept="image/*"
              capture="environment"
              className="sr-only"
              disabled={isPhotoScanning || isOpening}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0] ?? null;
                event.currentTarget.value = "";
                void scanPhoto(file);
              }}
              type="file"
            />
          </label>
          {isScanning ? (
            <button
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              onClick={stopCamera}
              type="button"
            >
              Kamera stoppen
            </button>
          ) : (
            <button
              className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
              onClick={startCamera}
              type="button"
            >
              Kamera starten
            </button>
          )}
          <button
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            onClick={() => void refreshScannerSupport()}
            type="button"
          >
            Kameras aktualisieren
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm font-semibold text-orange-950">
            {error}
          </div>
        ) : null}

        {isSecureContext === false ? (
          <p className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-950">
            Tablet im lokalen WLAN: Bitte „Code fotografieren“ verwenden. Der
            Live-Videostream wird von iOS und Android über HTTP blockiert.
          </p>
        ) : null}

        {lastScan ? (
          <div className="mt-4 rounded-xl bg-gray-50 p-4 text-xs text-gray-600">
            Letzter Scan:{" "}
            <span className="break-all font-mono text-gray-900">{lastScan}</span>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">Manuelle Eingabe</h2>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          Falls Kamera/Browser nicht mitspielt: QR-Link, Objekt-ID,
          Inventarnummer, STIX-ID oder Seriennummer eingeben.
        </p>

        <form className="mt-5 space-y-3" onSubmit={submitManualCode}>
          <label className="block text-sm font-semibold text-gray-800">
            QR-Inhalt / Objekt-ID
            <input
              className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
              onChange={(event) => setManualValue(event.target.value)}
              placeholder="z. B. 100007, INV29394, STIX-ID oder /inventory/..."
              value={manualValue}
            />
          </label>
          <button
            className="w-full rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
            disabled={isOpening}
            type="submit"
          >
            {isOpening ? "Öffne..." : "Objekt öffnen"}
          </button>
        </form>

        <p className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-xs leading-5 text-blue-900">
          Manuelle Eingabe ist kein physischer Scan (z. B. Nachschlagen vom Büro-PC) –
          Standort wird hier nur miterfasst, wenn er ohnehin verfügbar ist, ist aber
          nicht zwingend erforderlich.
        </p>
      </section>
    </div>
  );
}
