import { useEffect } from "react";
import { createPortal } from "react-dom";

/**
 * Renders its children into #print-root and pins the page size to the exact
 * physical dimensions so the browser prints at 1:1 with no scaling.
 * On screen the portal is collapsed; in print it fills the page.
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
    style.textContent = `
      @page { size: ${widthMm}mm ${heightMm}mm; margin: 0; }
      @media print {
        #print-root {
          position: absolute !important;
          inset: 0 !important;
          height: auto !important;
          overflow: visible !important;
        }
      }
    `;
    document.head.appendChild(style);
    return () => {
      style.remove();
    };
  }, [widthMm, heightMm]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div id="print-root" style={{ height: 0, overflow: "hidden" }}>
      {children}
    </div>,
    document.body,
  );
}
