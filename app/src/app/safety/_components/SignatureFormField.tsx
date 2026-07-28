"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Point = {
  x: number;
  y: number;
};

export function SignatureFormField({
  form,
  label,
  name,
  onChange,
  value,
}: {
  form?: string;
  label: string;
  name: string;
  onChange?: (value: string) => void;
  value?: string | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<Point | null>(null);
  const [signature, setSignature] = useState(value ?? "");

  useEffect(() => {
    setSignature(value ?? "");
  }, [value]);

  const prepareCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const nextWidth = Math.max(1, Math.round(rect.width * ratio));
    const nextHeight = Math.max(1, Math.round(rect.height * ratio));

    if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
      canvas.width = nextWidth;
      canvas.height = nextHeight;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 3 * ratio;
    context.strokeStyle = "#111827";

    if (!signature) {
      return;
    }

    const image = new Image();
    image.onload = () => context.drawImage(image, 0, 0, canvas.width, canvas.height);
    image.src = signature;
  }, [signature]);

  useEffect(() => {
    prepareCanvas();
  }, [prepareCanvas]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const observer = new ResizeObserver(() => {
      prepareCanvas();
    });

    observer.observe(canvas);

    return () => observer.disconnect();
  }, [prepareCanvas]);

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
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
    const currentPoint = point(event);
    const previousPoint = lastPointRef.current;

    if (!canvas || !context || !currentPoint || !previousPoint || !drawingRef.current) {
      return;
    }

    context.beginPath();
    context.moveTo(previousPoint.x, previousPoint.y);
    context.lineTo(currentPoint.x, currentPoint.y);
    context.stroke();
    lastPointRef.current = currentPoint;
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    drawingRef.current = true;
    lastPointRef.current = point(event);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function stop() {
    const canvas = canvasRef.current;
    drawingRef.current = false;
    lastPointRef.current = null;

    if (canvas) {
      const nextSignature = canvas.toDataURL("image/png");
      setSignature(nextSignature);
      onChange?.(nextSignature);
    }
  }

  function clear() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    if (canvas && context) {
      context.clearRect(0, 0, canvas.width, canvas.height);
    }

    setSignature("");
    onChange?.("");
  }

  return (
    <div className="space-y-2 rounded-2xl border border-gray-300 bg-gray-50 p-3">
      <input form={form} name={name} type="hidden" value={signature} />
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-gray-800">{label}</span>
        <button
          className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-bold text-gray-700 hover:bg-gray-50"
          onClick={clear}
          type="button"
        >
          Unterschrift löschen
        </button>
      </div>
      <canvas
        aria-label={label}
        className="h-36 w-full touch-none rounded-xl border-2 border-dashed border-gray-300 bg-white shadow-inner md:h-40"
        onPointerCancel={stop}
        onPointerDown={start}
        onPointerMove={draw}
        onPointerUp={stop}
        ref={canvasRef}
      />
    </div>
  );
}
