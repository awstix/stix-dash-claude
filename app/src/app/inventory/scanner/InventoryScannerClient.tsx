"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

type BarcodeDetectorConstructor = new (options?: {
  formats?: string[];
}) => {
  detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>>;
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
  const [error, setError] = useState<string | null>(null);
  const [manualValue, setManualValue] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  const [scannedByName, setScannedByName] = useState("Unbekannt");
  const [shouldUseLocation, setShouldUseLocation] = useState(true);
  const [isOpening, setIsOpening] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setIsSupported("BarcodeDetector" in window && Boolean(navigator.mediaDevices));
    }, 0);

    return () => {
      window.clearTimeout(timeout);
      stopCamera();
    };
  }, []);

  function stopCamera() {
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

    const BarcodeDetector = (
      window as typeof window & {
        BarcodeDetector?: BarcodeDetectorConstructor;
      }
    ).BarcodeDetector;

    if (!BarcodeDetector || !navigator.mediaDevices) {
      setIsSupported(false);
      setError(
        "Dieser Browser unterstützt den QR-Scanner nicht. Bitte manuelle Eingabe nutzen.",
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: {
            ideal: "environment",
          },
        },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsScanning(true);
      const detector = new BarcodeDetector({
        formats: ["data_matrix", "qr_code"],
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
          setError("QR-Code konnte gerade nicht gelesen werden.");
        }

        window.setTimeout(scan, 450);
      };

      window.setTimeout(scan, 650);
    } catch {
      setError(
        "Kamera konnte nicht geöffnet werden. Bitte Berechtigung prüfen oder manuelle Eingabe nutzen.",
      );
      stopCamera();
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
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              isSupported === false
                ? "bg-orange-100 text-orange-950"
                : "bg-green-100 text-green-900"
            }`}
          >
            {isSupported === false ? "Fallback" : "QR"}
          </span>
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
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm font-semibold text-orange-950">
            {error}
          </div>
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
          Falls Kamera/Browser nicht mitspielt: QR-Link oder Objekt-ID einfügen.
        </p>

        <form className="mt-5 space-y-3" onSubmit={submitManualCode}>
          <label className="block text-sm font-semibold text-gray-800">
            QR-Inhalt / Objekt-ID
            <input
              className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
              onChange={(event) => setManualValue(event.target.value)}
              placeholder="/inventory/..."
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
