import { createElement, emptyDesign, type CardDesign } from "./types";

/**
 * A clean, professional default layout.
 * Portrait  → logo, centred photo, stacked information, QR at the bottom.
 * Landscape → logo band, photo on the left, information on the right, QR bottom-right.
 * The layout is derived from the physical dimensions, never from hard-coded orientation.
 */
export function starterDesign(widthMm: number, heightMm: number, orgName = "{{organization}}"): CardDesign {
  return widthMm >= heightMm
    ? landscapeFront(widthMm, heightMm, orgName)
    : portraitFront(widthMm, heightMm, orgName);
}

function portraitFront(W: number, H: number, orgName: string): CardDesign {
  const d = emptyDesign();
  const pad = Math.max(3, W * 0.08);
  const headerH = Math.max(9, H * 0.14);
  const photoW = Math.min(W - pad * 2, W * 0.5);
  const photoH = photoW * 1.27;
  const photoY = headerH + Math.max(3, H * 0.05);
  const infoY = photoY + photoH + 3;
  const qr = Math.min(16, W * 0.3);

  d.elements = [
    createElement("rect", {
      name: "Header band",
      x: 0,
      y: 0,
      w: W,
      h: headerH,
      z: 1,
      radius: 0,
      fill: "#1e3a8a",
    }),
    createElement("text", {
      name: "Organisation",
      text: orgName,
      x: pad,
      y: headerH * 0.2,
      w: W - pad * 2,
      h: headerH * 0.42,
      fontSize: 8,
      fontWeight: 700,
      color: "#ffffff",
      align: "center",
      transform: "uppercase",
      z: 2,
    }),
    createElement("text", {
      name: "Card title",
      text: "IDENTITY CARD",
      x: pad,
      y: headerH * 0.62,
      w: W - pad * 2,
      h: headerH * 0.3,
      fontSize: 5,
      fontWeight: 500,
      color: "#c7d2fe",
      align: "center",
      letterSpacing: 0.4,
      z: 2,
    }),
    createElement("photo", {
      name: "Photo",
      x: (W - photoW) / 2,
      y: photoY,
      w: photoW,
      h: photoH,
      radius: 1,
      z: 3,
    }),
    createElement("text", {
      name: "Full name",
      text: "{{full_name}}",
      x: pad,
      y: infoY,
      w: W - pad * 2,
      h: 6,
      fontSize: 9.5,
      fontWeight: 700,
      color: "#0f172a",
      align: "center",
      z: 3,
    }),
    createElement("text", {
      name: "Position",
      text: "{{position}}",
      x: pad,
      y: infoY + 6.5,
      w: W - pad * 2,
      h: 5,
      fontSize: 7,
      fontWeight: 500,
      color: "#475569",
      align: "center",
      z: 3,
    }),
    createElement("text", {
      name: "ID number",
      text: "ID {{card_number}}",
      x: pad,
      y: infoY + 12,
      w: W - pad * 2,
      h: 5,
      fontSize: 6.5,
      fontWeight: 600,
      color: "#1e3a8a",
      align: "center",
      z: 3,
    }),
    createElement("qr", {
      name: "Verification QR",
      x: (W - qr) / 2,
      y: H - pad - qr,
      w: qr,
      h: qr,
      z: 4,
    }),
  ];
  return d;
}

function landscapeFront(W: number, H: number, orgName: string): CardDesign {
  const d = emptyDesign();
  const pad = Math.max(3, W * 0.05);
  const headerH = Math.max(8, H * 0.2);
  const photoW = Math.min(22, W * 0.26);
  const photoH = Math.min(photoW * 1.27, H - headerH - pad * 1.4);
  const infoX = pad * 1.6 + photoW;
  const infoW = W - photoW - pad * 2.6;
  const qr = Math.min(14, H * 0.28);

  d.elements = [
    createElement("rect", { name: "Header band", x: 0, y: 0, w: W, h: headerH, z: 1, radius: 0, fill: "#1e3a8a" }),
    createElement("text", {
      name: "Organisation",
      text: orgName,
      x: pad,
      y: headerH * 0.22,
      w: W - pad * 2,
      h: headerH * 0.4,
      fontSize: 9,
      fontWeight: 700,
      color: "#ffffff",
      transform: "uppercase",
      z: 2,
    }),
    createElement("text", {
      name: "Card title",
      text: "IDENTITY CARD",
      x: pad,
      y: headerH * 0.62,
      w: W - pad * 2,
      h: headerH * 0.3,
      fontSize: 5.5,
      fontWeight: 500,
      color: "#c7d2fe",
      letterSpacing: 0.4,
      z: 2,
    }),
    createElement("photo", {
      name: "Photo",
      x: pad,
      y: headerH + pad * 0.6,
      w: photoW,
      h: photoH,
      radius: 1,
      z: 3,
    }),
    createElement("text", {
      name: "Full name",
      text: "{{full_name}}",
      x: infoX,
      y: headerH + pad * 0.6,
      w: infoW,
      h: 6,
      fontSize: 10,
      fontWeight: 700,
      color: "#0f172a",
      z: 3,
    }),
    createElement("text", {
      name: "Position",
      text: "{{position}}",
      x: infoX,
      y: headerH + pad * 0.6 + 6,
      w: infoW,
      h: 5,
      fontSize: 7,
      fontWeight: 500,
      color: "#475569",
      z: 3,
    }),
    createElement("text", {
      name: "ID number",
      text: "ID {{card_number}}",
      x: infoX,
      y: headerH + pad * 0.6 + 11.5,
      w: infoW,
      h: 5,
      fontSize: 6.5,
      fontWeight: 600,
      color: "#1e3a8a",
      z: 3,
    }),
    createElement("text", {
      name: "Valid until",
      text: "Valid until {{expiry_date}}",
      x: pad,
      y: H - pad - 4,
      w: W - pad * 2 - qr - 2,
      h: 4,
      fontSize: 5.5,
      fontWeight: 500,
      color: "#64748b",
      z: 3,
    }),
    createElement("qr", {
      name: "Verification QR",
      x: W - pad - qr,
      y: H - pad - qr,
      w: qr,
      h: qr,
      z: 4,
    }),
  ];
  return d;
}

export function starterBackDesign(widthMm: number, heightMm: number): CardDesign {
  const d = emptyDesign();
  d.background.color = "#f8fafc";
  const pad = Math.max(3, widthMm * 0.05);
  const barcodeH = Math.min(12, heightMm * 0.2);
  d.elements = [
    createElement("text", {
      name: "Notice title",
      text: "TERMS OF USE",
      x: pad,
      y: pad,
      w: widthMm - pad * 2,
      h: 5,
      fontSize: 7,
      fontWeight: 700,
      color: "#0f172a",
      z: 1,
    }),
    createElement("text", {
      name: "Notice",
      text: "This card remains the property of {{organization}}. If found, please return it to the issuing office.",
      x: pad,
      y: pad + 6,
      w: widthMm - pad * 2,
      h: 12,
      fontSize: 5,
      fontWeight: 400,
      color: "#475569",
      autoFit: false,
      z: 1,
    }),
    createElement("barcode", {
      name: "Barcode",
      x: pad,
      y: heightMm - pad - barcodeH,
      w: widthMm - pad * 2,
      h: barcodeH,
      z: 2,
    }),
  ];
  return d;
}
