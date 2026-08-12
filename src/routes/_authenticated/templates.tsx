import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Copy, Trash2, PenTool, RectangleHorizontal, RectangleVertical } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { getProfile, listCardSizes, listTemplates } from "@/services/db";
import { CardRenderer } from "@/components/card/CardRenderer";
import { emptyDesign, type CardDesign } from "@/lib/card/types";
import { starterBackDesign, starterDesign } from "@/lib/card/starter";
import {
  formatDims,
  normalizeOrientation,
  orientationLabel,
  resolveDims,
  supportsOrientation,
  transformDesign,
  TRANSFORM_MODES,
  type Orientation,
  type TransformMode,
} from "@/lib/card/orientation";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/templates")({
  head: () => ({
    meta: [
      { title: "Templates — ID Card Studio" },
      {
        name: "description",
        content:
          "Create portrait and landscape ID card templates with dynamic data fields, versioning and front/back designs.",
      },
      { property: "og:title", content: "Templates — ID Card Studio" },
      { property: "og:description", content: "Portrait and landscape card templates from one design engine." },
    ],
  }),
  component: Templates,
});

const SAMPLE = {
  full_name: "Amelia Hartono",
  position: "Senior Engineer",
  card_number: "ORG-2026-0001",
  organization: "Your Organisation",
  expiry_date: new Date(Date.now() + 31536000000).toISOString(),
  qr_token: "preview",
};

type DesignType = "front" | "back" | "both";

function OrientationToggle({
  value,
  onChange,
  disabled,
}: {
  value: Orientation;
  onChange: (o: Orientation) => void;
  disabled?: (o: Orientation) => boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {(["portrait", "landscape"] as Orientation[]).map((o) => (
        <button
          key={o}
          type="button"
          disabled={disabled?.(o)}
          onClick={() => onChange(o)}
          className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors disabled:opacity-40 ${
            value === o
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background text-muted-foreground hover:border-primary"
          }`}
        >
          {o === "portrait" ? <RectangleVertical className="size-4" /> : <RectangleHorizontal className="size-4" />}
          {o}
        </button>
      ))}
    </div>
  );
}

function Templates() {
  const qc = useQueryClient();
  const { data: templates } = useQuery({ queryKey: ["templates"], queryFn: listTemplates });
  const { data: sizes } = useQuery({ queryKey: ["card-sizes"], queryFn: listCardSizes });

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [sizeId, setSizeId] = useState<string>("");
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [designType, setDesignType] = useState<DesignType>("both");

  const [dupId, setDupId] = useState<string | null>(null);
  const [dupOrientation, setDupOrientation] = useState<Orientation>("portrait");
  const [dupMode, setDupMode] = useState<TransformMode>("relayout");

  const selectedSize = useMemo(() => (sizes ?? []).find((s) => s.id === sizeId), [sizes, sizeId]);
  const dims = selectedSize ? resolveDims(selectedSize, orientation) : null;
  const dupTemplate = useMemo(() => (templates ?? []).find((t) => t.id === dupId), [templates, dupId]);

  const create = useMutation({
    mutationFn: async () => {
      const profile = await getProfile();
      const size = (sizes ?? []).find((s) => s.id === sizeId);
      if (!profile?.organization_id || !size) throw new Error("Choose a card size");
      if (!supportsOrientation(size, orientation)) throw new Error("This size does not allow that orientation");
      const d = resolveDims(size, orientation);
      const { data, error } = await supabase
        .from("card_templates")
        .insert({
          organization_id: profile.organization_id,
          name,
          card_size_id: size.id,
          orientation,
          width_mm: d.widthMm,
          height_mm: d.heightMm,
          front_design:
            designType === "back" ? (emptyDesign() as never) : (starterDesign(d.widthMm, d.heightMm) as never),
          back_design:
            designType === "front"
              ? (emptyDesign() as never)
              : (starterBackDesign(d.widthMm, d.heightMm) as never),
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => {
      toast.success("Template created");
      setOpen(false);
      setName("");
      qc.invalidateQueries({ queryKey: ["templates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const duplicate = useMutation({
    mutationFn: async () => {
      const src = dupTemplate;
      if (!src) throw new Error("Template not found");
      const size = src.card_sizes;
      const from = resolveDims(size, normalizeOrientation(src.orientation));
      const to = resolveDims(size, dupOrientation);
      const front = transformDesign(
        (src.front_design as unknown as CardDesign) ?? emptyDesign(),
        from,
        to,
        dupMode,
        "front",
      );
      const back = transformDesign(
        (src.back_design as unknown as CardDesign) ?? emptyDesign(),
        from,
        to,
        dupMode,
        "back",
      );
      const { error } = await supabase.from("card_templates").insert({
        organization_id: src.organization_id,
        name: `${src.name} — ${orientationLabel(dupOrientation)}`,
        card_size_id: src.card_size_id,
        orientation: dupOrientation,
        width_mm: to.widthMm,
        height_mm: to.heightMm,
        front_design: front as never,
        back_design: back as never,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Template duplicated");
      setDupId(null);
      qc.invalidateQueries({ queryKey: ["templates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("card_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Template deleted");
      qc.invalidateQueries({ queryKey: ["templates"] });
    },
    onError: () => toast.error("Cards were issued from this template, so it can't be deleted."),
  });

  return (
    <AppShell
      title="Templates"
      description="Portrait and landscape card designs with dynamic fields. Each save creates a new version."
      actions={
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="size-4" /> New template
        </Button>
      }
    >
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Template information</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="tname">Template name</Label>
              <Input id="tname" value={name} onChange={(e) => setName(e.target.value)} placeholder="Staff card 2026" />
            </div>
            <div className="space-y-1.5">
              <Label>Card size</Label>
              <Select value={sizeId} onValueChange={setSizeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a size" />
                </SelectTrigger>
                <SelectContent>
                  {(sizes ?? []).map((s) => {
                    const p = resolveDims(s, "portrait");
                    return (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} — {formatDims(p)} portrait
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Orientation</Label>
              <OrientationToggle
                value={orientation}
                onChange={setOrientation}
                disabled={(o) => !!selectedSize && !supportsOrientation(selectedSize, o)}
              />
              {dims ? (
                <p className="text-xs text-muted-foreground">
                  Canvas: {formatDims(dims)} ({orientationLabel(orientation).toLowerCase()})
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label>Design type</Label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: "front", label: "Front" },
                    { id: "back", label: "Back" },
                    { id: "both", label: "Front + back" },
                  ] as { id: DesignType; label: string }[]
                ).map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDesignType(d.id)}
                    className={`rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                      designType === d.id
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-muted-foreground hover:border-primary"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => create.mutate()} disabled={!name || !sizeId || create.isPending}>
              Create & design
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!dupId} onOpenChange={(o) => !o && setDupId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicate {dupTemplate?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Target orientation</Label>
              <OrientationToggle
                value={dupOrientation}
                onChange={setDupOrientation}
                disabled={(o) => !!dupTemplate?.card_sizes && !supportsOrientation(dupTemplate.card_sizes, o)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Transformation</Label>
              <div className="space-y-1.5">
                {TRANSFORM_MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setDupMode(m.id)}
                    className={`w-full rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                      dupMode === m.id ? "border-primary bg-accent" : "border-border hover:border-primary"
                    }`}
                  >
                    <span className="block font-semibold">{m.label}</span>
                    <span className="text-muted-foreground">{m.description}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => duplicate.mutate()} disabled={duplicate.isPending}>
              Duplicate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {(templates ?? []).map((t) => {
          const o = normalizeOrientation(t.orientation);
          const d = resolveDims(t.card_sizes, o);
          const scale = Math.min(3.2, 300 / d.widthMm);
          return (
            <div key={t.id} className="panel overflow-hidden">
              <div className="canvas-surface flex justify-center p-4">
                <div style={{ boxShadow: "var(--shadow-card)" }}>
                  <CardRenderer
                    design={(t.front_design as unknown as CardDesign) ?? emptyDesign()}
                    widthMm={d.widthMm}
                    heightMm={d.heightMm}
                    orientation={o}
                    scale={scale}
                    data={SAMPLE}
                  />
                </div>
              </div>
              <div className="flex items-start justify-between gap-2 border-t border-border p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{t.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.card_sizes ? `${t.card_sizes.name} · ${formatDims(d)}` : "No size"}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge className="uppercase" variant={o === "landscape" ? "default" : "secondary"}>
                    {o}
                  </Badge>
                  <Badge variant="outline">v{t.version}</Badge>
                </div>
              </div>
              <div className="flex gap-1 border-t border-border p-2">
                <Link to="/designer/$templateId" params={{ templateId: t.id }} className="flex-1">
                  <Button size="sm" className="w-full">
                    <PenTool className="size-4" /> Design
                  </Button>
                </Link>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setDupId(t.id);
                    setDupOrientation(o === "portrait" ? "landscape" : "portrait");
                    setDupMode("relayout");
                  }}
                >
                  <Copy className="size-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove.mutate(t.id)}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </div>
          );
        })}
        {(templates ?? []).length === 0 ? (
          <div className="panel col-span-full p-10 text-center">
            <p className="text-sm font-medium">No templates yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create a template, pick portrait or landscape, and start designing.
            </p>
            <Button className="mt-4" onClick={() => setOpen(true)}>
              <Plus className="size-4" /> New template
            </Button>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
