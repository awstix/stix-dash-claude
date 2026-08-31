"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";

/** Unterschrift per Finger/Maus auf einem Canvas erfassen - deutlich höher
 * als ein normales Formularfeld, damit sich ordentlich unterschreiben lässt.
 * `name` ist der vollständige Feldname für das versteckte Formularfeld
 * (jeder Formular-Bereich hat sein eigenes Namenspräfix, z.B. "field:xxx"
 * bei Projekten, "value:xxx" bei Werkstatt/Sicherheit). */
export function FormSignaturePad({
  label,
  name,
  required = false,
  value = "",
}: {
  label: string;
  name: string;
  required?: boolean;
  value?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [signature, setSignature] = useState(value);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (!signature) return;
    const image = new window.Image();
    image.onload = () => context.drawImage(image, 0, 0, canvas.width, canvas.height);
    image.src = signature;
  }, [signature]);

  function point(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function start(event: PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    lastPointRef.current = point(event);
  }

  function draw(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    const next = point(event);
    const previous = lastPointRef.current;
    if (!canvas || !context || !next || !previous) return;
    context.strokeStyle = "#111827";
    context.lineWidth = 5;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(previous.x, previous.y);
    context.lineTo(next.x, next.y);
    context.stroke();
    lastPointRef.current = next;
  }

  function finish() {
    const canvas = canvasRef.current;
    if (!canvas || !drawingRef.current) return;
    drawingRef.current = false;
    lastPointRef.current = null;
    setSignature(canvas.toDataURL("image/png"));
  }

  function clear() {
    setSignature("");
  }

  return (
    <div>
      {/* Kein required auf dem versteckten Feld - Browser können die native
          Validierungsmeldung auf einem unsichtbaren Element nicht anzeigen,
          das würde das Absenden nur stumm blockieren. */}
      <input name={name} type="hidden" value={signature} />
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-gray-800">
          {label}
          {required ? <span className="text-red-600"> *</span> : null}
        </span>
        <button
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800"
          onClick={clear}
          type="button"
        >
          Zurücksetzen
        </button>
      </div>
      <canvas
        className="block h-32 w-full touch-none rounded-xl border border-gray-300 bg-white shadow-inner"
        height={220}
        onPointerCancel={finish}
        onPointerDown={start}
        onPointerLeave={finish}
        onPointerMove={draw}
        onPointerUp={finish}
        ref={canvasRef}
        width={720}
      />
    </div>
  );
}
