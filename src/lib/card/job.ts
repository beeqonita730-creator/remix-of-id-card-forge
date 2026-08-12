import { emptyDesign, type CardDesign } from "./types";
import type { CardData } from "./fields";
import { normalizeOrientation, resolveDims, type Orientation } from "./orientation";
import type { CardJob } from "./pdf";

/** A card row as returned by listCards()/getCard() — loose on purpose. */
export type CardRow = Record<string, unknown> & {
  id: string;
  card_number: string;
  full_name: string;
};

interface SizeRow {
  id?: string;
  name?: string;
  code?: string;
  width_mm: number;
  height_mm: number;
  orientation?: string | null;
}

function pickDesign(value: unknown): CardDesign | null {
  if (!value || typeof value !== "object") return null;
  const d = value as CardDesign;
  return Array.isArray(d.elements) ? d : null;
}

export function cardDesigns(card: CardRow): { front: CardDesign; back: CardDesign | null } {
  const snapshot = card["snapshot"] as { front_design?: unknown; back_design?: unknown } | null;
  const template = card["card_templates"] as { front_design?: unknown; back_design?: unknown } | null;
  const front =
    pickDesign(snapshot?.front_design) ?? pickDesign(template?.front_design) ?? emptyDesign();
  const back = pickDesign(snapshot?.back_design) ?? pickDesign(template?.back_design);
  return { front, back };
}

export function cardData(card: CardRow): CardData {
  const g = <T,>(k: string) => card[k] as T;
  return {
    card_number: g<string>("card_number"),
    full_name: g<string>("full_name"),
    identification_number: g<string>("identification_number"),
    nik: g<string>("nik"),
    birth_place: g<string>("birth_place"),
    birth_date: g<string>("birth_date"),
    gender: g<string>("gender"),
    address: g<string>("address"),
    phone: g<string>("phone"),
    email: g<string>("email"),
    organization: g<string>("organization"),
    department: g<string>("department"),
    position: g<string>("position"),
    membership_number: g<string>("membership_number"),
    issue_date: g<string>("issue_date"),
    expiry_date: g<string>("expiry_date"),
    status: g<string>("status"),
    qr_token: g<string>("qr_token"),
    photo_url: g<string>("photo_url"),
    custom_fields: (card["custom_fields"] as Record<string, string> | null) ?? null,
  };
}

export function cardOrientation(card: CardRow): Orientation {
  return normalizeOrientation(card["orientation"], "portrait");
}

export function cardDims(card: CardRow) {
  const size = (card["card_sizes"] as SizeRow | null) ?? null;
  return resolveDims(size, cardOrientation(card));
}

export function cardSizeCode(card: CardRow): string | null {
  const size = card["card_sizes"] as SizeRow | null;
  return size?.code ?? null;
}

export function buildCardJob(card: CardRow): CardJob {
  const { front, back } = cardDesigns(card);
  const dims = cardDims(card);
  return { front, back, data: cardData(card), widthMm: dims.widthMm, heightMm: dims.heightMm };
}

export function cardFileName(card: CardRow, suffix = "") {
  const base = `${card.card_number ?? "card"}-${(card.full_name ?? "").replace(/[^\w]+/g, "-")}`;
  return `${base}${suffix}.pdf`.replace(/-+/g, "-");
}
