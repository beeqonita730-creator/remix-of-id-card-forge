import { useEffect } from "react";
import { createPortal } from "react-dom";

/**
 * Renders its children into #print-root and pins the page size to the exact
 * physical dimensions so the browser prints at 1:1 with no scaling.
 */
export function PrintPortal({
  widthMm,
  heightMm,
  children,
}: {
  widthMm: number;
  heightMm: number;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const style = document.createElement("style");
    style.setAttribute("data-print-page", "");
    style.textContent = `@page { size: ${widthMm}mm ${heightMm}mm; margin: 0; }`;
    document.head.appendChild(style);
    return () => {
      style.remove();
    };
  }, [widthMm, heightMm]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div id="print-root" style={{ position: "fixed", left: -99999, top: 0 }}>
      {children}
    </div>,
    document.body,
  );
}
