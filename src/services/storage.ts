import { supabase } from "@/integrations/supabase/client";
import { getProfile } from "@/services/db";

const cache = new Map<string, string>();

async function resolveCurrentOrgId(): Promise<string> {
  const profile = await getProfile();
  if (!profile?.organization_id) {
    throw new Error("No workspace found for this account — cannot determine storage path");
  }
  return profile.organization_id;
}

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

async function uploadScopedFile(
  bucket: "card-photos" | "template-assets",
  file: File | Blob,
  ext: string,
  subPath?: string,
): Promise<string> {
  const orgId = await resolveCurrentOrgId();
  const fileName = `${crypto.randomUUID()}.${ext}`;
  const pathParts = [orgId];
  if (subPath) pathParts.push(subPath);
  pathParts.push(fileName);
  const path = pathParts.join("/");
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false });
  if (error) throw error;
  return `${bucket}/${path}`;
}

export async function uploadCardholderPhoto(
  cardholderId: string | null,
  file: File,
): Promise<{ storagePath: string; url: string }> {
  const ext = (file.name.split(".").pop() ?? "png").toLowerCase();
  const sub = cardholderId ? `cardholders/${cardholderId}` : "cardholders";
  const stored = await uploadScopedFile("card-photos", file, ext, sub);
  const [b, ...rest] = stored.split("/");
  const { data, error } = await supabase.storage
    .from(b!)
    .createSignedUrl(rest.join("/"), 60 * 60 * 24 * 365);
  if (error || !data?.signedUrl) throw error ?? new Error("Could not sign uploaded photo");
  return { storagePath: stored, url: data.signedUrl };
}

export async function uploadTemplateAsset(
  file: File,
  templateId?: string | null,
): Promise<{ storagePath: string; url: string }> {
  const ext = (file.name.split(".").pop() ?? "png").toLowerCase();
  const sub = templateId ? `templates/${templateId}` : "templates";
  const stored = await uploadScopedFile("template-assets", file, ext, sub);
  const [b, ...rest] = stored.split("/");
  const { data, error } = await supabase.storage
    .from(b!)
    .createSignedUrl(rest.join("/"), 60 * 60 * 24 * 365);
  if (error || !data?.signedUrl) throw error ?? new Error("Could not sign uploaded asset");
  return { storagePath: stored, url: data.signedUrl };
}

export async function uploadAndSign(bucket: string, file: File): Promise<string> {
  return (await uploadGenericAsset(bucket as "card-photos" | "template-assets", file)).url;
}

export async function uploadGenericAsset(
  bucket: "card-photos" | "template-assets",
  file: File,
): Promise<{ storagePath: string; url: string }> {
  const ext = (file.name.split(".").pop() ?? "png").toLowerCase();
  const stored = await uploadScopedFile(bucket, file, ext, "uploads");
  const [b, ...rest] = stored.split("/");
  const { data, error } = await supabase.storage
    .from(b!)
    .createSignedUrl(rest.join("/"), 60 * 60 * 24 * 365);
  if (error || !data?.signedUrl) throw error ?? new Error("Could not sign uploaded file");
  return { storagePath: stored, url: data.signedUrl };
}

export const uploadAsset = uploadGenericAsset;

export async function resignAsset(stored: string, seconds = 60 * 60 * 24 * 365): Promise<string | null> {
  const [bucket, ...rest] = stored.split("/");
  if (!bucket || rest.length === 0) return null;
  const { data } = await supabase.storage.from(bucket).createSignedUrl(rest.join("/"), seconds);
  return data?.signedUrl ?? null;
}

export { uploadScopedFile as _uploadScopedFile };
