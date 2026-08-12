import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Type,
  Image as ImageIcon,
  QrCode,
  Barcode,
  Square,
  Circle,
  Minus,
  User,
  Trash2,
  Save,
  ArrowLeft,
  Eye,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DesignCanvas } from "@/components/designer/DesignCanvas";
import { Inspector } from "@/components/designer/Inspector";
import { getTemplate, saveTemplateDesign } from "@/services/db";
import { uploadAndSign } from "@/services/storage";
import {
  createElement,
  emptyDesign,
  type CardDesign,
  type CardElement,
  type ElementType,
} from "@/lib/card/types";
import { Rulers } from "@/components/designer/Rulers";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  formatDims,
  normalizeOrientation,
  orientationLabel,
  resolveDims,
  supportsOrientation,
  transformDesign,
  validateDesign,
  TRANSFORM_MODES,
  type Orientation,
  type TransformMode,
} from "@/lib/card/orientation";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/designer/$templateId")({
  head: () => ({
    meta: [
      { title: "Template designer — ID Card Studio" },
      {
        name: "description",
        content: "Drag-and-drop ID card designer with millimetre precision, dynamic fields, QR codes and barcodes.",
      },
      { property: "og:title", content: "Template designer — ID Card Studio" },
      { property: "og:description", content: "Design ID card fronts and backs with true physical dimensions." },
    ],
  }),
  component: Designer,
});

const SAMPLE = {
  full_name: "Amelia Hartono",
  identification_number: "3273010101900001",
  nik: "3273010101900001",
  birth_place: "Bandung",
  birth_date: "1990-01-01",
  gender: "Female",
  address: "12 Cendana Street, Jakarta",
  phone: "+62 812 3456 7890",
  email: "amelia@example.com",
  organization: "Your Organisation",
  department: "Engineering",
  position: "Senior Engineer",
  membership_number: "MB-0421",
  card_number: "ORG-2026-0001",
  issue_date: new Date().toISOString(),
  expiry_date: new Date(Date.now() + 31536000000).toISOString(),
  status: "active",
  qr_token: "preview",
};

const TOOLS: { type: ElementType; label: string; icon: typeof Type }[] = [
  { type: "text", label: "Text", icon: Type },
  { type: "photo", label: "Photo", icon: User },
  { type: "image", label: "Image", icon: ImageIcon },
  { type: "logo", label: "Logo", icon: ImageIcon },
  { type: "qr", label: "QR", icon: QrCode },
  { type: "barcode", label: "Barcode", icon: Barcode },
  { type: "rect", label: "Rect", icon: Square },
  { type: "circle", label: "Circle", icon: Circle },
  { type: "line", label: "Line", icon: Minus },
];

function Designer() {
  const { templateId } = Route.useParams();
  const { data: template, isLoading } = useQuery({
    queryKey: ["template", templateId],
    queryFn: () => getTemplate(templateId),
  });

  const [side, setSide] = useState<"front" | "back">("front");
  const [front, setFront] = useState<CardDesign>(emptyDesign());
  const [back, setBack] = useState<CardDesign>(emptyDesign());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(4);
  const [showGrid, setShowGrid] = useState(true);
  const [showSafe, setShowSafe] = useState(true);
  const [showBleed, setShowBleed] = useState(false);
  const [showRulers, setShowRulers] = useState(true);
  const [bleed, setBleed] = useState(3);
  const [safeMargin, setSafeMargin] = useState(3);
  const [gridSize, setGridSize] = useState(1);
  const [snap, setSnap] = useState(0.5);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [pendingOrientation, setPendingOrientation] = useState<Orientation | null>(null);
  const [transformMode, setTransformMode] = useState<TransformMode>("relayout");

  useEffect(() => {
    if (!template) return;
    setFront((template.front_design as unknown as CardDesign) ?? emptyDesign());
    setBack((template.back_design as unknown as CardDesign) ?? emptyDesign());
    setOrientation(normalizeOrientation(template.orientation));
  }, [template]);

  const size = template?.card_sizes;
  const dims = resolveDims(size, orientation);
  const design = side === "front" ? front : back;
  const setDesign = side === "front" ? setFront : setBack;
  const selected = useMemo(
    () => (design.elements ?? []).find((e) => e.id === selectedId) ?? null,
    [design, selectedId],
  );
  const issues = useMemo(() => validateDesign(design, dims, safeMargin), [design, dims, safeMargin]);

  const applyOrientation = (next: Orientation, mode: TransformMode) => {
    const from = resolveDims(size, orientation);
    const to = resolveDims(size, next);
    setFront((d) => transformDesign(d, from, to, mode, "front"));
    setBack((d) => transformDesign(d, from, to, mode, "back"));
    setOrientation(next);
    setSelectedId(null);
    setPendingOrientation(null);
    toast.success(`Canvas is now ${orientationLabel(next).toLowerCase()} · ${formatDims(to)}`);
  };


  const patchElement = (id: string, patch: Partial<CardElement>) =>
    setDesign((d) => ({
      ...d,
      elements: (d.elements ?? []).map((e) => (e.id === id ? ({ ...e, ...patch } as CardElement) : e)),
    }));

  const addElement = (type: ElementType) => {
    const el = createElement(type, { z: (design.elements?.length ?? 0) + 1 });
    setDesign((d) => ({ ...d, elements: [...(d.elements ?? []), el] }));
    setSelectedId(el.id);
  };

  const removeElement = (id: string) => {
    setDesign((d) => ({ ...d, elements: (d.elements ?? []).filter((e) => e.id !== id) }));
    setSelectedId(null);
  };

  const patchBackground = (patch: Partial<CardBackground>) =>
    setDesign((d) => ({ ...d, background: { ...emptyBackground(), ...d.background, ...patch } }));


  const uploadElementImage = async (file: File) => {
    if (!selected) return;
    try {
      const url = await uploadAndSign("template-assets", file);
      patchElement(selected.id, { src: url } as Partial<CardElement>);
      toast.success("Image uploaded");
    } catch {
      toast.error("Upload failed");
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const v = await saveTemplateDesign(templateId, front, back, {
        orientation,
        width_mm: dims.widthMm,
        height_mm: dims.heightMm,
      });
      toast.success(`Saved as version ${v}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || !template || !size) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading template…
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <Link to="/templates">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div>
            <p className="text-sm font-semibold leading-tight">{template.name}</p>
            <p className="text-xs text-muted-foreground">
              {size.name} · {formatDims(dims)} · {orientationLabel(orientation)}
            </p>
          </div>
          <Badge variant="outline">v{template.version}</Badge>
          <Tabs
            value={orientation}
            onValueChange={(v) => {
              const next = normalizeOrientation(v);
              if (next === orientation) return;
              if (!supportsOrientation(size, next)) {
                toast.error("This card size doesn't allow that orientation.");
                return;
              }
              setPendingOrientation(next);
            }}
          >
            <TabsList>
              <TabsTrigger value="portrait">Portrait</TabsTrigger>
              <TabsTrigger value="landscape">Landscape</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <Dialog open={!!pendingOrientation} onOpenChange={(o) => !o && setPendingOrientation(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Switch to {pendingOrientation ? orientationLabel(pendingOrientation).toLowerCase() : ""} (
                {pendingOrientation ? formatDims(resolveDims(size, pendingOrientation)) : ""})
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-1.5">
              {TRANSFORM_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setTransformMode(m.id)}
                  className={`w-full rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                    transformMode === m.id ? "border-primary bg-accent" : "border-border hover:border-primary"
                  }`}
                >
                  <span className="block font-semibold">{m.label}</span>
                  <span className="text-muted-foreground">{m.description}</span>
                </button>
              ))}
            </div>
            <DialogFooter>
              <Button
                onClick={() => pendingOrientation && applyOrientation(pendingOrientation, transformMode)}
              >
                Apply
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={side} onValueChange={(v) => { setSide(v as "front" | "back"); setSelectedId(null); }}>
            <TabsList>
              <TabsTrigger value="front">Front</TabsTrigger>
              <TabsTrigger value="back">Back</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="ghost" size="icon" onClick={() => setZoom((z) => Math.max(1.5, z - 0.5))}>
            <ZoomOut className="size-4" />
          </Button>
          <span className="w-10 text-center text-xs text-muted-foreground">{Math.round(zoom * 25)}%</span>
          <Button variant="ghost" size="icon" onClick={() => setZoom((z) => Math.min(10, z + 0.5))}>
            <ZoomIn className="size-4" />
          </Button>
          <Button variant={preview ? "default" : "secondary"} size="sm" onClick={() => setPreview(!preview)}>
            <Eye className="size-4" /> Preview
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            <Save className="size-4" /> {saving ? "Saving…" : "Save version"}
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-card md:flex">
          <ScrollArea className="flex-1">
            <div className="p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Add element</p>
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {TOOLS.map((t) => (
                  <button
                    key={t.type + t.label}
                    onClick={() => addElement(t.type)}
                    className="flex flex-col items-center gap-1 rounded-md border border-border bg-background px-1 py-2 text-[10px] text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                  >
                    <t.icon className="size-4" />
                    {t.label}
                  </button>
                ))}
              </div>

              <p className="mt-5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {side} background layer
              </p>
              <div className="mt-2">
                <BackgroundPanel
                  background={design.background}
                  onChange={patchBackground}
                  widthMm={dims.widthMm}
                  heightMm={dims.heightMm}
                  side={side}
                  templateId={templateId}
                  orientation={orientation}
                  cardSizeId={size.id}
                />
              </div>


              <p className="mt-5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Guides</p>
              <div className="mt-2 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Rulers (mm)</Label>
                  <Switch checked={showRulers} onCheckedChange={setShowRulers} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Grid</Label>
                  <Switch checked={showGrid} onCheckedChange={setShowGrid} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Grid size</Label>
                  <Select
                    value={String(gridSize)}
                    onValueChange={(v) => {
                      setGridSize(Number(v));
                      setSnap(Number(v));
                    }}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 mm</SelectItem>
                      <SelectItem value="5">5 mm</SelectItem>
                      <SelectItem value="10">10 mm</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Safe area</Label>
                  <Switch checked={showSafe} onCheckedChange={setShowSafe} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Safe margin (mm)</Label>
                  <Input
                    className="h-8"
                    type="number"
                    step="0.5"
                    value={safeMargin}
                    onChange={(e) => setSafeMargin(Number(e.target.value))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Bleed</Label>
                  <Switch checked={showBleed} onCheckedChange={setShowBleed} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Bleed (mm)</Label>
                  <Input
                    className="h-8"
                    type="number"
                    step="0.5"
                    value={bleed}
                    onChange={(e) => setBleed(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Snap (mm)</Label>
                  <Input
                    className="h-8"
                    type="number"
                    step="0.25"
                    value={snap}
                    onChange={(e) => setSnap(Number(e.target.value))}
                  />
                </div>
              </div>
            </div>
          </ScrollArea>
        </aside>

        <main className="canvas-surface flex min-w-0 flex-1 items-center justify-center overflow-auto p-8">
          {preview ? (
            <div style={{ boxShadow: "var(--shadow-card)" }}>
              <DesignCanvas
                design={design}
                widthMm={dims.widthMm}
                heightMm={dims.heightMm}
                orientation={orientation}
                scale={zoom}
                data={SAMPLE}
                selectedId={null}
                onSelect={() => {}}
                onChange={() => {}}
                showGrid={false}
                showSafe={false}
                snap={0}
              />
            </div>
          ) : (
            <Rulers widthMm={dims.widthMm} heightMm={dims.heightMm} scale={zoom} show={showRulers}>
              <DesignCanvas
                design={design}
                widthMm={dims.widthMm}
                heightMm={dims.heightMm}
                orientation={orientation}
                scale={zoom}
                data={SAMPLE}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onChange={patchElement}
                showGrid={showGrid}
                gridSize={gridSize}
                showSafe={showSafe}
                safeMargin={safeMargin}
                showBleed={showBleed}
                bleed={bleed}
                snap={snap}
              />
            </Rulers>
          )}
        </main>

        <aside className="hidden w-72 shrink-0 flex-col border-l border-border bg-card lg:flex">
          <ScrollArea className="flex-1">
            <div className="p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Layers</p>
              <div className="mt-2 space-y-1">
                {[...(design.elements ?? [])]
                  .sort((a, b) => b.z - a.z)
                  .map((el) => (
                    <button
                      key={el.id}
                      onClick={() => setSelectedId(el.id)}
                      className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs ${
                        selectedId === el.id ? "bg-accent text-accent-foreground" : "hover:bg-muted"
                      }`}
                    >
                      <span className="truncate">
                        {el.name ?? el.type}
                        <span className="ml-1 text-muted-foreground">({el.type})</span>
                      </span>
                    </button>
                  ))}
                {(design.elements ?? []).length === 0 ? (
                  <p className="py-4 text-center text-xs text-muted-foreground">Nothing on this side yet.</p>
                ) : null}
              </div>

              {selected ? (
                <div className="mt-5">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {selected.type} properties
                    </p>
                    <Button variant="ghost" size="icon" onClick={() => removeElement(selected.id)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="mt-2">
                    <Inspector
                      el={selected}
                      onChange={(patch) => patchElement(selected.id, patch)}
                      onUploadImage={uploadElementImage}
                    />
                  </div>
                </div>
              ) : (
                <p className="mt-6 rounded-md bg-muted p-3 text-xs text-muted-foreground">
                  Select an element on the canvas to edit it. Use <code>{"{{full_name}}"}</code>-style tokens in text
                  to pull in person data automatically.
                </p>
              )}
            </div>
          </ScrollArea>
        </aside>
      </div>
    </div>
  );
}
