export type ElementType =
  | "text"
  | "image"
  | "photo"
  | "logo"
  | "qr"
  | "barcode"
  | "rect"
  | "circle"
  | "line";

export interface BaseElement {
  id: string;
  type: ElementType;
  name?: string;
  /** millimetres from the left edge of the trim area */
  x: number;
  /** millimetres from the top edge of the trim area */
  y: number;
  w: number;
  h: number;
  rotation: number;
  opacity: number;
  z: number;
  locked?: boolean;
  visible?: boolean;
}

export interface TextElement extends BaseElement {
  type: "text";
  text: string;
  fontFamily: string;
  /** points */
  fontSize: number;
  fontWeight: number;
  color: string;
  align: "left" | "center" | "right";
  letterSpacing: number;
  lineHeight: number;
  transform: "none" | "uppercase" | "lowercase" | "capitalize";
  autoFit: boolean;
}

export interface ImageElement extends BaseElement {
  type: "image" | "photo" | "logo";
  src?: string | null;
  fit: "cover" | "contain" | "fill";
  objectPosition: string;
  radius: number;
  borderWidth: number;
  borderColor: string;
}

export interface CodeElement extends BaseElement {
  type: "qr" | "barcode";
  content: string;
  color: string;
}

export interface ShapeElement extends BaseElement {
  type: "rect" | "circle" | "line";
  fill: string;
  stroke: string;
  strokeWidth: number;
  radius: number;
}

export type CardElement = TextElement | ImageElement | CodeElement | ShapeElement;

export interface CardDesign {
  background: { color: string; imageUrl?: string | null };
  elements: CardElement[];
}

export interface CardSize {
  id: string;
  name: string;
  code: string;
  width_mm: number;
  height_mm: number;
  orientation: string;
  category: string | null;
  description: string | null;
  is_system_default: boolean;
  active: boolean;
  organization_id: string | null;
}

export const emptyDesign = (): CardDesign => ({
  background: { color: "#ffffff", imageUrl: null },
  elements: [],
});

export const PT_TO_MM = 0.352778;

let counter = 0;
export function newId() {
  counter += 1;
  return `el_${Date.now().toString(36)}_${counter}`;
}

const base = (type: ElementType, over: Partial<BaseElement>): BaseElement => ({
  id: newId(),
  type,
  x: 5,
  y: 5,
  w: 30,
  h: 8,
  rotation: 0,
  opacity: 1,
  z: 1,
  visible: true,
  ...over,
});

export function createElement(type: ElementType, over: Partial<CardElement> = {}): CardElement {
  switch (type) {
    case "text":
      return {
        ...base("text", over),
        type: "text",
        text: "Text",
        fontFamily: "Inter",
        fontSize: 10,
        fontWeight: 600,
        color: "#111827",
        align: "left",
        letterSpacing: 0,
        lineHeight: 1.2,
        transform: "none",
        autoFit: true,
        ...over,
      } as TextElement;
    case "photo":
    case "logo":
    case "image":
      return {
        ...base(type, { w: 22, h: 28, ...over }),
        type,
        src: null,
        fit: "cover",
        objectPosition: "center",
        radius: type === "logo" ? 0 : 1,
        borderWidth: 0,
        borderColor: "#111827",
        ...over,
      } as ImageElement;
    case "qr":
      return {
        ...base("qr", { w: 18, h: 18, ...over }),
        type: "qr",
        content: "{{verification_url}}",
        color: "#000000",
        ...over,
      } as CodeElement;
    case "barcode":
      return {
        ...base("barcode", { w: 40, h: 10, ...over }),
        type: "barcode",
        content: "{{card_number}}",
        color: "#000000",
        ...over,
      } as CodeElement;
    case "line":
      return {
        ...base("line", { w: 40, h: 0.6, ...over }),
        type: "line",
        fill: "#111827",
        stroke: "#111827",
        strokeWidth: 0.6,
        radius: 0,
        ...over,
      } as ShapeElement;
    default:
      return {
        ...base(type, { w: 30, h: 12, ...over }),
        type: type as "rect" | "circle",
        fill: "#1e3a8a",
        stroke: "transparent",
        strokeWidth: 0,
        radius: type === "circle" ? 999 : 1,
        ...over,
      } as ShapeElement;
  }
}
