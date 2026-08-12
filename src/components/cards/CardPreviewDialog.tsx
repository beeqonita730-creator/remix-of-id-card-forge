import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Printer } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { CardRenderer } from "@/components/card/CardRenderer";
import { PrintPortal } from "@/components/card/PrintPortal";
import { getCard, logPrint } from "@/services/db";
import { buildCardJob, cardData, cardDesigns, cardDims, cardFileName, cardSizeCode, type CardRow } from "@/lib/card/job";
import { exportCardPdf } from "@/lib/card/pdf";
import { effectiveStatus, STATUS_LABEL, statusTone } from "@/lib/card/status";
import { formatDims, orientationLabel, normalizeOrientation } from "@/lib/card/orientation";

const PX_PER_MM = 96 / 25.4;

export function CardPreviewDialog({
  cardId,
  open,
  onOpenChange,
  canPrint = true,
}: {
  cardId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  canPrint?: boolean;
}) {
  const [side, setSide] = useState<"front" | "back">("front");
  const [includeBack, setIncludeBack] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data: card, isLoading } = useQuery({
    queryKey: ["card", cardId],
    queryFn: () => getCard(cardId!),
    enabled: !!cardId && open,
  });

  const row = card as CardRow | null | undefined;
  const dims = useMemo(() => (row ? cardDims(row) : { widthMm: 54, heightMm: 85.6 }), [row]);
  const designs = useMemo(() => (row ? cardDesigns(row) : null), [row]);
  const data = useMemo(() => (row ? cardData(row) : {}), [row]);

  const status = row ? effectiveStatus(String(row["status"] ?? "draft"), row["expiry_date"] as string) : "draft";
  const previewScale = Math.min(5, 420 / dims.widthMm);

  const doPrint = async () => {
    if (!row) return;
    setPrinting(true);
    await new Promise((r) => setTimeout(r, 120));
    window.print();
    setPrinting(false);
    await logPrint({
      organization_id: String(row["organization_id"]),
      card_id: row.id,
      print_type: "browser-print",
      template_version: (row["template_version"] as number) ?? null,
      card_size_code: cardSizeCode(row),
      paper: `${formatDims(dims)} card`,
    });
  };

  const doPdf = async () => {
    if (!row) return;
    setBusy(true);
    try {
      const job = buildCardJob(row);
      await exportCardPdf(job, includeBack, cardFileName(row));
      await logPrint({
        organization_id: String(row["organization_id"]),
        card_id: row.id,
        print_type: "pdf",
        template_version: (row["template_version"] as number) ?? null,
        card_size_code: cardSizeCode(row),
        paper: `${formatDims(dims)} card`,
      });
      toast.success("PDF exported");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  };

  const shownDesign = side === "back" ? (designs?.back ?? designs?.front) : designs?.front;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{row ? `${row.full_name} — ${row.card_number}` : "Card preview"}</DialogTitle>
          <DialogDescription>
            {row
              ? `${formatDims(dims)} · ${orientationLabel(normalizeOrientation(row["orientation"], "portrait"))} · true physical scale`
              : "Loading card…"}
          </DialogDescription>
        </DialogHeader>

        {isLoading || !row ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Loading card…</p>
        ) : (
          <>
            <div className="flex items-center gap-2">
              {(["front", "back"] as const).map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={side === s ? "default" : "outline"}
                  className="capitalize"
                  disabled={s === "back" && !designs?.back}
                  onClick={() => setSide(s)}
                >
                  {s}
                </Button>
              ))}
              <Badge variant={statusTone(status)} className="ml-auto">
                {STATUS_LABEL[status] ?? status}
              </Badge>
            </div>

            <div className="canvas-surface flex justify-center rounded-md p-6">
              {shownDesign ? (
                <div style={{ boxShadow: "var(--shadow-card)" }}>
                  <CardRenderer
                    design={shownDesign}
                    widthMm={dims.widthMm}
                    heightMm={dims.heightMm}
                    scale={previewScale}
                    data={data}
                  />
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="inc-back"
                checked={includeBack}
                disabled={!designs?.back}
                onCheckedChange={(v) => setIncludeBack(v === true)}
              />
              <Label htmlFor="inc-back" className="text-sm font-normal">
                Include the back side
              </Label>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button variant="secondary" disabled={!canPrint} onClick={doPrint}>
                <Printer className="size-4" /> Print
              </Button>
              <Button disabled={!canPrint || busy} onClick={doPdf}>
                <Download className="size-4" /> {busy ? "Exporting…" : "Download PDF"}
              </Button>
            </DialogFooter>

            {printing && designs ? (
              <PrintPortal widthMm={dims.widthMm} heightMm={dims.heightMm}>
                <div className="print-page">
                  <CardRenderer
                    design={designs.front}
                    widthMm={dims.widthMm}
                    heightMm={dims.heightMm}
                    scale={PX_PER_MM}
                    data={data}
                  />
                </div>
                {includeBack && designs.back ? (
                  <div className="print-page">
                    <CardRenderer
                      design={designs.back}
                      widthMm={dims.widthMm}
                      heightMm={dims.heightMm}
                      scale={PX_PER_MM}
                      data={data}
                    />
                  </div>
                ) : null}
              </PrintPortal>
            ) : null}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
