import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Copy, Trash2, PenTool } from "lucide-react";
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
import type { CardDesign } from "@/lib/card/types";
import { starterBackDesign, starterDesign } from "@/lib/card/starter";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/templates")({
  head: () => ({
    meta: [
      { title: "Templates — ID Card Studio" },
      {
        name: "description",
        content: "Create, import and version ID card design templates with dynamic data fields for front and back.",
      },
      { property: "og:title", content: "Templates — ID Card Studio" },
      { property: "og:description", content: "Create and version ID card design templates for front and back." },
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

function Templates() {
  const qc = useQueryClient();
  const { data: templates } = useQuery({ queryKey: ["templates"], queryFn: listTemplates });
  const { data: sizes } = useQuery({ queryKey: ["card-sizes"], queryFn: listCardSizes });

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [sizeId, setSizeId] = useState<string>("");

  const create = useMutation({
    mutationFn: async () => {
      const profile = await getProfile();
      const size = (sizes ?? []).find((s) => s.id === sizeId);
      if (!profile?.organization_id || !size) throw new Error("Choose a card size");
      const { data, error } = await supabase
        .from("card_templates")
        .insert({
          organization_id: profile.organization_id,
          name,
          card_size_id: size.id,
          orientation: size.width_mm >= size.height_mm ? "landscape" : "portrait",
          front_design: starterDesign(size.width_mm, size.height_mm) as never,
          back_design: starterBackDesign(size.width_mm, size.height_mm) as never,
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
    mutationFn: async (id: string) => {
      const src = (templates ?? []).find((t) => t.id === id);
      if (!src) return;
      const { error } = await supabase.from("card_templates").insert({
        organization_id: src.organization_id,
        name: `${src.name} copy`,
        card_size_id: src.card_size_id,
        orientation: src.orientation,
        front_design: src.front_design,
        back_design: src.back_design,
        background_url: src.background_url,
        bleed_mm: src.bleed_mm,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Template duplicated");
      qc.invalidateQueries({ queryKey: ["templates"] });
    },
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
      description="Card designs with dynamic fields. Each save creates a new version."
      actions={
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="size-4" /> New template
        </Button>
      }
    >
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New template</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
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
                  {(sizes ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} — {s.width_mm} × {s.height_mm} mm
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => create.mutate()} disabled={!name || !sizeId || create.isPending}>
              Create & design
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {(templates ?? []).map((t) => {
          const size = t.card_sizes;
          const scale = size ? Math.min(3.2, 300 / size.width_mm) : 3;
          return (
            <div key={t.id} className="panel overflow-hidden">
              <div className="canvas-surface flex justify-center p-4">
                {size ? (
                  <div style={{ boxShadow: "var(--shadow-card)" }}>
                    <CardRenderer
                      design={t.front_design as unknown as CardDesign}
                      widthMm={size.width_mm}
                      heightMm={size.height_mm}
                      scale={scale}
                      data={SAMPLE}
                    />
                  </div>
                ) : null}
              </div>
              <div className="flex items-start justify-between gap-2 border-t border-border p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{t.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {size ? `${size.name} · ${size.width_mm} × ${size.height_mm} mm` : "No size"}
                  </p>
                </div>
                <Badge variant="outline">v{t.version}</Badge>
              </div>
              <div className="flex gap-1 border-t border-border p-2">
                <Link to="/designer/$templateId" params={{ templateId: t.id }} className="flex-1">
                  <Button size="sm" className="w-full">
                    <PenTool className="size-4" /> Design
                  </Button>
                </Link>
                <Button size="sm" variant="ghost" onClick={() => duplicate.mutate(t.id)}>
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
              Create a template to start designing. You can also upload an existing card artwork as the background.
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
