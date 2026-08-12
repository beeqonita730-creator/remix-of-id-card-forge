import { jsPDF } from "jspdf";
import type { CardDesign, CodeElement, ImageElement, ShapeElement, TextElement } from "./types";
import { buildContext, resolveTokens, type CardData } from "./fields";
import { barcodeDataUrl, qrDataUrl, toDataUrl } from "./codes";
import { computeSheet, type SheetConfig } from "./sheet";

const hexToRgb = (hex: string): [number, number, number] => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex ?? "");
  if (!m) return [0, 0, 0];
  return [parseInt(m[1]!, 16), parseInt(m[2]!, 16), parseInt(m[3]!, 16)];
};

export interface RenderOptions {
  offsetX: number;
  offsetY: number;
  widthMm: number;
  heightMm: number;
  data: CardData;
  origin: string;
}

/** Resolve every remote asset used by a design into data URLs (PDF-safe). */
export async function resolveAssets(
  design: CardDesign,
  data: CardData,
  origin: string,
): Promise<Record<string, string>> {
  const ctx = buildContext(data, origin);
  const out: Record<string, string> = {};
  const jobs: Promise<void>[] = [];

  if (design.background?.imageUrl) {
    jobs.push(
      toDataUrl(design.background.imageUrl).then((u) => {
        if (u) out["__bg"] = u;
      }),
    );
  }
  for (const el of design.elements ?? []) {
    if (el.type === "qr") {
      const content = resolveTokens((el as CodeElement).content, ctx);
      jobs.push(
        qrDataUrl(content, (el as CodeElement).color).then((u) => {
          out[el.id] = u;
        }),
      );
    } else if (el.type === "barcode") {
      const content = resolveTokens((el as CodeElement).content, ctx);
      const u = barcodeDataUrl(content, (el as CodeElement).color);
      if (u) out[el.id] = u;
    } else if (el.type === "photo" || el.type === "image" || el.type === "logo") {
      const im = el as ImageElement;
      const src = im.type === "photo" ? (data.photo_url ?? im.src) : im.src;
      if (src) {
        jobs.push(
          toDataUrl(src).then((u) => {
            if (u) out[el.id] = u;
          }),
        );
      }
    }
  }
  await Promise.all(jobs);
  return out;
}

export function drawDesign(
  doc: jsPDF,
  design: CardDesign,
  assets: Record<string, string>,
  opts: RenderOptions,
) {
  const { offsetX: ox, offsetY: oy, widthMm: W, heightMm: H } = opts;
  const ctx = buildContext(opts.data, opts.origin);

  const bg = design.background?.color ?? "#ffffff";
  doc.setFillColor(...hexToRgb(bg));
  doc.rect(ox, oy, W, H, "F");
  if (assets["__bg"]) {
    try {
      doc.addImage(assets["__bg"], ox, oy, W, H, undefined, "FAST");
    } catch {
      /* ignore unsupported image */
    }
  }

  const elements = [...(design.elements ?? [])]
    .filter((e) => e.visible !== false)
    .sort((a, b) => a.z - b.z);

  for (const el of elements) {
    const x = ox + el.x;
    const y = oy + el.y;

    if (el.type === "text") {
      const t = el as TextElement;
      let text = resolveTokens(t.text, ctx);
      if (t.transform === "uppercase") text = text.toUpperCase();
      if (t.transform === "lowercase") text = text.toLowerCase();
      if (!text) continue;
      doc.setTextColor(...hexToRgb(t.color));
      doc.setFont("helvetica", t.fontWeight >= 600 ? "bold" : "normal");
      let size = t.fontSize;
      doc.setFontSize(size);
      if (t.autoFit) {
        while (size > 4 && doc.getTextWidth(text) > el.w) {
          size -= 0.25;
          doc.setFontSize(size);
        }
      }
      const tx = t.align === "center" ? x + el.w / 2 : t.align === "right" ? x + el.w : x;
      doc.text(text, tx, y + el.h / 2, {
        align: t.align,
        baseline: "middle",
        maxWidth: el.w,
        angle: el.rotation ? -el.rotation : 0,
      });
      continue;
    }

    if (el.type === "rect" || el.type === "circle" || el.type === "line") {
      const s = el as ShapeElement;
      doc.setFillColor(...hexToRgb(s.fill));
      if (s.type === "circle") {
        doc.ellipse(x + el.w / 2, y + el.h / 2, el.w / 2, el.h / 2, "F");
      } else if (s.type === "line") {
        doc.rect(x, y, el.w, Math.max(0.2, el.h), "F");
      } else if (s.radius > 0) {
        doc.roundedRect(x, y, el.w, el.h, s.radius, s.radius, "F");
      } else {
        doc.rect(x, y, el.w, el.h, "F");
      }
      continue;
    }

    const img = assets[el.id];
    if (img) {
      try {
        doc.addImage(img, x, y, el.w, el.h, undefined, "FAST");
      } catch {
        /* ignore */
      }
    }
  }
}

export function drawCropMarks(doc: jsPDF, x: number, y: number, w: number, h: number) {
  const len = 3;
  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.15);
  doc.line(x - len, y, x - 0.5, y);
  doc.line(x, y - len, x, y - 0.5);
  doc.line(x + w + 0.5, y, x + w + len, y);
  doc.line(x + w, y - len, x + w, y - 0.5);
  doc.line(x - len, y + h, x - 0.5, y + h);
  doc.line(x, y + h + 0.5, x, y + h + len);
  doc.line(x + w + 0.5, y + h, x + w + len, y + h);
  doc.line(x + w, y + h + 0.5, x + w, y + h + len);
}

export interface CardJob {
  front: CardDesign;
  back?: CardDesign | null;
  data: CardData;
  widthMm: number;
  heightMm: number;
}

const originOf = () => (typeof window !== "undefined" ? window.location.origin : "");

/** One page per side, page size = exact physical card size. */
export async function exportCardPdf(job: CardJob, includeBack: boolean, filename: string) {
  const origin = originOf();
  const doc = new jsPDF({
    unit: "mm",
    format: [job.widthMm, job.heightMm],
    orientation: job.widthMm >= job.heightMm ? "landscape" : "portrait",
  });
  const frontAssets = await resolveAssets(job.front, job.data, origin);
  drawDesign(doc, job.front, frontAssets, {
    offsetX: 0,
    offsetY: 0,
    widthMm: job.widthMm,
    heightMm: job.heightMm,
    data: job.data,
    origin,
  });
  if (includeBack && job.back) {
    doc.addPage([job.widthMm, job.heightMm], job.widthMm >= job.heightMm ? "landscape" : "portrait");
    const backAssets = await resolveAssets(job.back, job.data, origin);
    drawDesign(doc, job.back, backAssets, {
      offsetX: 0,
      offsetY: 0,
      widthMm: job.widthMm,
      heightMm: job.heightMm,
      data: job.data,
      origin,
    });
  }
  doc.save(filename);
}

/** Imposition of many cards onto sheets. */
export async function exportSheetPdf(
  jobs: CardJob[],
  cfg: SheetConfig,
  includeBack: boolean,
  filename: string,
) {
  if (jobs.length === 0) return;
  const origin = originOf();
  const first = jobs[0]!;
  const layout = computeSheet(cfg, first.widthMm, first.heightMm);
  if (layout.perPage === 0) throw new Error("Card does not fit on the selected paper with these margins.");

  const doc = new jsPDF({
    unit: "mm",
    format: [layout.pageWidth, layout.pageHeight],
    orientation: cfg.orientation,
  });

  const faces: { design: CardDesign; data: CardData }[] = [];
  for (const j of jobs) {
    faces.push({ design: j.front, data: j.data });
    if (includeBack && j.back) faces.push({ design: j.back, data: j.data });
  }

  let placed = 0;
  for (let i = 0; i < faces.length; i++) {
    const slot = placed % layout.perPage;
    if (i > 0 && slot === 0) {
      doc.addPage([layout.pageWidth, layout.pageHeight], cfg.orientation);
    }
    const pos = layout.positions[slot]!;
    const face = faces[i]!;
    const assets = await resolveAssets(face.design, face.data, origin);
    drawDesign(doc, face.design, assets, {
      offsetX: pos.x,
      offsetY: pos.y,
      widthMm: first.widthMm,
      heightMm: first.heightMm,
      data: face.data,
      origin,
    });
    if (cfg.cropMarks) drawCropMarks(doc, pos.x, pos.y, first.widthMm, first.heightMm);
    placed++;
  }
  doc.save(filename);
}
