export type Unit = "mm" | "cm" | "inch";

export function toMm(value: number, unit: Unit): number {
  if (unit === "cm") return value * 10;
  if (unit === "inch") return value * 25.4;
  return value;
}

export function fromMm(mm: number, unit: Unit): number {
  if (unit === "cm") return mm / 10;
  if (unit === "inch") return mm / 25.4;
  return mm;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

export const formatMm = (n: number) => `${round2(n)} mm`;

export const PAPERS: Record<string, { name: string; width_mm: number; height_mm: number }> = {
  A4: { name: "A4", width_mm: 210, height_mm: 297 },
  A3: { name: "A3", width_mm: 297, height_mm: 420 },
  LETTER: { name: "Letter", width_mm: 215.9, height_mm: 279.4 },
};
