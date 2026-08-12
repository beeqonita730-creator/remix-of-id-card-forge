import { createElement, type CardDesign, type CardElement } from "./types";
import { starterBackDesign, starterDesign } from "./starter";

export type Orientation = "portrait" | "landscape";
export type SizeOrientation = Orientation | "both";

export interface Dims {
  widthMm: number;
  heightMm: number;
}

export interface SizeLike {
  width_mm: number;
  height_mm: number;
  orientation?: string | null;
}

/** Canonical portrait dimensions of a size record (short edge = width). */
export function portraitDims(size: SizeLike): Dims {
  const a = Number(size.width_mm) || 0;
  const b = Number(size.height_mm) || 0;
  return { widthMm: Math.min(a, b), heightMm: Math.max(a, b) };
}

/**
 * One physical size definition, two orientations.
 * The stored record is never duplicated — width/height are swapped on read.
 */
export function resolveDims(size: SizeLike | null | undefined, orientation: Orientation): Dims {
  if (!size) return orientation === "landscape" ? { widthMm: 85.6, heightMm: 54 } : { widthMm: 54, heightMm: 85.6 };
  const p = portraitDims(size);
  return orientation === "landscape" ? { widthMm: p.heightMm, heightMm: p.widthMm } : p;
}

export function sizeOrientation(size: SizeLike | null | undefined): SizeOrientation {
  const raw = (size?.orientation ?? "both").toLowerCase();
  return raw === "portrait" || raw === "landscape" ? raw : "both";
}

export function supportsOrientation(size: SizeLike | null | undefined, orientation: Orientation): boolean {
  const o = sizeOrientation(size);
  return o === "both" || o === orientation;
}

export function normalizeOrientation(value: unknown, fallback: Orientation = "portrait"): Orientation {
  return value === "portrait" || value === "landscape" ? value : fallback;
}

export function orientationLabel(o: Orientation) {
  return o === "landscape" ? "Landscape" : "Portrait";
}

export function formatDims(d: Dims) {
  const r = (n: number) => (Math.round(n * 10) / 10).toString();
  return `${r(d.widthMm)} × ${r(d.heightMm)} mm`;
}

/* ------------------------------------------------------------------ */
/* Normalised coordinates                                              */
/* ------------------------------------------------------------------ */

/** Attach percentage coordinates so a design can be re-projected onto any canvas. */
export function withNormalized(design: CardDesign, dims: Dims): CardDesign {
  return {
    ...design,
    elements: (design.elements ?? []).map((el) => ({
      ...el,
      xPercent: dims.widthMm ? (el.x / dims.widthMm) * 100 : 0,
      yPercent: dims.heightMm ? (el.y / dims.heightMm) * 100 : 0,
      widthPercent: dims.widthMm ? (el.w / dims.widthMm) * 100 : 0,
      heightPercent: dims.heightMm ? (el.h / dims.heightMm) * 100 : 0,
    })) as CardElement[],
  };
}

/* ------------------------------------------------------------------ */
/* Orientation transformation                                          */
/* ------------------------------------------------------------------ */

export type TransformMode = "rotate" | "fit" | "relayout" | "fresh";

export const TRANSFORM_MODES: { id: TransformMode; label: string; description: string }[] = [
  { id: "rotate", label: "Rotate design", description: "Turn every element 90° with the canvas." },
  { id: "fit", label: "Fit design", description: "Scale the whole layout proportionally and centre it." },
  { id: "relayout", label: "Relayout", description: "Keep elements and reposition them for the new canvas." },
  { id: "fresh", label: "Start fresh", description: "Blank starter layout for the new orientation." },
];

const round = (n: number) => Math.round(n * 100) / 100;

function scaleFont(el: CardElement, factor: number): Partial<CardElement> {
  if (el.type !== "text") return {};
  return { fontSize: Math.max(3, round(el.fontSize * factor)) } as Partial<CardElement>;
}

/** Rotate a design 90° clockwise inside the card. */
function rotateDesign(design: CardDesign, from: Dims): CardDesign {
  return {
    ...design,
    elements: (design.elements ?? []).map((el) => ({
      ...el,
      x: round(from.heightMm - (el.y + el.h)),
      y: round(el.x),
      w: round(el.h),
      h: round(el.w),
      rotation: ((el.rotation ?? 0) + 90) % 360,
    })) as CardElement[],
  };
}

function fitDesign(design: CardDesign, from: Dims, to: Dims): CardDesign {
  const k = Math.min(to.widthMm / from.widthMm, to.heightMm / from.heightMm);
  const offX = (to.widthMm - from.widthMm * k) / 2;
  const offY = (to.heightMm - from.heightMm * k) / 2;
  return {
    ...design,
    elements: (design.elements ?? []).map((el) => ({
      ...el,
      x: round(offX + el.x * k),
      y: round(offY + el.y * k),
      w: round(el.w * k),
      h: round(el.h * k),
      ...scaleFont(el, k),
    })) as CardElement[],
  };
}

/** Stretch by normalised coordinates, then clamp everything inside the safe area. */
function relayoutDesign(design: CardDesign, from: Dims, to: Dims, safeMm = 3): CardDesign {
  const kx = to.widthMm / from.widthMm;
  const ky = to.heightMm / from.heightMm;
  const kMin = Math.min(kx, ky);
  return {
    ...design,
    elements: (design.elements ?? []).map((el) => {
      const w = Math.min(round(el.w * kx), to.widthMm);
      const h = Math.min(round(el.h * ky), to.heightMm);
      const fullBleed = el.x <= 0.01 && el.y <= 0.01 && el.w >= from.widthMm - 0.01;
      const x = fullBleed ? 0 : clamp(round(el.x * kx), safeMm, Math.max(safeMm, to.widthMm - safeMm - w));
      const y = fullBleed ? round(el.y * ky) : clamp(round(el.y * ky), safeMm, Math.max(safeMm, to.heightMm - safeMm - h));
      return {
        ...el,
        x,
        y,
        w: fullBleed ? to.widthMm : w,
        h,
        ...scaleFont(el, kMin),
      };
    }) as CardElement[],
  };
}

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}

export function transformDesign(
  design: CardDesign,
  from: Dims,
  to: Dims,
  mode: TransformMode,
  side: "front" | "back" = "front",
): CardDesign {
  if (mode === "fresh") {
    return side === "back" ? starterBackDesign(to.widthMm, to.heightMm) : starterDesign(to.widthMm, to.heightMm);
  }
  if (!design.elements?.length) return { ...design, elements: [] };
  if (mode === "rotate") return rotateDesign(design, from);
  if (mode === "fit") return fitDesign(design, from, to);
  return relayoutDesign(design, from, to);
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

export interface DesignIssue {
  elementId: string;
  name: string;
  severity: "error" | "warning";
  message: string;
}

const PT_MM = 0.352778;

export function validateDesign(design: CardDesign, dims: Dims, safeMm = 3): DesignIssue[] {
  const issues: DesignIssue[] = [];
  for (const el of design.elements ?? []) {
    if (el.visible === false) continue;
    const label = el.name ?? el.type;
    if (el.w <= 0 || el.h <= 0) {
      issues.push({ elementId: el.id, name: label, severity: "error", message: "Has zero width or height." });
    }
    if (el.x < 0 || el.y < 0 || el.x + el.w > dims.widthMm + 0.01 || el.y + el.h > dims.heightMm + 0.01) {
      issues.push({ elementId: el.id, name: label, severity: "warning", message: "Extends past the trim edge." });
    } else if (
      el.x < safeMm - 0.01 ||
      el.y < safeMm - 0.01 ||
      el.x + el.w > dims.widthMm - safeMm + 0.01 ||
      el.y + el.h > dims.heightMm - safeMm + 0.01
    ) {
      const critical = /name|photo|id|qr|logo/i.test(label);
      if (critical || el.type === "text" || el.type === "qr" || el.type === "photo") {
        issues.push({
          elementId: el.id,
          name: label,
          severity: "warning",
          message: `Outside the ${safeMm} mm safe area.`,
        });
      }
    }
    if (el.type === "text") {
      const sample = el.text.replace(/\{\{\s*full_name\s*\}\}/g, "MUHAMMAD ABDUL RAHMAN AL FARUQ");
      const minSize = el.autoFit ? el.fontSize * 0.55 : el.fontSize;
      const charW = minSize * PT_MM * 0.52;
      const lines = Math.max(1, Math.floor(el.h / (minSize * PT_MM * el.lineHeight)));
      if (sample.length * charW > el.w * lines) {
        issues.push({
          elementId: el.id,
          name: label,
          severity: "warning",
          message: "Long values may not fit even after auto-fit.",
        });
      }
    }
    if ((el.type === "qr" || el.type === "barcode") && !el.content.trim()) {
      issues.push({ elementId: el.id, name: label, severity: "error", message: "Code content is empty." });
    }
  }
  return issues;
}

/** Default photo placement suggestion per orientation (used by starter layouts). */
export function defaultPhotoElement(orientation: Orientation, dims: Dims) {
  const w = Math.min(22, dims.widthMm * (orientation === "portrait" ? 0.42 : 0.26));
  const h = w * 1.27;
  return createElement("photo", {
    name: "Photo",
    w,
    h,
    x: orientation === "portrait" ? (dims.widthMm - w) / 2 : Math.max(3, dims.widthMm * 0.05),
    y: dims.heightMm * 0.24,
  });
}
