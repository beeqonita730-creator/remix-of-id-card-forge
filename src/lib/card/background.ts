/**
 * Background layer engine.
 *
 * The background is a first-class layer of a card design: it always renders
 * behind every element, it is locked by default and it carries its own
 * geometry in millimetres so that preview, designer, print and PDF share one
 * single source of truth.
 */

export type BackgroundFit = "fit" | "fill" | "crop" | "stretch";

export interface GradientStop {
  color: string;
  /** 0 – 100 */
  at: number;
}

export interface BackgroundGradient {
  type: "linear" | "radial";
  /** degrees, linear only */
  angle: number;
  stops: GradientStop[];
}

export interface CardBackground {
  /** solid fallback colour, always painted first */
  color: string;
  /** optional gradient painted above the solid colour */
  gradient?: BackgroundGradient | null;
  /** signed URL of the uploaded artwork */
  imageUrl?: string | null;
  /** "<bucket>/<path>" reference of the stored asset */
  storagePath?: string | null;
  assetId?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  widthPx?: number | null;
  heightPx?: number | null;
  sizeBytes?: number | null;
  fit?: BackgroundFit;
  /** explicit geometry in mm, relative to the trim box origin */
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  rotation?: number;
  opacity?: number;
  /** locked backgrounds cannot be selected or moved */
  locked?: boolean;
  /** editor-only visibility — never affects generated cards */
  hiddenInEditor?: boolean;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const BACKGROUND_FITS: { id: BackgroundFit; label: string; description: string }[] = [
  { id: "fill", label: "Fill card", description: "Cover the whole card; overflow is cropped." },
  { id: "fit", label: "Fit to card", description: "Show the entire artwork inside the card." },
  { id: "crop", label: "Crop to card", description: "Cover the card, then nudge and scale manually." },
  { id: "stretch", label: "Stretch", description: "Force the artwork to the card, distortion allowed." },
];

export const DEFAULT_FIT: BackgroundFit = "fill";
export const MAX_BACKGROUND_BYTES = 25 * 1024 * 1024;
export const ACCEPTED_BACKGROUND_TYPES = "image/png,image/jpeg,image/jpg,image/svg+xml,image/webp";

const round = (n: number) => Math.round(n * 100) / 100;

export const emptyBackground = (): CardBackground => ({
  color: "#ffffff",
  imageUrl: null,
  fit: DEFAULT_FIT,
  opacity: 1,
  rotation: 0,
  locked: true,
});

export function hasBackgroundImage(bg?: CardBackground | null): boolean {
  return !!bg?.imageUrl;
}

/** The artwork region including bleed, expressed relative to the trim origin. */
export function artworkRegion(widthMm: number, heightMm: number, bleedMm = 0): Box {
  return { x: -bleedMm, y: -bleedMm, w: widthMm + bleedMm * 2, h: heightMm + bleedMm * 2 };
}

/** Geometry a fit mode produces for a given image on a given card. */
export function computeFitBox(
  fit: BackgroundFit,
  imgW: number | null | undefined,
  imgH: number | null | undefined,
  widthMm: number,
  heightMm: number,
  bleedMm = 0,
): Box {
  const region = artworkRegion(widthMm, heightMm, bleedMm);
  const iw = Number(imgW) || 0;
  const ih = Number(imgH) || 0;
  if (fit === "stretch" || iw <= 0 || ih <= 0) return region;
  const k =
    fit === "fit"
      ? Math.min(region.w / iw, region.h / ih)
      : Math.max(region.w / iw, region.h / ih);
  const w = iw * k;
  const h = ih * k;
  return {
    x: round(region.x + (region.w - w) / 2),
    y: round(region.y + (region.h - h) / 2),
    w: round(w),
    h: round(h),
  };
}

/**
 * Resolve the box the renderer should draw the background into.
 * Explicit user geometry wins; otherwise the fit mode is applied.
 */
export function backgroundBox(
  bg: CardBackground | null | undefined,
  widthMm: number,
  heightMm: number,
  bleedMm = 0,
): Box {
  if (!bg) return artworkRegion(widthMm, heightMm, bleedMm);
  if (typeof bg.w === "number" && typeof bg.h === "number" && bg.w > 0 && bg.h > 0) {
    return { x: bg.x ?? 0, y: bg.y ?? 0, w: bg.w, h: bg.h };
  }
  return computeFitBox(bg.fit ?? DEFAULT_FIT, bg.widthPx, bg.heightPx, widthMm, heightMm, bleedMm);
}

/** CSS object-fit that matches a fit mode once the box is known. */
export function fitToObjectFit(fit: BackgroundFit | undefined): "cover" | "contain" | "fill" {
  if (fit === "stretch") return "fill";
  if (fit === "fit") return "contain";
  return "cover";
}

export function applyFit(
  bg: CardBackground,
  fit: BackgroundFit,
  widthMm: number,
  heightMm: number,
  bleedMm = 0,
): CardBackground {
  const box = computeFitBox(fit, bg.widthPx, bg.heightPx, widthMm, heightMm, bleedMm);
  return { ...bg, fit, ...box };
}

/* ------------------------------------------------------------------ */
/* Quality                                                             */
/* ------------------------------------------------------------------ */

export type QualityLevel = "excellent" | "good" | "warning" | "low" | "unknown";

export interface QualityReport {
  dpi: number;
  level: QualityLevel;
  label: string;
  message: string;
}

export function estimateDpi(px: number | null | undefined, mm: number): number {
  const p = Number(px) || 0;
  if (!p || !mm) return 0;
  return Math.round(p / (mm / 25.4));
}

export function backgroundQuality(
  widthPx: number | null | undefined,
  heightPx: number | null | undefined,
  widthMm: number,
  heightMm: number,
): QualityReport {
  const dpi = Math.min(estimateDpi(widthPx, widthMm) || 0, estimateDpi(heightPx, heightMm) || 0);
  if (!dpi) {
    return {
      dpi: 0,
      level: "unknown",
      label: "Unknown",
      message: "Vector or unmeasured artwork — resolution independent.",
    };
  }
  if (dpi >= 300)
    return { dpi, level: "excellent", label: "Excellent", message: "Print ready at 300 DPI or better." };
  if (dpi >= 200) return { dpi, level: "good", label: "Good", message: "Suitable for most card printers." };
  if (dpi >= 150)
    return { dpi, level: "warning", label: "Warning", message: "Slight softness may be visible in print." };
  return { dpi, level: "low", label: "Low", message: "Too low for print — upload a higher resolution file." };
}

/* ------------------------------------------------------------------ */
/* Orientation / size transformation                                   */
/* ------------------------------------------------------------------ */

export type BackgroundTransform = "keep" | "fit" | "fill" | "crop" | "scale";

export const BACKGROUND_TRANSFORMS: { id: BackgroundTransform; label: string; description: string }[] = [
  { id: "fit", label: "Fit to new card", description: "Show the whole artwork on the new canvas." },
  { id: "fill", label: "Fill new card", description: "Cover the new canvas, cropping the overflow." },
  { id: "crop", label: "Crop to new card", description: "Cover the canvas and keep manual control." },
  { id: "scale", label: "Scale proportionally", description: "Scale the current box by the canvas ratio." },
  { id: "keep", label: "Keep position", description: "Leave the artwork exactly where it is." },
];

export const DEFAULT_BACKGROUND_TRANSFORM: BackgroundTransform = "fit";

export function transformBackground(
  bg: CardBackground | null | undefined,
  from: { widthMm: number; heightMm: number },
  to: { widthMm: number; heightMm: number },
  mode: BackgroundTransform,
): CardBackground {
  const base = bg ?? emptyBackground();
  if (!base.imageUrl || mode === "keep") return base;
  if (mode === "scale") {
    const k = Math.min(to.widthMm / from.widthMm, to.heightMm / from.heightMm);
    const box = backgroundBox(base, from.widthMm, from.heightMm);
    return {
      ...base,
      x: round(box.x * k),
      y: round(box.y * k),
      w: round(box.w * k),
      h: round(box.h * k),
    };
  }
  const fit: BackgroundFit = mode === "fill" ? "fill" : mode === "crop" ? "crop" : "fit";
  return applyFit(base, fit, to.widthMm, to.heightMm);
}

/* ------------------------------------------------------------------ */
/* CSS helpers                                                         */
/* ------------------------------------------------------------------ */

export function gradientCss(g?: BackgroundGradient | null): string | undefined {
  if (!g || !g.stops?.length) return undefined;
  const stops = [...g.stops].sort((a, b) => a.at - b.at).map((s) => `${s.color} ${s.at}%`).join(", ");
  return g.type === "radial"
    ? `radial-gradient(circle at 50% 50%, ${stops})`
    : `linear-gradient(${g.angle ?? 180}deg, ${stops})`;
}

export function formatBytes(bytes?: number | null): string {
  const b = Number(bytes) || 0;
  if (!b) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

/** Read pixel dimensions of an image file in the browser. */
export function readImageMeta(file: File): Promise<{ width: number; height: number; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight, dataUrl });
      img.onerror = () => resolve({ width: 0, height: 0, dataUrl });
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}
