import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2, Copy } from "lucide-react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { listCardSizes, getProfile } from "@/services/db";
import { mmToIn } from "@/lib/card/units";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/card-sizes")({
  head: () => ({
    meta: [
      { title: "Card sizes — ID Card Studio" },
      {
        name: "description",
        content: "Manage physical ID card sizes in millimetres: CR80, B1, B2, Jumbo, ID-2 and custom formats.",
      },
      { property: "og:title", content: "Card sizes — ID Card Studio" },
      { property: "og:description", content: "Manage physical ID card sizes used across templates and printing." },
    ],
  }),
  component: CardSizes,
});

const EMPTY = { name: "", code: "", width_mm: 85.6, height_mm: 54, corner_radius_mm: 3.18, bleed_mm: 2 };

function CardSizes() {
  const qc = useQueryClient();
  const { data: sizes } = useQuery({ queryKey: ["card-sizes"], queryFn: listCardSizes });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const create = useMutation({
    mutationFn: async () => {
      const profile = await getProfile();
      if (!profile) throw new Error("No profile");
      const { error } = await supabase.from("card_sizes").insert({
        organization_id: profile.organization_id,
        name: form.name,
        code: form.code.toUpperCase().replace(/\s+/g, "-"),
        width_mm: Number(form.width_mm),
        height_mm: Number(form.height_mm),
        corner_radius_mm: Number(form.corner_radius_mm),
        bleed_mm: Number(form.bleed_mm),
        is_system_default: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Card size added");
      setOpen(false);
      setForm(EMPTY);
      qc.invalidateQueries({ queryKey: ["card-sizes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("card_sizes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Card size deleted");
      qc.invalidateQueries({ queryKey: ["card-sizes"] });
    },
    onError: () => toast.error("This size is in use by a template or card."),
  });

  const field = (key: keyof typeof EMPTY, label: string, type = "number", step = "0.01") => (
    <div className="space-y-1.5">
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        type={type}
        step={type === "number" ? step : undefined}
        value={form[key] as string | number}
        onChange={(e) => setForm({ ...form, [key]: type === "number" ? e.target.value : e.target.value })}
      />
    </div>
  );

  return (
    <AppShell
      title="Card sizes"
      description="Physical dimensions in millimetres. These drive the designer canvas and every print output."
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="size-4" /> New size
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New card size</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="code">Code</Label>
                <Input id="code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
              </div>
              {field("width_mm", "Width (mm)")}
              {field("height_mm", "Height (mm)")}
              {field("corner_radius_mm", "Corner radius (mm)")}
              {field("bleed_mm", "Bleed (mm)")}
            </div>
            <DialogFooter>
              <Button onClick={() => create.mutate()} disabled={!form.name || !form.code || create.isPending}>
                Add size
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="panel overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Millimetres</TableHead>
              <TableHead>Inches</TableHead>
              <TableHead>Radius</TableHead>
              <TableHead>Bleed</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(sizes ?? []).map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">
                  {s.name}
                  {s.is_system_default ? (
                    <Badge variant="outline" className="ml-2">
                      System
                    </Badge>
                  ) : null}
                </TableCell>
                <TableCell className="text-muted-foreground">{s.code}</TableCell>
                <TableCell>
                  {s.width_mm} × {s.height_mm} mm
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {mmToIn(s.width_mm).toFixed(2)} × {mmToIn(s.height_mm).toFixed(2)} in
                </TableCell>
                <TableCell>{s.corner_radius_mm} mm</TableCell>
                <TableCell>{s.bleed_mm} mm</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setForm({
                        name: `${s.name} copy`,
                        code: `${s.code}-COPY`,
                        width_mm: s.width_mm,
                        height_mm: s.height_mm,
                        corner_radius_mm: s.corner_radius_mm,
                        bleed_mm: s.bleed_mm,
                      }) || setOpen(true)
                    }
                  >
                    <Copy className="size-4" />
                  </Button>
                  {!s.is_system_default ? (
                    <Button variant="ghost" size="icon" onClick={() => remove.mutate(s.id)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  );
}
