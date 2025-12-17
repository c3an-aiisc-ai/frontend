import { useCallback } from "react";
import type { RefObject } from "react";
import type { Transform } from "../hooks/zoom";

type Params = {
  containerRef: RefObject<HTMLDivElement>;
  transform: Transform;
};

export function useWorldPoint({ containerRef, transform }: Params) {
  return useCallback(
    (clientX: number, clientY: number) => {
      const el = containerRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const localX = clientX - rect.left;
      const localY = clientY - rect.top;
      return {
        x: (localX - transform.x) / transform.zoom,
        y: (localY - transform.y) / transform.zoom,
      };
    },
    [containerRef, transform.x, transform.y, transform.zoom],
  );
}
