import { supabase } from "@/integrations/supabase/client";

const cache = new Map<string, string>();

/** Stored value is "<bucket>/<path>". Returns a temporary signed URL. */
export async function signedUrl(stored?: string | null): Promise<string | null> {
  if (!stored) return null;
  if (stored.startsWith("http") || stored.startsWith("data:")) return stored;
  const hit = cache.get(stored);
  if (hit) return hit;
  const [bucket, ...rest] = stored.split("/");
  if (!bucket || rest.length === 0) return null;
  const { data } = await supabase.storage.from(bucket).createSignedUrl(rest.join("/"), 60 * 60);
  if (!data?.signedUrl) return null;
  cache.set(stored, data.signedUrl);
  return data.signedUrl;
}

export async function uploadFile(bucket: string, file: File | Blob, ext: string): Promise<string> {
  const name = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(name, file, { upsert: false });
  if (error) throw error;
  return `${bucket}/${name}`;
}

/** Upload and return a long-lived signed URL that can be embedded in designs. */
export async function uploadAndSign(bucket: string, file: File): Promise<string> {
  return (await uploadAsset(bucket, file)).url;
}

/** Upload and return both the storage reference and a long-lived signed URL. */
export async function uploadAsset(
  bucket: string,
  file: File,
): Promise<{ storagePath: string; url: string }> {
  const ext = (file.name.split(".").pop() ?? "png").toLowerCase();
  const stored = await uploadFile(bucket, file, ext);
  const [b, ...rest] = stored.split("/");
  const { data, error } = await supabase.storage
    .from(b!)
    .createSignedUrl(rest.join("/"), 60 * 60 * 24 * 365);
  if (error || !data?.signedUrl) throw error ?? new Error("Could not sign uploaded file");
  return { storagePath: stored, url: data.signedUrl };
}

/** Refresh a signed URL for a stored asset (signed links eventually expire). */
export async function resignAsset(stored: string, seconds = 60 * 60 * 24 * 365): Promise<string | null> {
  const [bucket, ...rest] = stored.split("/");
  if (!bucket || rest.length === 0) return null;
  const { data } = await supabase.storage.from(bucket).createSignedUrl(rest.join("/"), seconds);
  return data?.signedUrl ?? null;
}

