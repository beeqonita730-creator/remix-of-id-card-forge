import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import {
  BackgroundMeta,
  BackgroundSearch,
  BackgroundThumb,
  useBackgroundAssets,
  type BackgroundAssetRow,
} from "@/components/designer/BackgroundLibrary";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (asset: BackgroundAssetRow) => void;
  /** optional: open the file picker to upload new artwork instead */
  onUpload?: () => void;
  orientation: "portrait" | "landscape";
  widthMm: number;
  heightMm: number;
}

export function BackgroundPickerDialog({
  open,
  onOpenChange,
  onPick,
  onUpload,
  orientation,
  widthMm,
  heightMm,
}: Props) {
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<"all" | "orientation">("orientation");
  const { data, isLoading } = useBackgroundAssets({
    search: search || null,
    orientation: scope === "orientation" ? orientation : null,
  });
  const assets = data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Background library</DialogTitle>
          <DialogDescription>Reuse artwork already uploaded to this workspace.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-52 flex-1">
            <BackgroundSearch value={search} onChange={setSearch} />
          </div>
          <Tabs value={scope} onValueChange={(v) => setScope(v as "all" | "orientation")}>
            <TabsList>
              <TabsTrigger value="orientation" className="capitalize">
                {orientation}
              </TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </Tabs>
          {onUpload ? (
            <Button size="sm" onClick={onUpload}>
              <Upload className="size-4" /> Upload new
            </Button>
          ) : null}
        </div>
        <div className="grid max-h-[55vh] grid-cols-2 gap-3 overflow-auto sm:grid-cols-3">
          {assets.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => onPick(a)}
              className="space-y-2 rounded-md border border-border p-2 text-left transition-colors hover:border-primary"
            >
              <BackgroundThumb asset={a} />
              <BackgroundMeta asset={a} widthMm={widthMm} heightMm={heightMm} />
            </button>
          ))}
          {!isLoading && assets.length === 0 ? (
            <p className="col-span-full py-8 text-center text-xs text-muted-foreground">
              No backgrounds yet. Upload artwork to build your library.
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}