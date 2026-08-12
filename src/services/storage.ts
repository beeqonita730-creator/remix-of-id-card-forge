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
