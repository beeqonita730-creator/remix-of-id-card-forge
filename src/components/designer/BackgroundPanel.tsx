import { useRef, useState } from "react";
import { Image as ImageIcon, Lock, Unlock, Eye, EyeOff, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { uploadAsset } from "@/services/storage";
import { createTemplateAsset } from "@/services/db";
import {
  ACCEPTED_BACKGROUND_TYPES,
  BACKGROUND_FITS,
  MAX_BACKGROUND_BYTES,
  applyFit,
  backgroundQuality,
  formatBytes,
  readImageMeta,
  type BackgroundFit,
  type CardBackground,
} from "@/lib/card/background";

interface Props {
  background: CardBackground;
  onChange: (patch: Partial<CardBackground>) => void;
  widthMm: number;
  heightMm: number;
  side: "front" | "back";
  templateId: string;
  orientation: "portrait" | "landscape";
  cardSizeId?: string | null;
}

interface Pending {
  file: File;
  url: string;
  storagePath: string;
  width: number;
  height: number;
}

const QUALITY_CLASS: Record<string, string> = {
  excellent: "text-emerald-600",
  good: "text-emerald-600",
  warning: "text-amber-600",
  low: "text-destructive",
  unknown: "text-muted-foreground",
};

export function BackgroundPanel({
  background,
  onChange,
  widthMm,
  heightMm,
  side,
  templateId,
  orientation,
  cardSizeId,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [fit, setFit] = useState<BackgroundFit>("fill");

  const quality = backgroundQuality(background.widthPx, background.heightPx, widthMm, heightMm);

  const pick = async (file: File) => {
    if (file.size > MAX_BACKGROUND_BYTES) {
      toast.error("File is larger than 25 MB");
      return;
    }
    setBusy(true);
    try {
      const meta = await readImageMeta(file);
      const { storagePath, url } = await uploadAsset("template-assets", file);
      setPending({ file, url, storagePath, width: meta.width, height: meta.height });
      setFit("fill");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const confirm = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      let assetId: string | null = null;
      try {
        const rec = await createTemplateAsset({
          template_id: templateId,
          side: side === "front" ? "FRONT" : "BACK",
          asset_type: "BACKGROUND",
          name: pending.file.name,
          storage_path: pending.storagePath,
          file_name: pending.file.name,
          mime_type: pending.file.type,
          width_px: pending.width || null,
          height_px: pending.height || null,
          size_bytes: pending.file.size,
          orientation,
          card_size_id: cardSizeId ?? null,
        });
        assetId = (rec as { id?: string } | null)?.id ?? null;
      } catch {
        /* metadata is best-effort; the design still keeps the artwork */
      }

      const next: CardBackground = applyFit(
        {
          ...background,
          imageUrl: pending.url,
          storagePath: pending.storagePath,
          assetId,
          fileName: pending.file.name,
          mimeType: pending.file.type,
          widthPx: pending.width || null,
          heightPx: pending.height || null,
          sizeBytes: pending.file.size,
          opacity: background.opacity ?? 1,
          rotation: 0,
          locked: true,
          hiddenInEditor: false,
        },
        fit,
        widthMm,
        heightMm,
      );
      onChange(next);
      setPending(null);
      toast.success("Background applied as the base layer");
    } finally {
      setBusy(false);
    }
  };

  const preview = backgroundQuality(pending?.width, pending?.height, widthMm, heightMm);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED_BACKGROUND_TYPES}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) pick(f);
          }}
        />
        <Button
          variant="secondary"
          size="sm"
          className="w-full"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="size-4" /> {busy ? "Uploading…" : "Upload artwork"}
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="color"
          value={background.color ?? "#ffffff"}
          onChange={(e) => onChange({ color: e.target.value })}
          className="h-8 w-9 cursor-pointer rounded border border-border bg-transparent"
          aria-label="Background colour"
        />
        <Input
          className="h-8"
          value={background.color ?? "#ffffff"}
          onChange={(e) => onChange({ color: e.target.value })}
        />
      </div>

      {background.imageUrl ? (
        <div className="space-y-3 rounded-md border border-border p-2">
          <div className="flex items-start gap-2">
            <div
              className="size-12 shrink-0 rounded border border-border bg-muted bg-contain bg-center bg-no-repeat"
              style={{ backgroundImage: `url(${background.imageUrl})` }}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{background.fileName ?? "Background"}</p>
              <p className="text-[11px] text-muted-foreground">
                {background.widthPx ?? "?"}×{background.heightPx ?? "?"} px ·{" "}
                {formatBytes(background.sizeBytes)}
              </p>
              <p className={`text-[11px] ${QUALITY_CLASS[quality.level]}`}>
                {quality.dpi ? `${quality.dpi} DPI · ` : ""}
                {quality.label}
              </p>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Fit mode</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {BACKGROUND_FITS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  title={f.description}
                  onClick={() =>
                    onChange(applyFit(background, f.id, widthMm, heightMm))
                  }
                  className={`rounded-md border px-2 py-1.5 text-[11px] transition-colors ${
                    (background.fit ?? "fill") === f.id
                      ? "border-primary bg-accent"
                      : "border-border hover:border-primary"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {(["x", "y", "w", "h"] as const).map((k) => (
              <div key={k} className="space-y-1">
                <Label className="text-[11px] uppercase text-muted-foreground">{k} (mm)</Label>
                <Input
                  className="h-8"
                  type="number"
                  step="0.5"
                  value={background[k] ?? 0}
                  onChange={(e) => onChange({ [k]: Number(e.target.value) } as Partial<CardBackground>)}
                />
              </div>
            ))}
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">
              Opacity {Math.round((background.opacity ?? 1) * 100)}%
            </Label>
            <Slider
              value={[Math.round((background.opacity ?? 1) * 100)]}
              min={10}
              max={100}
              step={5}
              onValueChange={([v]) => onChange({ opacity: (v ?? 100) / 100 })}
            />
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="flex-1"
              onClick={() => onChange({ locked: !background.locked })}
            >
              {background.locked ? <Lock className="size-4" /> : <Unlock className="size-4" />}
              {background.locked ? "Locked" : "Unlocked"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="flex-1"
              onClick={() => onChange({ hiddenInEditor: !background.hiddenInEditor })}
            >
              {background.hiddenInEditor ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              {background.hiddenInEditor ? "Hidden" : "Visible"}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                onChange({
                  imageUrl: null,
                  storagePath: null,
                  assetId: null,
                  fileName: null,
                  widthPx: null,
                  heightPx: null,
                  sizeBytes: null,
                  x: 0,
                  y: 0,
                  w: 0,
                  h: 0,
                })
              }
            >
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </div>
        </div>
      ) : (
        <p className="rounded-md bg-muted p-2 text-[11px] text-muted-foreground">
          <ImageIcon className="mr-1 inline size-3" />
          Upload an existing card design to use it as the locked base layer, then place dynamic fields on top.
        </p>
      )}

      <Dialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import background</DialogTitle>
            <DialogDescription>
              Choose how the artwork should sit on the {widthMm} × {heightMm} mm canvas.
            </DialogDescription>
          </DialogHeader>
          {pending ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-md border border-border p-2">
                <img
                  src={pending.url}
                  alt=""
                  className="size-16 rounded border border-border object-contain"
                />
                <div className="min-w-0 text-xs">
                  <p className="truncate font-medium">{pending.file.name}</p>
                  <p className="text-muted-foreground">
                    {pending.width}×{pending.height} px · {formatBytes(pending.file.size)}
                  </p>
                  <p className={QUALITY_CLASS[preview.level]}>
                    {preview.dpi ? `${preview.dpi} DPI · ` : ""}
                    {preview.message}
                  </p>
                </div>
              </div>
              <div className="space-y-1.5">
                {BACKGROUND_FITS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFit(f.id)}
                    className={`w-full rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                      fit === f.id ? "border-primary bg-accent" : "border-border hover:border-primary"
                    }`}
                  >
                    <span className="block font-semibold">{f.label}</span>
                    <span className="text-muted-foreground">{f.description}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button onClick={confirm} disabled={busy}>
              Apply background
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
