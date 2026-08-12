import { useEffect, useMemo, useState } from "react";
import type { CardDesign, CardElement, ImageElement, CodeElement, ShapeElement, TextElement } from "@/lib/card/types";
import { PT_TO_MM } from "@/lib/card/types";
import { buildContext, resolveTokens, type CardData } from "@/lib/card/fields";
import { barcodeDataUrl, qrDataUrl } from "@/lib/card/codes";
import { backgroundBox, fitToObjectFit, gradientCss } from "@/lib/card/background";

export interface RenderGuides {
  bleed?: number;
  showBleed?: boolean;
  showSafe?: boolean;
  safeMargin?: number;
  showGrid?: boolean;
  gridSize?: number;
  showTrim?: boolean;
}

interface Props {
  design: CardDesign;
  widthMm: number;
  heightMm: number;
  /** Informational: dimensions above are always authoritative. */
  orientation?: "portrait" | "landscape" | undefined;
  data?: CardData;
  /** pixels per millimetre */
  scale?: number;
  guides?: RenderGuides;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  interactive?: boolean;
  /** editor toggle — hides the background artwork without changing the design */
  hideBackground?: boolean;
  children?: React.ReactNode;
  className?: string;
}

function autoFitSize(el: TextElement, text: string): number {
  if (!el.autoFit) return el.fontSize;
  const charWidthMm = el.fontSize * PT_TO_MM * 0.52;
  const needed = text.length * charWidthMm;
  const maxLines = Math.max(1, Math.floor(el.h / (el.fontSize * PT_TO_MM * el.lineHeight)));
  const capacity = el.w * maxLines;
  if (needed <= capacity || capacity <= 0) return el.fontSize;
  return Math.max(el.fontSize * 0.55, el.fontSize * Math.sqrt(capacity / needed));
}

function useCode(el: CodeElement, content: string) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let alive = true;
    if (el.type === "qr") {
      qrDataUrl(content, el.color).then((u) => alive && setSrc(u));
    } else {
      setSrc(barcodeDataUrl(content, el.color));
    }
    return () => {
      alive = false;
    };
  }, [el.type, el.color, content]);
  return src;
}

function CodeNode({ el, content }: { el: CodeElement; content: string }) {
  const src = useCode(el, content);
  return src ? (
    <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
  ) : null;
}

function ElementNode({
  el,
  ctx,
  photoUrl,
  scale,
}: {
  el: CardElement;
  ctx: Record<string, string>;
  photoUrl?: string | null | undefined;
  scale: number;
}) {
  const box: React.CSSProperties = {
    position: "absolute",
    left: `${el.x * scale}px`,
    top: `${el.y * scale}px`,
    width: `${el.w * scale}px`,
    height: `${el.h * scale}px`,
    transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
    opacity: el.opacity,
    zIndex: el.z,
  };

  if (el.type === "text") {
    const t = el as TextElement;
    let text = resolveTokens(t.text, ctx);
    if (t.transform === "uppercase") text = text.toUpperCase();
    if (t.transform === "lowercase") text = text.toLowerCase();
    if (t.transform === "capitalize") text = text.replace(/\b\w/g, (c) => c.toUpperCase());
    const size = autoFitSize(t, text);
    return (
      <div
        style={{
          ...box,
          display: "flex",
          alignItems: "center",
          justifyContent:
            t.align === "center" ? "center" : t.align === "right" ? "flex-end" : "flex-start",
          overflow: "hidden",
        }}
      >
        <span
          style={{
            fontFamily: t.fontFamily,
            fontSize: `${size * PT_TO_MM * scale}px`,
            fontWeight: t.fontWeight,
            color: t.color,
            letterSpacing: `${t.letterSpacing * scale}px`,
            lineHeight: t.lineHeight,
            textAlign: t.align,
            width: "100%",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {text}
        </span>
      </div>
    );
  }

  if (el.type === "qr" || el.type === "barcode") {
    const c = el as CodeElement;
    return (
      <div style={box}>
        <CodeNode el={c} content={resolveTokens(c.content, ctx)} />
      </div>
    );
  }

  if (el.type === "photo" || el.type === "image" || el.type === "logo") {
    const im = el as ImageElement;
    const src = im.type === "photo" ? (photoUrl ?? im.src) : im.src;
    return (
      <div
        style={{
          ...box,
          borderRadius: `${im.radius * scale}px`,
          overflow: "hidden",
          border: im.borderWidth ? `${im.borderWidth * scale}px solid ${im.borderColor}` : undefined,
          background: src ? undefined : "rgba(15,23,42,0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {src ? (
          <img
            src={src}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: im.fit, objectPosition: im.objectPosition }}
          />
        ) : (
          <span style={{ fontSize: `${Math.max(6, 3 * scale)}px`, color: "#94a3b8" }}>
            {im.type === "photo" ? "PHOTO" : im.type === "logo" ? "LOGO" : "IMAGE"}
          </span>
        )}
      </div>
    );
  }

  const s = el as ShapeElement;
  if (s.type === "line") {
    return <div style={{ ...box, background: s.fill }} />;
  }
  return (
    <div
      style={{
        ...box,
        background: s.fill,
        border: s.strokeWidth ? `${s.strokeWidth * scale}px solid ${s.stroke}` : undefined,
        borderRadius: s.type === "circle" ? "50%" : `${s.radius * scale}px`,
      }}
    />
  );
}

export function CardRenderer({
  design,
  widthMm,
  heightMm,
  data = {},
  scale = 4,
  guides,
  selectedId,
  onSelect,
  interactive,
  hideBackground,
  children,
  className,
}: Props) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const ctx = useMemo(() => buildContext(data, origin), [data, origin]);
  const bleed = guides?.showBleed ? (guides.bleed ?? 0) : 0;
  const safe = guides?.safeMargin ?? 3;

  const elements = [...(design.elements ?? [])].sort((a, b) => a.z - b.z);

  const bg = design.background;
  const box = backgroundBox(bg, widthMm, heightMm, bleed);
  const showArtwork = !!bg?.imageUrl && !hideBackground && bg?.hiddenInEditor !== true;
  const gradient = gradientCss(bg?.gradient);

  const artwork = showArtwork ? (
    <img
      src={bg!.imageUrl!}
      alt=""
      draggable={false}
      style={{
        position: "absolute",
        left: `${(box.x + bleed) * scale}px`,
        top: `${(box.y + bleed) * scale}px`,
        width: `${box.w * scale}px`,
        height: `${box.h * scale}px`,
        objectFit: fitToObjectFit(bg?.fit),
        opacity: bg?.opacity ?? 1,
        transform: bg?.rotation ? `rotate(${bg.rotation}deg)` : undefined,
        pointerEvents: "none",
        userSelect: "none",
        zIndex: 0,
      }}
    />
  ) : null;

  return (
    <div
      className={className}
      data-card-surface
      style={{
        position: "relative",
        width: `${(widthMm + bleed * 2) * scale}px`,
        height: `${(heightMm + bleed * 2) * scale}px`,
        background: gradient ? `${gradient}, ${bg?.color ?? "#ffffff"}` : (bg?.color ?? "#ffffff"),
        overflow: "hidden",
      }}
      onPointerDown={(e) => {
        if (interactive && e.target === e.currentTarget) onSelect?.(null);
      }}
    >
      {artwork}
      {bleed > 0 && guides?.showTrim !== false ? (
        <div
          style={{
            position: "absolute",
            left: `${bleed * scale}px`,
            top: `${bleed * scale}px`,
            width: `${widthMm * scale}px`,
            height: `${heightMm * scale}px`,
            outline: "1px dashed rgba(15,23,42,.55)",
            pointerEvents: "none",
            zIndex: 9997,
          }}
        />
      ) : null}
      <div
        style={{
          position: "absolute",
          left: `${bleed * scale}px`,
          top: `${bleed * scale}px`,
          width: `${widthMm * scale}px`,
          height: `${heightMm * scale}px`,
          overflow: "hidden",
        }}
        onPointerDown={(e) => {
          if (interactive && e.target === e.currentTarget) onSelect?.(null);
        }}
      >
        {guides?.showGrid && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage:
                "linear-gradient(to right, rgba(30,58,138,.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(30,58,138,.12) 1px, transparent 1px)",
              backgroundSize: `${(guides.gridSize ?? 2) * scale}px ${(guides.gridSize ?? 2) * scale}px`,
              pointerEvents: "none",
              zIndex: 9998,
            }}
          />
        )}
        {elements.map((el) =>
          el.visible === false ? null : (
            <div
              key={el.id}
              data-element-id={el.id}
              style={{ position: "absolute", inset: 0, pointerEvents: interactive ? "auto" : "none" }}
            >
              <ElementNode el={el} ctx={ctx} photoUrl={data.photo_url} scale={scale} />
            </div>
          ),
        )}
        {guides?.showSafe && (
          <div
            style={{
              position: "absolute",
              inset: `${safe * scale}px`,
              border: "1px dashed rgba(220,38,38,.6)",
              pointerEvents: "none",
              zIndex: 9999,
            }}
          />
        )}
        {selectedId ? null : null}
        {children}
      </div>
    </div>
  );
}
