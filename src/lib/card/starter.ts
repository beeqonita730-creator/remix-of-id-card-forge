import { createElement, emptyDesign, type CardDesign } from "./types";

/** A clean, professional default layout scaled to the chosen card size. */
export function starterDesign(widthMm: number, heightMm: number, orgName = "{{organization}}"): CardDesign {
  const d = emptyDesign();
  d.background.color = "#ffffff";
  const pad = Math.max(3, widthMm * 0.05);
  const headerH = Math.max(8, heightMm * 0.2);
  const photoW = Math.min(22, widthMm * 0.26);
  const photoH = photoW * 1.27;

  d.elements = [
    createElement("rect", {
      name: "Header band",
      x: 0,
      y: 0,
      w: widthMm,
      h: headerH,
      z: 1,
      radius: 0,
      fill: "#1e3a8a",
    }),
    createElement("text", {
      name: "Organisation",
      text: orgName,
      x: pad,
      y: headerH * 0.22,
      w: widthMm - pad * 2,
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
      w: widthMm - pad * 2,
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
      x: pad * 1.6 + photoW,
      y: headerH + pad * 0.6,
      w: widthMm - photoW - pad * 2.6,
      h: 6,
      fontSize: 10,
      fontWeight: 700,
      color: "#0f172a",
      z: 3,
    }),
    createElement("text", {
      name: "Position",
      text: "{{position}}",
      x: pad * 1.6 + photoW,
      y: headerH + pad * 0.6 + 6,
      w: widthMm - photoW - pad * 2.6,
      h: 5,
      fontSize: 7,
      fontWeight: 500,
      color: "#475569",
      z: 3,
    }),
    createElement("text", {
      name: "ID number",
      text: "ID {{card_number}}",
      x: pad * 1.6 + photoW,
      y: headerH + pad * 0.6 + 11.5,
      w: widthMm - photoW - pad * 2.6,
      h: 5,
      fontSize: 6.5,
      fontWeight: 600,
      color: "#1e3a8a",
      z: 3,
    }),
    createElement("text", {
      name: "Valid until",
      text: "Valid until {{expiry_date}}",
      x: pad * 1.6 + photoW,
      y: heightMm - pad - 4,
      w: widthMm - photoW - pad * 2.6 - 16,
      h: 4,
      fontSize: 5.5,
      fontWeight: 500,
      color: "#64748b",
      z: 3,
    }),
    createElement("qr", {
      name: "Verification QR",
      x: widthMm - pad - 14,
      y: heightMm - pad - 14,
      w: 14,
      h: 14,
      z: 4,
    }),
  ];
  return d;
}

export function starterBackDesign(widthMm: number, heightMm: number): CardDesign {
  const d = emptyDesign();
  d.background.color = "#f8fafc";
  const pad = Math.max(3, widthMm * 0.05);
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
      y: heightMm - pad - 12,
      w: widthMm - pad * 2,
      h: 12,
      z: 2,
    }),
  ];
  return d;
}
