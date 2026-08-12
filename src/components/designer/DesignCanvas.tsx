import { useRef, useState } from "react";
import { CardRenderer } from "@/components/card/CardRenderer";
import type { CardDesign, CardElement } from "@/lib/card/types";
import type { CardData } from "@/lib/card/fields";

interface Props {
  design: CardDesign;
  widthMm: number;
  heightMm: number;
  orientation?: "portrait" | "landscape" | undefined;
  scale: number;
  data: CardData;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (id: string, patch: Partial<CardElement>) => void;
  showGrid: boolean;
  showSafe: boolean;
  showBleed?: boolean;
  bleed?: number;
  gridSize?: number;
  safeMargin?: number;
  snap: number;
  hideBackground?: boolean;
}

type DragState = {
  id: string;
  mode: "move" | "resize";
  startX: number;
  startY: number;
  ox: number;
  oy: number;
  ow: number;
  oh: number;
};

export function DesignCanvas({
  design,
  widthMm,
  heightMm,
  orientation,
  scale,
  data,
  selectedId,
  onSelect,
  onChange,
  showGrid,
  showSafe,
  showBleed = false,
  bleed = 3,
  gridSize,
  safeMargin = 3,
  snap,
  hideBackground,
}: Props) {
  const drag = useRef<DragState | null>(null);
  const [, force] = useState(0);

  const snapTo = (v: number) => (snap > 0 ? Math.round(v / snap) * snap : Math.round(v * 100) / 100);

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.startX) / scale;
    const dy = (e.clientY - d.startY) / scale;
    if (d.mode === "move") {
      onChange(d.id, {
        x: Math.max(-10, Math.min(widthMm + 10, snapTo(d.ox + dx))),
        y: Math.max(-10, Math.min(heightMm + 10, snapTo(d.oy + dy))),
      });
    } else {
      onChange(d.id, {
        w: Math.max(2, snapTo(d.ow + dx)),
        h: Math.max(2, snapTo(d.oh + dy)),
      });
    }
  };

  const end = (e: React.PointerEvent) => {
    if (drag.current) {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      drag.current = null;
      force((n) => n + 1);
    }
  };

  const start = (e: React.PointerEvent, el: CardElement, mode: "move" | "resize") => {
    if (el.locked) return;
    e.stopPropagation();
    onSelect(el.id);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    drag.current = {
      id: el.id,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      ox: el.x,
      oy: el.y,
      ow: el.w,
      oh: el.h,
    };
  };

  return (
    <div
      className="inline-block touch-none select-none"
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerLeave={end}
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <CardRenderer
        design={design}
        widthMm={widthMm}
        heightMm={heightMm}
        orientation={orientation}
        scale={scale}
        data={data}
        interactive
        hideBackground={hideBackground}
        onSelect={onSelect}
        guides={{
          showGrid,
          showSafe,
          showBleed,
          bleed,
          gridSize: gridSize ?? snap ?? 1,
          safeMargin,
        }}
      >
        {(design.elements ?? []).map((el) =>
          el.visible === false ? null : (
            <div
              key={`hit_${el.id}`}
              onPointerDown={(e) => start(e, el, "move")}
              style={{
                position: "absolute",
                left: el.x * scale,
                top: el.y * scale,
                width: el.w * scale,
                height: el.h * scale,
                zIndex: 10000 + el.z,
                cursor: el.locked ? "not-allowed" : "move",
                outline:
                  selectedId === el.id
                    ? "1.5px solid var(--color-primary)"
                    : "1px dashed rgba(30,58,138,0.25)",
                outlineOffset: 0,
                background: "transparent",
              }}
            >
              {selectedId === el.id ? (
                <span
                  onPointerDown={(e) => start(e, el, "resize")}
                  style={{
                    position: "absolute",
                    right: -5,
                    bottom: -5,
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    background: "var(--color-primary)",
                    cursor: "nwse-resize",
                  }}
                />
              ) : null}
            </div>
          ),
        )}
      </CardRenderer>
    </div>
  );
}
