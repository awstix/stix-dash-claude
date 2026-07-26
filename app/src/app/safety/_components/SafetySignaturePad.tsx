"use client";

import { useEffect, useRef, useState } from "react";

type Point = {
  x: number;
  y: number;
};

export function SafetySignaturePad({
  action,
  defaultValue,
}: {
  action: (formData: FormData) => void;
  defaultValue?: string | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<Point | null>(null);
  const [signature, setSignature] = useState(defaultValue ?? "");

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 3;
    context.strokeStyle = "#111827";

    if (!signature) {
      return;
    }

    const image = new Image();
    image.onload = () => context.drawImage(image, 0, 0, canvas.width, canvas.height);
    image.src = signature;
  }, [signature]);

  function getPoint(event: React.PointerEvent<HTMLCanvasElement>): Point | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function draw(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    const point = getPoint(event);
    const lastPoint = lastPointRef.current;

    if (!canvas || !context || !point || !lastPoint || !drawingRef.current) {
      return;
    }

    context.beginPath();
    context.moveTo(lastPoint.x, lastPoint.y);
    context.lineTo(point.x, point.y);
    context.stroke();
    lastPointRef.current = point;
  }

  function startDrawing(event: React.PointerEvent<HTMLCanvasElement>) {
    drawingRef.current = true;
    lastPointRef.current = getPoint(event);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function stopDrawing() {
    const canvas = canvasRef.current;
    drawingRef.current = false;
    lastPointRef.current = null;

    if (canvas) {
      setSignature(canvas.toDataURL("image/png"));
    }
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    if (canvas && context) {
      context.clearRect(0, 0, canvas.width, canvas.height);
    }

    setSignature("");
  }

  return (
    <form action={action} className="space-y-3">
      <input name="signatureDataUrl" type="hidden" value={signature} />
      <canvas
        aria-label="Unterschriftfeld"
        className="h-28 w-full touch-none rounded-xl border-2 border-dashed border-gray-300 bg-white"
        height={180}
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={stopDrawing}
        onPointerCancel={stopDrawing}
        ref={canvasRef}
        width={700}
      />
      <div className="flex flex-wrap gap-2">
        <button
          className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          onClick={clearSignature}
          type="button"
        >
          Löschen
        </button>
        <button
          className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
          type="submit"
        >
          Unterschrift speichern
        </button>
      </div>
    </form>
  );
}
