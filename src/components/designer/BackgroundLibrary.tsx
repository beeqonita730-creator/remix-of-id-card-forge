import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Image as ImageIcon, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { listBackgroundAssets, type BackgroundAssetFilters } from "@/services/db";
import { signedUrl } from "@/services/storage";
import { backgroundQuality, formatBytes } from "@/lib/card/background";

export interface BackgroundAssetRow {
  id: string;
  name: string | null;
  file_name: string | null;
  mime_type: string | null;
  storage_path: string;
  side: string;
  orientation: string | null;
  width_px: number | null;
  height_px: number | null;
  size_bytes: number | null;
  created_at: string;
  template_id: string | null;
  card_sizes?: { name: string } | null;
  card_templates?: { name: string } | null;
}

export function useBackgroundAssets(filters: BackgroundAssetFilters) {
  return useQuery({
    queryKey: ["background-assets", filters],
    queryFn: async () => (await listBackgroundAssets(filters)) as unknown as BackgroundAssetRow[],
  });
}

export function useSignedThumb(storagePath: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!storagePath) {
      setUrl(null);
      return;
    }
    signedUrl(storagePath).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [storagePath]);
  return url;
}

export function BackgroundThumb({
  asset,
  className,
}: {
  asset: BackgroundAssetRow;
  className?: string;
}) {
  const url = useSignedThumb(asset.storage_path);
  return (
    <div
      className={
        className ??
        "flex aspect-[1.6/1] w-full items-center justify-center overflow-hidden rounded-md border border-border bg-muted"
      }
    >
      {url ? (
        <img src={url} alt={asset.file_name ?? "Background"} loading="lazy" className="size-full object-contain" />
      ) : (
        <ImageIcon className="size-5 text-muted-foreground" />
      )}
    </div>
  );
}

export function BackgroundMeta({
  asset,
  widthMm,
  heightMm,
}: {
  asset: BackgroundAssetRow;
  widthMm?: number;
  heightMm?: number;
}) {
  const q = useMemo(
    () => backgroundQuality(asset.width_px, asset.height_px, widthMm ?? 85.6, heightMm ?? 54),
    [asset.width_px, asset.height_px, widthMm, heightMm],
  );
  return (
    <div className="min-w-0 space-y-0.5">
      <p className="truncate text-xs font-medium">{asset.name ?? asset.file_name ?? "Background"}</p>
      <p className="truncate text-[11px] text-muted-foreground">
        {asset.width_px ?? "?"}×{asset.height_px ?? "?"} px · {formatBytes(asset.size_bytes)}
        {q.dpi ? ` · ${q.dpi} DPI` : ""}
      </p>
      <div className="flex flex-wrap gap-1 pt-0.5">
        <Badge variant="outline" className="text-[10px]">
          {asset.side}
        </Badge>
        {asset.orientation ? (
          <Badge variant="outline" className="text-[10px] capitalize">
            {asset.orientation}
          </Badge>
        ) : null}
        {asset.card_sizes?.name ? (
          <Badge variant="outline" className="text-[10px]">
            {asset.card_sizes.name}
          </Badge>
        ) : null}
      </div>
    </div>
  );
}

export function BackgroundSearch({
  value,
  onChange,
  placeholder = "Search backgrounds…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input className="h-8 pl-8" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}