// used to handle the zoom and movement and pass to the background
import { useCallback, useEffect, useRef, useState } from "react";

export type Transform = { x: number; y: number; zoom: number };

type Options = {
  initial?: Transform;
  minZoom?: number;
  maxZoom?: number;
  zoomStep?: number;
};

export function usePanZoom({
  initial = { x: 0, y: 0, zoom: 1 },
  minZoom = 0.1,
  maxZoom = 1,
  zoomStep = 0.02,
}: Options = {}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const [transform, setTransform] = useState<Transform>(initial);

  // pointer down = start dragging
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function onPointerDown(e: PointerEvent) {
      if (e.button !== 0) return;
      draggingRef.current = true;
      lastPosRef.current = { x: e.clientX, y: e.clientY };
      (e.target as Element | null)?.setPointerCapture?.(e.pointerId);
    }

    function onPointerMove(e: PointerEvent) {
      // as long as we arent on the edge we should move
      if (!draggingRef.current || !lastPosRef.current) return;
      const dx = e.clientX - lastPosRef.current.x;
      const dy = e.clientY - lastPosRef.current.y;
      lastPosRef.current = { x: e.clientX, y: e.clientY };
      setTransform((t) => ({ ...t, x: t.x + dx, y: t.y + dy }));
    }

    function onPointerUp() {
      draggingRef.current = false;
      lastPosRef.current = null;
    }

    el.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, []);

  // wheel to zoom (centered on the cursor)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const element: HTMLDivElement = el;

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const direction = e.deltaY > 0 ? -1 : 1;
      // treat zoomStep as a % change per wheel tick instead of an exponential base
      const factor = 1 + direction * zoomStep;

      setTransform((t) => {
        const newZoomUnclamped = t.zoom * factor;
        const newZoom = Math.min(maxZoom, Math.max(minZoom, newZoomUnclamped));

        const rect = element.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        // adjust pan so the zoom keeps the point under the cursor stationary
        const newX = cx - ((cx - t.x) * newZoom) / t.zoom;
        const newY = cy - ((cy - t.y) * newZoom) / t.zoom;
        return { x: newX, y: newY, zoom: newZoom };
      });
    }

    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [maxZoom, minZoom, zoomStep]);

  // double click to reset to origin and regular zoom
  const reset = useCallback(() => setTransform(initial), [initial]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function onDoubleClick() {
      reset();
    }

    el.addEventListener("dblclick", onDoubleClick);
    return () => el.removeEventListener("dblclick", onDoubleClick);
  }, [reset]);

  return { containerRef, transform, setTransform, reset };
}
