import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Upload, Trash2, Copy, Loader2 } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BackgroundMeta,
  BackgroundSearch,
  BackgroundThumb,
  useBackgroundAssets,
  type BackgroundAssetRow,
} from "@/components/designer/BackgroundLibrary";
import {
  createTemplateAsset,
  deleteTemplateAsset,
  duplicateBackgroundAsset,
} from "@/services/db";
import { uploadAsset, signedUrl } from "@/services/storage";
import {
  ACCEPTED_BACKGROUND_TYPES,
  MAX_BACKGROUND_BYTES,
  backgroundQuality,
  readImageMeta,
} from "@/lib/card/background";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/backgrounds")({
  head: () => ({
    meta: [
      { title: "Background library — ID Card Studio" },
      {
        name: "description",
        content:
          "Upload, browse and manage base-layer background artwork used by your ID card templates.",
      },
      { property: "og:title", content: "Background library — ID Card Studio" },
      {
        property: "og:description",
        content: "Upload and reuse print-ready background artwork across your ID card templates.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BackgroundsPage,
});

type Orientation = "portrait" | "landscape";

function BackgroundsPage() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<"all" | Orientation>("all");
  const [selected, setSelected] = useState<BackgroundAssetRow | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data, isLoading } = useBackgroundAssets({
    search: search || null,
    orientation: scope === "all" ? null : scope,
  });
  const assets = data ?? [];

  const refresh = () => qc.invalidateQueries({ queryKey: ["background-assets"] });

  const open = async (asset: BackgroundAssetRow) => {
    setSelected(asset);
    setPreviewUrl(null);
    setPreviewUrl(await signedUrl(asset.storage_path));
  };

  const upload = async (file: File) => {
    if (file.size > MAX_BACKGROUND_BYTES) {
      toast.error(`File is larger than ${Math.round(MAX_BACKGROUND_BYTES / (1024 * 1024))} MB`);
      return;
    }
    setUploading(true);
    try {
      const meta = await readImageMeta(file);
      const { storagePath } = await uploadAsset("template-assets", file);
      await createTemplateAsset({
        template_id: null,
        side: "FRONT",
        asset_type: "BACKGROUND",
        name: file.name,
        storage_path: storagePath,
        file_name: file.name,
        mime_type: file.type,
        width_px: meta.width || null,
        height_px: meta.height || null,
        size_bytes: file.size,
        orientation: meta.width >= meta.height ? "landscape" : "portrait",
      });
      await refresh();
      toast.success("Background added to the library");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const dup = useMutation({
    mutationFn: (id: string) => duplicateBackgroundAsset(id),
    onSuccess: async () => {
      await refresh();
      toast.success("Background duplicated");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not duplicate"),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteTemplateAsset(id),
    onSuccess: async () => {
      setSelected(null);
      await refresh();
      toast.success("Background removed from the library");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not delete"),
  });

  const quality = selected
    ? backgroundQuality(selected.width_px, selected.height_px, 85.6, 54)
    : null;

  return (
    <AppShell
      title="Background library"
      description="Base-layer artwork available to every template in this workspace."
      actions={
        <Button size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {uploading ? "Uploading…" : "Upload background"}
        </Button>
      }
    >
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED_BACKGROUND_TYPES}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-56 flex-1">
          <BackgroundSearch value={search} onChange={setSearch} />
        </div>
        <Tabs value={scope} onValueChange={(v) => setScope(v as "all" | Orientation)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="landscape">Landscape</TabsTrigger>
            <TabsTrigger value="portrait">Portrait</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {assets.map((a) => (
          <div key={a.id} className="rounded-lg border border-border bg-card p-3">
            <button
              type="button"
              onClick={() => open(a)}
              className="w-full space-y-2 text-left"
              aria-label={`Open ${a.file_name ?? "background"}`}
            >
              <BackgroundThumb asset={a} />
              <BackgroundMeta asset={a} />
            </button>
            <div className="mt-2 flex justify-end gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Duplicate background"
                disabled={dup.isPending}
                onClick={() => dup.mutate(a.id)}
              >
                <Copy className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Delete background"
                disabled={del.isPending}
                onClick={() => del.mutate(a.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {isLoading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading backgrounds…</p>
      ) : null}
      {!isLoading && assets.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-14 text-center">
          <p className="text-sm font-medium">No background artwork yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Upload PNG, JPG, WEBP or SVG artwork to reuse it across templates.
          </p>
          <Button className="mt-4" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="size-4" /> Upload background
          </Button>
        </div>
      ) : null}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selected?.name ?? selected?.file_name ?? "Background"}</DialogTitle>
            <DialogDescription>
              {quality?.dpi ? `${quality.dpi} DPI at CR80 · ${quality.label}` : "Artwork details"}
            </DialogDescription>
          </DialogHeader>
          <div className="flex max-h-[55vh] items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt={selected?.file_name ?? "Background artwork"}
                className="max-h-[55vh] w-full object-contain"
              />
            ) : (
              <div className="py-16 text-xs text-muted-foreground">Loading preview…</div>
            )}
          </div>
          {selected ? <BackgroundMeta asset={selected} /> : null}
          <DialogFooter>
            <Button
              variant="secondary"
              disabled={!selected || dup.isPending}
              onClick={() => selected && dup.mutate(selected.id)}
            >
              <Copy className="size-4" /> Duplicate
            </Button>
            <Button
              variant="destructive"
              disabled={!selected || del.isPending}
              onClick={() => selected && del.mutate(selected.id)}
            >
              <Trash2 className="size-4" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}