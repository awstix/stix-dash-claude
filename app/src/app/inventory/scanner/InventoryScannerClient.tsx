"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

type BarcodeDetectorConstructor = new (options?: {
  formats?: string[];
}) => {
  detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>>;
};

type BarcodeDetectorWindow = typeof window & {
  BarcodeDetector?: BarcodeDetectorConstructor & {
    getSupportedFormats?: () => Promise<string[]>;
  };
};

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
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimeoutRef = useRef<number | null>(null);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const [detectorFormats, setDetectorFormats] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [manualValue, setManualValue] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  const [scannedByName, setScannedByName] = useState("Unbekannt");
  const [shouldUseLocation, setShouldUseLocation] = useState(true);
  const [isOpening, setIsOpening] = useState(false);
  const [isPhotoScanning, setIsPhotoScanning] = useState(false);
  const [isSecureContext, setIsSecureContext] = useState<boolean | null>(null);

  useEffect(() => {
    setIsSecureContext(window.isSecureContext);
    const timeout = window.setTimeout(() => {
      void refreshScannerSupport();
    }, 0);

    return () => {
      window.clearTimeout(timeout);
      stopCamera();
    };
  }, []);

  async function refreshScannerSupport() {
    const BarcodeDetector = (window as BarcodeDetectorWindow).BarcodeDetector;
    const hasCameraApi = Boolean(navigator.mediaDevices?.getUserMedia);
    const hasDetector = Boolean(BarcodeDetector);
    setIsSupported(hasCameraApi && hasDetector);

    if (BarcodeDetector?.getSupportedFormats) {
      const formats = await BarcodeDetector.getSupportedFormats().catch(() => []);
      setDetectorFormats(formats);
    } else {
      setDetectorFormats(hasDetector ? ["qr_code"] : []);
    }

    if (navigator.mediaDevices?.enumerateDevices) {
      const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
      setAvailableCameras(devices.filter((device) => device.kind === "videoinput"));
    }
  }

  function stopCamera() {
    if (scanTimeoutRef.current) {
      window.clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setIsScanning(false);
  }

  async function getLocationPayload() {
    if (!shouldUseLocation || !navigator.geolocation) {
      return {};
    }

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          maximumAge: 60_000,
          timeout: 5_000,
        });
      });

      return {
        accuracyMeters: position.coords.accuracy,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
    } catch {
      setError(
        "Standort konnte nicht erfasst werden. Scan wird ohne Standort gespeichert.",
      );
      return {};
    }
  }

  async function recordScan(target: string, rawValue: string) {
    const itemId = getInventoryItemIdFromTarget(target);

    if (!itemId) return false;

    const locationPayload = await getLocationPayload();

    const response = await fetch("/inventory/scanner/log", {
      body: JSON.stringify({
        action: "VIEW",
        itemId,
        rawValue,
        scannedByName,
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

  async function openTarget(rawValue: string) {
    setLastScan(rawValue);
    setIsOpening(true);
    const target = await resolveInventoryTarget(rawValue);

    if (!target) {
      setIsOpening(false);
      setError("Keine gültige Inventar-Objektadresse oder Objekt-ID gefunden.");
      return;
    }

    stopCamera();
    const locationAlertCreated = await recordScan(target, rawValue).catch(() => {
      setError("Scan konnte nicht gespeichert werden. Objekt wird trotzdem geöffnet.");
      return false;
    });
    window.location.href = locationAlertCreated
      ? `${target}?locationAlert=1`
      : target;
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

    const BarcodeDetector = (window as BarcodeDetectorWindow).BarcodeDetector;

    if (!BarcodeDetector || !navigator.mediaDevices) {
      setIsSupported(false);
      setError(
        "Dieser Browser unterstützt den Kamera-Scanner nicht sauber. Bitte Chrome/Android testen oder die Objekt-ID manuell eingeben.",
      );
      return;
    }

    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: selectedCameraId
          ? {
              deviceId: {
                exact: selectedCameraId,
              },
            }
          : {
              facingMode: {
                ideal: "environment",
              },
            },
      });
      streamRef.current = stream;
      await refreshScannerSupport();

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsScanning(true);
      const supportedFormats = BarcodeDetector.getSupportedFormats
        ? await BarcodeDetector.getSupportedFormats().catch(() => [])
        : detectorFormats;
      const desiredFormats = ["data_matrix", "qr_code"].filter(
        (format) => supportedFormats.length === 0 || supportedFormats.includes(format),
      );
      const detector = new BarcodeDetector({
        formats: desiredFormats.length > 0 ? desiredFormats : ["qr_code"],
      });

      const scan = async () => {
        if (!streamRef.current || !videoRef.current) return;

        try {
          const codes = await detector.detect(videoRef.current);
          const firstCode = codes[0]?.rawValue;

          if (firstCode) {
            void openTarget(firstCode);
            return;
          }
        } catch {
          setError(
            "Code konnte gerade nicht gelesen werden. Etikett näher ran, gerade halten oder manuelle Objekt-ID nutzen.",
          );
        }

        scanTimeoutRef.current = window.setTimeout(scan, 450);
      };

      scanTimeoutRef.current = window.setTimeout(scan, 650);
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
      await openTarget(rawValue);
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
    void openTarget(manualValue);
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">QR-Code scannen</h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              Kamera öffnen, Etikett scannen und direkt zum Inventarobjekt springen.
              Wenn der Browser ECC200/DataMatrix nicht kann, bleiben QR-Code
              oder Objekt-ID als stabiler Fallback.
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
              {detectorFormats.length > 0
                ? detectorFormats
                    .filter((format) => ["data_matrix", "qr_code"].includes(format))
                    .map((format) =>
                      format === "data_matrix" ? "ECC200/DataMatrix" : "QR-Code",
                    )
                    .join(" · ") || "keine passenden Formate"
                : isSupported === false
                  ? "nicht verfügbar"
                  : "wird nach Kamerastart geprüft"}
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

        <div className="mt-5 space-y-3 rounded-2xl border border-blue-100 bg-blue-50 p-4">
          <label className="block text-sm font-semibold text-blue-950">
            Gescannt von
            <input
              className="mt-2 w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm text-gray-900"
              onChange={(event) => setScannedByName(event.target.value)}
              placeholder="später automatisch Benutzer"
              value={scannedByName}
            />
          </label>
          <label className="flex items-start gap-2 text-sm font-semibold text-blue-950">
            <input
              checked={shouldUseLocation}
              className="mt-1 h-4 w-4 rounded border-blue-300"
              onChange={(event) => setShouldUseLocation(event.target.checked)}
              type="checkbox"
            />
            <span>
              Standort beim Scan speichern
              <span className="block text-xs font-normal leading-5 text-blue-800">
                Wenn erlaubt, wird GPS mit Genauigkeit gespeichert. Ohne Erlaubnis
                wird der Scan trotzdem protokolliert.
              </span>
            </span>
          </label>
        </div>
      </section>
    </div>
  );
}
