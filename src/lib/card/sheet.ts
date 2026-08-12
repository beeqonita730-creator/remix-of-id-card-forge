import { PAPERS } from "./units";

export interface SheetConfig {
  paper: keyof typeof PAPERS | "CUSTOM";
  customWidth?: number;
  customHeight?: number;
  orientation: "portrait" | "landscape";
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  gapX: number;
  gapY: number;
  cropMarks: boolean;
}

export const defaultSheetConfig: SheetConfig = {
  paper: "A4",
  orientation: "portrait",
  marginTop: 10,
  marginRight: 10,
  marginBottom: 10,
  marginLeft: 10,
  gapX: 4,
  gapY: 4,
  cropMarks: true,
};

export interface SheetLayout {
  pageWidth: number;
  pageHeight: number;
  columns: number;
  rows: number;
  perPage: number;
  usedArea: number;
  totalArea: number;
  remainingArea: number;
  positions: { x: number; y: number }[];
}

export function computeSheet(cfg: SheetConfig, cardW: number, cardH: number): SheetLayout {
  const paper =
    cfg.paper === "CUSTOM"
      ? { width_mm: cfg.customWidth ?? 210, height_mm: cfg.customHeight ?? 297 }
      : (PAPERS[cfg.paper] ?? PAPERS["A4"]!);
  const pageWidth = cfg.orientation === "landscape" ? paper.height_mm : paper.width_mm;
  const pageHeight = cfg.orientation === "landscape" ? paper.width_mm : paper.height_mm;

  const availW = pageWidth - cfg.marginLeft - cfg.marginRight;
  const availH = pageHeight - cfg.marginTop - cfg.marginBottom;

  const columns = Math.max(0, Math.floor((availW + cfg.gapX) / (cardW + cfg.gapX)));
  const rows = Math.max(0, Math.floor((availH + cfg.gapY) / (cardH + cfg.gapY)));

  const positions: { x: number; y: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      positions.push({
        x: cfg.marginLeft + c * (cardW + cfg.gapX),
        y: cfg.marginTop + r * (cardH + cfg.gapY),
      });
    }
  }
  const totalArea = pageWidth * pageHeight;
  const usedArea = positions.length * cardW * cardH;

  return {
    pageWidth,
    pageHeight,
    columns,
    rows,
    perPage: positions.length,
    usedArea,
    totalArea,
    remainingArea: totalArea - usedArea,
    positions,
  };
}
