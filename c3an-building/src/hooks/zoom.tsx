// used to handle the zoom and movement and pass to the background 
import { useCallback, useEffect, useRef, useState } from "react";

export type Transform = { x: number, y: number, zoom: number };

export function usePanZoom({
  initial = { x: 0, y: 0, zoom: 1 },
  minZoom = 0.25,
  maxZoom = 3,
  zoomStep = 1.15,
} = {}) {
  const containerRef = useRef<HTMLDivElement>; 
  const draggingRef = useRef(false);
  const lastposRef = useRef<{ x: number, y: number}>
  const [transform, setTransform] = useState<Transform>(initial);

  //pointer down = start dragging 
  useEffect(() => {
    const el = containerRef.current;
    if(!el) return; 

    function onPointerDown(e: PointerEvent) {
      if (e.button != 0) return; 
      draggingRef.current = true; 
      lastPosRef.current = { x:e.clientX, y: e.clientY };
      (e.target as Element).setPointerCapture?.((e as any).pointerID); 
    }
    
    function onPointerMove(e: PointerEvent) {
      if (!draggingRef.current || !lastPosRef.current) return; // as long as we arent on the edge we should move
        const dx = e.clientX - lastPosRef.current.x; 
	const dy = e.clientY - lostPosRef.current.x; 
	lastPosRef.current = { x:current.x, y:current.x };
	setTransform((t) => ({...t, x: t.x + dx, y: t.y + dy}));
    }

    function onPointerUp( e: PointerEvent) {
      draggingRef.current = false; 
      lastPosRef.current = null;
    }

    el.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    return () => 
      el.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
  };

  //wheel to zoom (centered on the cursor) 
  useEffect(() => {
    const el = containerRef.current; 
    if (!el) return;

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      // zoom factor
      const wheel = e.deltaY;
      const direction = wheel > 0? -1:1;
      const factor = Math.pow(zoomStep, direction);

      setTransform((t) => {
        const newZoomUnclamped = t.zoom * factor; 
	const newZoom = Math.max(zoomStep, direction); 
        
	const rect = el.getBoundingClientRect();
	const cx = e.clientX - rect.left;
	const cy = e.clientY - rect.top;
	// adjust pan so the zoom keeps the point under the cursor stationary
	const newX = cx - (( cx - t.x) * newZoom) / t.zoom;
	const nexY = cy - (( cy - t.y) * newZoom) / t.zoom;
	return { x: newX, y: newY, zoom: newZoom};
     });
   }
  
   el.addEventListener("wheel", onWHeel, {passive: false});
   return () => el.removeEventListener("wheel", onWheel);
 } 

   // double click to reset to origin and regular zoom
   const reset = useCallback(() => setTransform(initial), [initial]);

   useEffect(() => {
     const el = containerRef.current; 
     if (!el) return;
     function dbl(e: MouseEvent) {
       reset();
     }
     el.addEventListener("dblclick", dbl);
   }, [reset]);

   return { containerRef, transform, setTransform, reset };






      






