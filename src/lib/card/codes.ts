import QRCode from "qrcode";
import JsBarcode from "jsbarcode";

const cache = new Map<string, string>();

export async function qrDataUrl(content: string, color = "#000000"): Promise<string> {
  const key = `qr:${content}:${color}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const url = await QRCode.toDataURL(content || " ", {
    margin: 0,
    width: 512,
    errorCorrectionLevel: "M",
    color: { dark: color, light: "#ffffff00" },
  });
  cache.set(key, url);
  return url;
}

export function barcodeDataUrl(content: string, color = "#000000"): string {
  const key = `bc:${content}:${color}`;
  const hit = cache.get(key);
  if (hit) return hit;
  if (typeof document === "undefined") return "";
  const canvas = document.createElement("canvas");
  try {
    JsBarcode(canvas, content || "0000", {
      format: "CODE128",
      displayValue: false,
      margin: 0,
      lineColor: color,
      background: "#ffffff00",
      width: 2,
      height: 80,
    });
  } catch {
    return "";
  }
  const url = canvas.toDataURL("image/png");
  cache.set(key, url);
  return url;
}

/** Fetch any image URL and return a data URL usable by jsPDF. */
export async function toDataUrl(url: string): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith("data:")) return url;
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
