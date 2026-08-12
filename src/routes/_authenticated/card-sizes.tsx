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
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { listCardSizes, getProfile } from "@/services/db";
import { fromMm } from "@/lib/card/units";
import type { CardSize } from "@/lib/card/types";
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

const EMPTY = {
  name: "",
  code: "",
  width_mm: "85.6",
  height_mm: "54",
  description: "",
};

function CardSizes() {
  const qc = useQueryClient();
  const { data: sizes } = useQuery({ queryKey: ["card-sizes"], queryFn: listCardSizes });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const create = useMutation({
    mutationFn: async () => {
      const profile = await getProfile();
      if (!profile) throw new Error("No profile found");
      const w = Number(form.width_mm);
      const h = Number(form.height_mm);
      const { error } = await supabase.from("card_sizes").insert({
        organization_id: profile.organization_id,
        name: form.name,
        code: form.code.toUpperCase().replace(/\s+/g, "-"),
        width_mm: w,
        height_mm: h,
        orientation: w >= h ? "landscape" : "portrait",
        description: form.description || null,
        category: "custom",
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
    onError: () => toast.error("This size is used by a template or card and cannot be deleted."),
  });

  const duplicate = (s: CardSize) => {
    setForm({
      name: `${s.name} copy`,
      code: `${s.code}-COPY`,
      width_mm: String(s.width_mm),
      height_mm: String(s.height_mm),
      description: s.description ?? "",
    });
    setOpen(true);
  };

  return (
    <AppShell
      title="Card sizes"
      description="Physical dimensions in millimetres. These drive the designer canvas and every print output."
      actions={
        <Button size="sm" onClick={() => { setForm(EMPTY); setOpen(true); }}>
          <Plus className="size-4" /> New size
        </Button>
      }
    >
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New card size</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="code">Code</Label>
              <Input id="code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="width_mm">Width (mm)</Label>
              <Input
                id="width_mm"
                type="number"
                step="0.1"
                value={form.width_mm}
                onChange={(e) => setForm({ ...form, width_mm: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="height_mm">Height (mm)</Label>
              <Input
                id="height_mm"
                type="number"
                step="0.1"
                value={form.height_mm}
                onChange={(e) => setForm({ ...form, height_mm: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => create.mutate()} disabled={!form.name || !form.code || create.isPending}>
              Add size
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="panel overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Millimetres</TableHead>
              <TableHead>Inches</TableHead>
              <TableHead>Orientation</TableHead>
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
                  {s.description ? (
                    <p className="text-xs font-normal text-muted-foreground">{s.description}</p>
                  ) : null}
                </TableCell>
                <TableCell className="text-muted-foreground">{s.code}</TableCell>
                <TableCell>
                  {s.width_mm} × {s.height_mm} mm
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {fromMm(s.width_mm, "inch").toFixed(2)} × {fromMm(s.height_mm, "inch").toFixed(2)} in
                </TableCell>
                <TableCell className="capitalize text-muted-foreground">{s.orientation}</TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <Button variant="ghost" size="icon" onClick={() => duplicate(s)}>
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
