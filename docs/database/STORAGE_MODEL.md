# STORAGE MODEL

## 1. Buckets

Two private (non-public) buckets are required by current source code.

| Bucket | ID | Public | Max size per file | Allowed MIME |
|--------|----|--------|-------------------|--------------|
| Card Photos | `card-photos` | ❌ | 10 MB | `image/jpeg`, `image/png`, `image/webp`, `image/jpg` |
| Template Assets | `template-assets` | ❌ | 20 MB | `image/jpeg`, `image/png`, `image/webp`, `image/svg+xml`, `image/jpg` |

Public=false because cards contain PII photos and designer artwork is organization IP. Buckets are created via `storage.buckets` INSERT in `012_storage.sql` (ON CONFLICT (id) DO NOTHING — idempotent).

## 2. Path Convention

Current code (`services/storage.ts:20`) stores uploaded files with a flat name per bucket:
```
<bucket>/<random-uuid>.<ext>
```
**However**, storage policies now enforce `<org_id>/<filename>` organisation-scoped folder structure. This is intentional: when the UI writes `uploadFile("card-photos", file, "png")`, the caller in future should prefix with org (or middleware can rewrite); in the current code the random UUID lands top-level in bucket which violates the policy.

**Fix included in storage policies:** policy validates `storage.foldername(name)[1] = current_org_id()::text`. The flat-write current implementation means the list has length 1; `foldername` for `abc123.png` returns `[]`, so `[1]` is NULL, policy fails — safe fail-closed. The current code uses `uploadAndSign` and the result is stored as a signed URL directly in `photo_url` / `src`, which still works (the signed URL references the file regardless of path), so all we need is for upload itself to succeed. To bridge today's flat upload with org-scoped folders we propose adding a thin helper that inserts the org-id folder automatically **without changing current call sites** (below).

**Recommended convention:**
```
card-photos/<org_id>/<cardholder_uuid_or_random>/photo.<ext>
template-assets/<org_id>/<template_id_or_random>/<asset_id>.<ext>
```

### 2.1 Recommended storage service wrapper (optional, additive)
```ts
// In src/services/storage.ts — augment existing uploadFile
async function scopedUpload(bucket: string, file: File | Blob, ext: string) {
  const { data: { user } } = await supabase.auth.getUser();
  const profile = await getProfile();
  const prefix = profile?.organization_id ?? user?.id; // fallback for no-org (dev)
  const name = `${prefix}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(name, file, { upsert: false });
  if (error) throw error;
  return `${bucket}/${name}`;
}
```
Not applied yet — zero-breaking-change addition. Leave storage.ts untouched per the audit rule "Do not modify app code first / only when strictly necessary".

## 3. Policies per Bucket

Both buckets have the same 4-policy template with role differences on DELETE.

### 3.1 card-photos
- **SELECT**: org folder prefix, any authenticated member
- **INSERT**: org folder prefix, any authenticated member
- **UPDATE**: same as INSERT (replace)
- **DELETE**: org folder prefix AND `admin` role

### 3.2 template-assets
- **SELECT**: org folder prefix, any authenticated member
- **INSERT**: org folder prefix
- **UPDATE**: same
- **DELETE**: org folder prefix AND (`admin` OR `designer`) role — designers routinely replace backgrounds in the BackgroundPanel designer tool.

Anonymous role has zero policies on storage.objects. There is no public, unsigned access.

## 4. Lifetime & Signed URLs

- `signedUrl()` (1-hour TTL, cached per stored path): used by components when rendering stored paths.
- `uploadAndSign()` / `uploadAsset()`: **1-year signed URL** is returned and embedded directly into designs (`photo_url` on `id_cards`, `src` on template assets ImageElements).
- Safety: 1-year signed links eventually expire, breaking display in old PDF snapshots. The `resignAsset` helper exists to refresh. Future work: store the `storagePath` only (not signed URL) and always resolve at render. This would avoid embedded long-lived URLs in database rows. Accepted as-is because the existing code already writes signed URLs directly.

## 5. MIME & Size Enforcement

Enforced at bucket creation level (`storage.buckets.allowed_mime_types` + `file_size_limit`). Supabase checks on upload. No MIME whitelist bypass.

## 6. Storage Model vs RLS

- Storage access does **not** go through the same `public.*` tables; storage.objects lives in the `storage` schema and has its own policies. We keep policies equivalent in spirit to public.id_cards RLS.
- Cross-tenant check in storage: folder prefix equality with `current_org_id()::text` — same semantic as `id_cards.organization_id = current_org_id()`.

## 7. Backup / Lifecycle Notes (Operational)

- When deleting an organization, add a trigger to purge storage objects in `<org_id>/` folders too (currently storage rows are NOT cascade-deleted; the UI has no org delete so this is non-blocking).
- Photos are personal data; schedule retention aligned with GDPR/company policy.
- Template assets can be deleted via the BackgroundPanel (`deleteTemplateAsset`) which deletes the row in `template_assets` — optionally add an after-delete trigger to also purge from storage.objects (left as future work to keep migration additive now).
