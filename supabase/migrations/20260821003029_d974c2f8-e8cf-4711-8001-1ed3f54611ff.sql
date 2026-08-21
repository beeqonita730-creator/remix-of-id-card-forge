REVOKE ALL ON FUNCTION public.verify_card(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_card(text) TO service_role;

DROP POLICY IF EXISTS "org read app files" ON storage.objects;
CREATE POLICY "org read app files" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = ANY (ARRAY['organization-assets','template-assets','card-photos','generated-documents'])
  AND (
    owner = auth.uid()
    OR (
      (storage.foldername(name))[1] = private.current_org_id()::text
      AND (
        EXISTS (
          SELECT 1 FROM public.template_assets ta
          WHERE ta.organization_id = private.current_org_id()
            AND ta.storage_path = bucket_id || '/' || name
        )
        OR EXISTS (
          SELECT 1 FROM public.id_cards c
          WHERE c.organization_id = private.current_org_id()
            AND c.photo_url = bucket_id || '/' || name
        )
        OR EXISTS (
          SELECT 1 FROM public.card_templates t
          WHERE t.organization_id = private.current_org_id()
            AND (t.background_url = bucket_id || '/' || name OR t.thumbnail_url = bucket_id || '/' || name)
        )
        OR EXISTS (
          SELECT 1 FROM public.organizations o
          WHERE o.id = private.current_org_id()
            AND o.logo_url = bucket_id || '/' || name
        )
      )
    )
  )
);