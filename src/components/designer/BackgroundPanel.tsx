import { useEffect, useRef, useState } from "react";
import {
  Image as ImageIcon,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Trash2,
  Upload,
  Library,
  RefreshCw,
  RotateCw,
  AlignHorizontalJustifyCenter,
} from "lucide-react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { uploadAsset, signedUrl } from "@/services/storage";
import { createTemplateAsset } from "@/services/db";
import { BackgroundPickerDialog } from "@/components/designer/BackgroundPickerDialog";
import type { BackgroundAssetRow } from "@/components/designer/BackgroundLibrary";
import {
  ACCEPTED_BACKGROUND_TYPES,
  BACKGROUND_FITS,
  MAX_BACKGROUND_BYTES,
  applyFit,
  backgroundBox,
  backgroundQuality,
  computeFitBox,
  DEFAULT_FIT,
  formatBytes,
  readImageMeta,
  type BackgroundFit,
  type BackgroundGradient,
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
  /** increment to open the file picker from outside (header button) */
  uploadSignal?: number;
  /** increment to open the background library picker from outside */
  librarySignal?: number;
  /** a file dropped onto the canvas, handled once then cleared */
  droppedFile?: File | null;
  onDroppedFileHandled?: () => void;
}

interface Pending {
  file: File;
  url: string;
  storagePath: string;
  width: number;
  height: number;
  replacing: boolean;
}

const QUALITY_CLASS: Record<string, string> = {
  excellent: "text-emerald-600",
  good: "text-emerald-600",
  warning: "text-amber-600",
  low: "text-destructive",
  unknown: "text-muted-foreground",
};

type AlignH = "left" | "center" | "right";
type AlignV = "top" | "middle" | "bottom";

const ALIGNMENTS: { id: string; short: string; label: string; h: AlignH; v: AlignV }[] = [
  { id: "tl", short: "↖", label: "Top left", h: "left", v: "top" },
  { id: "tc", short: "↑", label: "Top centre", h: "center", v: "top" },
  { id: "tr", short: "↗", label: "Top right", h: "right", v: "top" },
  { id: "ml", short: "←", label: "Middle left", h: "left", v: "middle" },
  { id: "mc", short: "•", label: "Centre", h: "center", v: "middle" },
  { id: "mr", short: "→", label: "Middle right", h: "right", v: "middle" },
  { id: "bl", short: "↙", label: "Bottom left", h: "left", v: "bottom" },
  { id: "bc", short: "↓", label: "Bottom centre", h: "center", v: "bottom" },
  { id: "br", short: "↘", label: "Bottom right", h: "right", v: "bottom" },
];

const DEFAULT_GRADIENT: BackgroundGradient = {
  type: "linear",
  angle: 180,
  stops: [
    { color: "#1e3a8a", at: 0 },
    { color: "#0ea5e9", at: 100 },
  ],
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
  uploadSignal,
  librarySignal,
  droppedFile,
  onDroppedFileHandled,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [fit, setFit] = useState<BackgroundFit>("fill");
  const [library, setLibrary] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const firstSignal = useRef(uploadSignal);
  const firstLibrarySignal = useRef(librarySignal);

  useEffect(() => {
    if (uploadSignal === undefined || uploadSignal === firstSignal.current) return;
    firstSignal.current = uploadSignal;
    fileRef.current?.click();
  }, [uploadSignal]);

  useEffect(() => {
    if (librarySignal === undefined || librarySignal === firstLibrarySignal.current) return;
    firstLibrarySignal.current = librarySignal;
    setLibrary(true);
  }, [librarySignal]);

  const quality = backgroundQuality(background.widthPx, background.heightPx, widthMm, heightMm);
  const hasImage = !!background.imageUrl;

  const pick = async (file: File) => {
    if (file.size > MAX_BACKGROUND_BYTES) {
      toast.error(`File is larger than ${Math.round(MAX_BACKGROUND_BYTES / (1024 * 1024))} MB`);
      return;
    }
    setBusy(true);
    try {
      const meta = await readImageMeta(file);
      const { storagePath, url } = await uploadAsset("template-assets", file);
      setPending({ file, url, storagePath, width: meta.width, height: meta.height, replacing: hasImage });
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
      toast.success("Background imported successfully — place dynamic fields on top.");
    } finally {
      setBusy(false);
    }
  };

  const useFromLibrary = async (asset: BackgroundAssetRow) => {
    setBusy(true);
    try {
      const url = await signedUrl(asset.storage_path);
      if (!url) throw new Error("Could not open that artwork");
      onChange(
        applyFit(
          {
            ...background,
            imageUrl: url,
            storagePath: asset.storage_path,
            assetId: asset.id,
            fileName: asset.file_name ?? asset.name ?? "Background",
            mimeType: asset.mime_type ?? null,
            widthPx: asset.width_px,
            heightPx: asset.height_px,
            sizeBytes: asset.size_bytes,
            rotation: 0,
            locked: true,
            hiddenInEditor: false,
          },
          background.fit ?? "fill",
          widthMm,
          heightMm,
        ),
      );
      setLibrary(false);
      toast.success("Background applied from the library");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not apply background");
    } finally {
      setBusy(false);
    }
  };

  const handledDrop = useRef<File | null>(null);
  useEffect(() => {
    if (!droppedFile || handledDrop.current === droppedFile) return;
    handledDrop.current = droppedFile;
    void pick(droppedFile).finally(() => onDroppedFileHandled?.());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [droppedFile]);

  const remove = () => {
    onChange({
      imageUrl: null,
      storagePath: null,
      assetId: null,
      fileName: null,
      mimeType: null,
      widthPx: null,
      heightPx: null,
      sizeBytes: null,
      x: 0,
      y: 0,
      w: 0,
      h: 0,
      rotation: 0,
    });
    setConfirmRemove(false);
    toast.success("Background removed — the card keeps its background colour.");
  };

  const box = backgroundBox(background, widthMm, heightMm);
  const scalePct = background.widthPx && box.w ? Math.round((box.w / (widthMm || 1)) * 100) : 100;

  const setScale = (pct: number) => {
    const k = pct / 100;
    const base = computeFitBox(
      background.fit ?? DEFAULT_FIT,
      background.widthPx,
      background.heightPx,
      widthMm,
      heightMm,
    );
    const w = base.w * k;
    const h = base.h * k;
    onChange({
      w: Math.round(w * 100) / 100,
      h: Math.round(h * 100) / 100,
      x: Math.round((base.x + (base.w - w) / 2) * 100) / 100,
      y: Math.round((base.y + (base.h - h) / 2) * 100) / 100,
    });
  };

  const gradient = background.gradient ?? null;

  const artworkLandscape =
    background.widthPx && background.heightPx ? background.widthPx >= background.heightPx : null;
  const cardLandscape = widthMm >= heightMm;
  const canAutoRotate = artworkLandscape !== null && artworkLandscape !== cardLandscape;

  const autoRotate = () => {
    const next = ((background.rotation ?? 0) + 90) % 360;
    onChange({ ...applyFit(background, background.fit ?? DEFAULT_FIT, widthMm, heightMm), rotation: next });
    toast.success(`Artwork rotated to match the ${cardLandscape ? "landscape" : "portrait"} card`);
  };

  const align = (h: AlignH, v: AlignV) => {
    const b = backgroundBox(background, widthMm, heightMm);
    const x = h === "left" ? 0 : h === "right" ? widthMm - b.w : (widthMm - b.w) / 2;
    const y = v === "top" ? 0 : v === "bottom" ? heightMm - b.h : (heightMm - b.h) / 2;
    onChange({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 });
  };

  const patchGradient = (patch: Partial<BackgroundGradient>) =>
    onChange({ gradient: { ...DEFAULT_GRADIENT, ...gradient, ...patch } });

  const preview = backgroundQuality(pending?.width, pending?.height, widthMm, heightMm);

  return (
    <div className="space-y-3">
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
      <div className="grid grid-cols-2 gap-1.5">
        <Button size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
          {hasImage ? <RefreshCw className="size-4" /> : <Upload className="size-4" />}
          {busy ? "Working…" : hasImage ? "Replace" : "Upload"}
        </Button>
        <Button variant="secondary" size="sm" disabled={busy} onClick={() => setLibrary(true)}>
          <Library className="size-4" /> Library
        </Button>
      </div>

      <div className="space-y-1">
        <Label className="text-[11px] text-muted-foreground">Background colour</Label>
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
      </div>

      <div className="space-y-2 rounded-md border border-border p-2">
        <div className="flex items-center justify-between">
          <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Gradient</Label>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[11px]"
            onClick={() => onChange({ gradient: gradient ? null : DEFAULT_GRADIENT })}
          >
            {gradient ? "Remove" : "Add"}
          </Button>
        </div>
        {gradient ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-1.5">
              {(["linear", "radial"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => patchGradient({ type: t })}
                  className={`rounded-md border px-2 py-1.5 text-[11px] capitalize transition-colors ${
                    (gradient.type ?? "linear") === t ? "border-primary bg-accent" : "border-border hover:border-primary"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            {gradient.type !== "radial" ? (
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Angle {gradient.angle ?? 180}°</Label>
                <Slider
                  value={[gradient.angle ?? 180]}
                  min={0}
                  max={360}
                  step={5}
                  onValueChange={([v]) => patchGradient({ angle: v ?? 180 })}
                />
              </div>
            ) : null}
            <div className="space-y-1.5">
              {(gradient.stops ?? []).map((s, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={s.color}
                    onChange={(e) => {
                      const stops = [...(gradient.stops ?? [])];
                      stops[i] = { ...s, color: e.target.value };
                      patchGradient({ stops });
                    }}
                    className="h-8 w-9 cursor-pointer rounded border border-border bg-transparent"
                    aria-label={`Stop ${i + 1} colour`}
                  />
                  <Input
                    className="h-8"
                    type="number"
                    min={0}
                    max={100}
                    value={s.at}
                    onChange={(e) => {
                      const stops = [...(gradient.stops ?? [])];
                      stops[i] = { ...s, at: Number(e.target.value) };
                      patchGradient({ stops });
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label="Remove gradient stop"
                    disabled={(gradient.stops ?? []).length <= 2}
                    onClick={() => patchGradient({ stops: (gradient.stops ?? []).filter((_, j) => j !== i) })}
                  >
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-full text-[11px]"
                onClick={() =>
                  patchGradient({ stops: [...(gradient.stops ?? []), { color: "#ffffff", at: 50 }] })
                }
              >
                Add colour stop
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            Solid colour only. Add a gradient for a richer fallback behind the artwork.
          </p>
        )}
      </div>

      {hasImage ? (
        <div className="space-y-3 rounded-md border border-border p-2">
          <div className="flex items-start gap-2">
            <div
              className="size-12 shrink-0 rounded border border-border bg-muted bg-contain bg-center bg-no-repeat"
              style={{ backgroundImage: `url(${background.imageUrl})` }}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{background.fileName ?? "Background"}</p>
              <p className="text-[11px] text-muted-foreground">
                {background.widthPx ?? "?"}×{background.heightPx ?? "?"} px · {formatBytes(background.sizeBytes)}
              </p>
              <p className={`text-[11px] ${QUALITY_CLASS[quality.level]}`}>
                {quality.dpi ? `${quality.dpi} DPI · ` : ""}
                {quality.label}
              </p>
            </div>
          </div>
          {quality.level === "low" || quality.level === "warning" ? (
            <p className={`rounded-md bg-muted p-2 text-[11px] ${QUALITY_CLASS[quality.level]}`}>{quality.message}</p>
          ) : null}

          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Fit mode</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {BACKGROUND_FITS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  title={f.description}
                  onClick={() => onChange(applyFit(background, f.id, widthMm, heightMm))}
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
            <p className="text-[10px] text-muted-foreground">
              Fit = contain (whole artwork visible) · Fill = cover (edge to edge, may crop).
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-1 h-8 w-full text-[11px]"
              disabled={!canAutoRotate}
              onClick={autoRotate}
            >
              <RotateCw className="size-3.5" /> Auto-rotate to {orientation}
            </Button>
            {!canAutoRotate ? (
              <p className="text-[10px] text-muted-foreground">
                Artwork orientation already matches the {orientation} card.
              </p>
            ) : null}
          </div>

          <div className="space-y-1">
            <Label className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <AlignHorizontalJustifyCenter className="size-3.5" /> Align to card
            </Label>
            <div className="grid grid-cols-3 gap-1">
              {ALIGNMENTS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  title={a.label}
                  aria-label={`Align background ${a.label.toLowerCase()}`}
                  disabled={background.locked !== false}
                  onClick={() => align(a.h, a.v)}
                  className="rounded-md border border-border py-1.5 text-[10px] text-muted-foreground transition-colors hover:border-primary hover:text-foreground disabled:opacity-40"
                >
                  {a.short}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">
              Unlock the background to nudge or align it against the {widthMm}×{heightMm} mm card.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {(["x", "y", "w", "h"] as const).map((k) => (
              <div key={k} className="space-y-1">
                <Label className="text-[11px] uppercase text-muted-foreground">{k} (mm)</Label>
                <Input
                  className="h-8"
                  type="number"
                  step="0.5"
                  disabled={background.locked !== false}
                  value={background[k] ?? Math.round(box[k] * 100) / 100}
                  onChange={(e) => onChange({ [k]: Number(e.target.value) } as Partial<CardBackground>)}
                />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Scale %</Label>
              <Input
                className="h-8"
                type="number"
                step="5"
                min={10}
                disabled={background.locked !== false}
                value={scalePct}
                onChange={(e) => setScale(Number(e.target.value) || 100)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Rotation °</Label>
              <Input
                className="h-8"
                type="number"
                step="1"
                disabled={background.locked !== false}
                value={background.rotation ?? 0}
                onChange={(e) => onChange({ rotation: Number(e.target.value) })}
              />
            </div>
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
            <Button variant="ghost" size="icon" aria-label="Remove background" onClick={() => setConfirmRemove(true)}>
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Hiding only affects the editor — generated cards always include the artwork.
          </p>
        </div>
      ) : (
        <p className="rounded-md bg-muted p-2 text-[11px] text-muted-foreground">
          <ImageIcon className="mr-1 inline size-3" />
          No background uploaded. Upload an existing card design to use it as the locked base layer, then place
          dynamic fields on top.
        </p>
      )}

      <BackgroundPickerDialog
        open={library}
        onOpenChange={setLibrary}
        onPick={useFromLibrary}
        onUpload={() => {
          setLibrary(false);
          fileRef.current?.click();
        }}
        orientation={orientation}
        widthMm={widthMm}
        heightMm={heightMm}
      />

      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove background?</AlertDialogTitle>
            <AlertDialogDescription>
              The artwork stays in your background library. This card side will fall back to its background colour.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pending?.replacing ? "Replace background" : "Background import"}</DialogTitle>
            <DialogDescription>
              {pending?.replacing
                ? "The existing background will be replaced. Dynamic elements stay untouched."
                : `Choose how the artwork sits on the ${widthMm} × ${heightMm} mm canvas.`}
            </DialogDescription>
          </DialogHeader>
          {pending ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-md border border-border p-2">
                <img src={pending.url} alt="" className="size-16 rounded border border-border object-contain" />
                <div className="min-w-0 text-xs">
                  <p className="truncate font-medium">{pending.file.name}</p>
                  <p className="text-muted-foreground">
                    {pending.width}×{pending.height} px · {formatBytes(pending.file.size)}
                  </p>
                  <p className="text-muted-foreground">
                    Target: {widthMm} × {heightMm} mm · {orientation}
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
              {pending?.replacing ? "Replace" : "Apply background"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
