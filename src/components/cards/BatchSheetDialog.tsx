import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Layers } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { getCard, logPrint } from "@/services/db";
import { buildCardJob, cardDims, cardSizeCode, type CardRow } from "@/lib/card/job";
import { exportSheetPdf } from "@/lib/card/pdf";
import { computeSheet, defaultSheetConfig, type SheetConfig } from "@/lib/card/sheet";
import { PAPERS } from "@/lib/card/units";
import { formatDims } from "@/lib/card/orientation";

const PAPER_KEYS = Object.keys(PAPERS);

export function BatchSheetDialog({
  cardIds,
  open,
  onOpenChange,
  canPrint = true,
}: {
  cardIds: string[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  canPrint?: boolean;
}) {
  const [cfg, setCfg] = useState<SheetConfig>(defaultSheetConfig);
  const [includeBack, setIncludeBack] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dims, setDims] = useState({ widthMm: 54, heightMm: 85.6 });

  const set = <K extends keyof SheetConfig>(k: K, v: SheetConfig[K]) =>
    setCfg((c) => ({ ...c, [k]: v }));

  const layout = useMemo(() => computeSheet(cfg, dims.widthMm, dims.heightMm), [cfg, dims]);
  const faceCount = cardIds.length * (includeBack ? 2 : 1);
  const sheets = layout.perPage > 0 ? Math.ceil(faceCount / layout.perPage) : 0;

  const run = async () => {
    if (cardIds.length === 0) return;
    setBusy(true);
    try {
      const rows: CardRow[] = [];
      for (const id of cardIds) {
        const row = (await getCard(id)) as CardRow | null;
        if (row) rows.push(row);
      }
      if (rows.length === 0) throw new Error("No cards could be loaded.");
      const first = rows[0]!;
      setDims(cardDims(first));
      const jobs = rows.map(buildCardJob);
      await exportSheetPdf(jobs, cfg, includeBack, `sheet-${rows.length}-cards.pdf`);
      await logPrint({
        organization_id: String(first["organization_id"]),
        print_type: "sheet-pdf",
        card_size_code: cardSizeCode(first),
        paper: `${cfg.paper} ${cfg.orientation}`,
        notes: `${rows.length} cards · ${layout.perPage}/sheet`,
      });
      toast.success(`Exported ${rows.length} cards`);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sheet export failed");
    } finally {
      setBusy(false);
    }
  };

  const num = (label: string, key: keyof SheetConfig) => (
    <div className="space-y-1.5" key={key as string}>
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        step="0.5"
        min={0}
        value={String(cfg[key] as number)}
        onChange={(e) => set(key, (Number(e.target.value) || 0) as never)}
      />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Batch sheet export</DialogTitle>
          <DialogDescription>
            Impose {cardIds.length} card{cardIds.length === 1 ? "" : "s"} ({formatDims(dims)} each) onto
            paper at true physical size.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Paper</Label>
            <select
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              value={cfg.paper as string}
              onChange={(e) => set("paper", e.target.value as SheetConfig["paper"])}
            >
              {PAPER_KEYS.map((k) => (
                <option key={k} value={k}>
                  {PAPERS[k]!.name} ({PAPERS[k]!.width_mm}×{PAPERS[k]!.height_mm} mm)
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Paper orientation</Label>
            <select
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              value={cfg.orientation}
              onChange={(e) => set("orientation", e.target.value as SheetConfig["orientation"])}
            >
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </div>
          {num("Margin top (mm)", "marginTop")}
          {num("Margin right (mm)", "marginRight")}
          {num("Margin bottom (mm)", "marginBottom")}
          {num("Margin left (mm)", "marginLeft")}
          {num("Gap X (mm)", "gapX")}
          {num("Gap Y (mm)", "gapY")}
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <Checkbox
              id="crop"
              checked={cfg.cropMarks}
              onCheckedChange={(v) => set("cropMarks", v === true)}
            />
            <Label htmlFor="crop" className="text-sm font-normal">
              Crop marks
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="sheet-back"
              checked={includeBack}
              onCheckedChange={(v) => setIncludeBack(v === true)}
            />
            <Label htmlFor="sheet-back" className="text-sm font-normal">
              Include back sides
            </Label>
          </div>
        </div>

        <div className="rounded-md border bg-muted/40 p-3 text-sm">
          <p>
            <span className="font-medium">{layout.columns} × {layout.rows}</span> = {layout.perPage} cards
            per sheet on {layout.pageWidth}×{layout.pageHeight} mm
          </p>
          <p className="text-muted-foreground">
            {faceCount} face{faceCount === 1 ? "" : "s"} → {sheets} sheet{sheets === 1 ? "" : "s"}
          </p>
          {layout.perPage === 0 ? (
            <p className="text-destructive">Card does not fit with these margins.</p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!canPrint || busy || layout.perPage === 0 || cardIds.length === 0} onClick={run}>
            <Layers className="size-4" /> {busy ? "Exporting…" : "Export sheet PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
