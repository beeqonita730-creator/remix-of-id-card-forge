-- Migration 012: Storage Buckets and Policies
-- Buckets: card-photos (id card holder photos), template-assets (designer images/artwork)
-- Storage rows live in the private storage schema; policies below control access.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('card-photos', 'card-photos', false, 10485760, ARRAY['image/jpeg','image/png','image/webp','image/jpg'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('template-assets', 'template-assets', false, 20971520, ARRAY['image/jpeg','image/png','image/webp','image/svg+xml','image/jpg'])
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Storage access policies
-- Authenticated users of the org can upload/list/read within
-- their org-scoped prefix: <org_id>/...
-- ============================================================

-- ----- card-photos -----
DROP POLICY IF EXISTS card_photos_select ON storage.objects;
CREATE POLICY card_photos_select ON storage.objects
    FOR SELECT USING (
        bucket_id = 'card-photos'
        AND auth.uid() IS NOT NULL
        AND (storage.foldername(name))[1] = public.current_org_id()::text
    );

DROP POLICY IF EXISTS card_photos_insert ON storage.objects;
CREATE POLICY card_photos_insert ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'card-photos'
        AND auth.uid() IS NOT NULL
        AND (storage.foldername(name))[1] = public.current_org_id()::text
    );

DROP POLICY IF EXISTS card_photos_update ON storage.objects;
CREATE POLICY card_photos_update ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'card-photos'
        AND auth.uid() IS NOT NULL
        AND (storage.foldername(name))[1] = public.current_org_id()::text
    );

DROP POLICY IF EXISTS card_photos_delete ON storage.objects;
CREATE POLICY card_photos_delete ON storage.objects
    FOR DELETE USING (
        bucket_id = 'card-photos'
        AND public.has_role('admin', auth.uid())
        AND (storage.foldername(name))[1] = public.current_org_id()::text
    );

-- ----- template-assets -----
DROP POLICY IF EXISTS template_assets_select ON storage.objects;
CREATE POLICY template_assets_select ON storage.objects
    FOR SELECT USING (
        bucket_id = 'template-assets'
        AND auth.uid() IS NOT NULL
        AND (storage.foldername(name))[1] = public.current_org_id()::text
    );

DROP POLICY IF EXISTS template_assets_insert ON storage.objects;
CREATE POLICY template_assets_insert ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'template-assets'
        AND auth.uid() IS NOT NULL
        AND (storage.foldername(name))[1] = public.current_org_id()::text
    );

DROP POLICY IF EXISTS template_assets_update ON storage.objects;
CREATE POLICY template_assets_update ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'template-assets'
        AND auth.uid() IS NOT NULL
        AND (storage.foldername(name))[1] = public.current_org_id()::text
    );

DROP POLICY IF EXISTS template_assets_delete ON storage.objects;
CREATE POLICY template_assets_delete ON storage.objects
    FOR DELETE USING (
        bucket_id = 'template-assets'
        AND (public.has_role('admin', auth.uid()) OR public.has_role('designer', auth.uid()))
        AND (storage.foldername(name))[1] = public.current_org_id()::text
    );
