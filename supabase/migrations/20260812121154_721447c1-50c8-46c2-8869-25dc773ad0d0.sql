-- 1. Storage: org-scoped access instead of any-authenticated
drop policy if exists "auth read buckets" on storage.objects;
drop policy if exists "auth upload buckets" on storage.objects;
drop policy if exists "auth update buckets" on storage.objects;
drop policy if exists "auth delete buckets" on storage.objects;

create policy "org read app files" on storage.objects for select to authenticated
using (
  bucket_id = any (array['organization-assets','template-assets','card-photos','generated-documents'])
  and (
    owner = auth.uid()
    or exists (select 1 from public.template_assets ta
      where ta.organization_id = public.current_org_id()
        and ta.storage_path = storage.objects.bucket_id || '/' || storage.objects.name)
    or exists (select 1 from public.id_cards c
      where c.organization_id = public.current_org_id()
        and c.photo_url is not null and c.photo_url like '%' || storage.objects.name || '%')
    or exists (select 1 from public.card_templates t
      where t.organization_id = public.current_org_id()
        and (coalesce(t.background_url,'') like '%' || storage.objects.name || '%'
          or coalesce(t.thumbnail_url,'') like '%' || storage.objects.name || '%'))
    or exists (select 1 from public.organizations o
      where o.id = public.current_org_id()
        and coalesce(o.logo_url,'') like '%' || storage.objects.name || '%')
  )
);

create policy "own upload app files" on storage.objects for insert to authenticated
with check (
  bucket_id = any (array['organization-assets','template-assets','card-photos','generated-documents'])
  and owner = auth.uid()
);

create policy "own update app files" on storage.objects for update to authenticated
using (
  bucket_id = any (array['organization-assets','template-assets','card-photos','generated-documents'])
  and owner = auth.uid()
)
with check (
  bucket_id = any (array['organization-assets','template-assets','card-photos','generated-documents'])
  and owner = auth.uid()
);

create policy "own delete app files" on storage.objects for delete to authenticated
using (
  bucket_id = any (array['organization-assets','template-assets','card-photos','generated-documents'])
  and owner = auth.uid()
);

-- 2. SECURITY DEFINER functions: remove public/authenticated EXECUTE where not needed
revoke all on function public.has_role(uuid, public.app_role) from public, anon, authenticated;
revoke all on function public.current_org_id() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.update_updated_at_column() from public, anon, authenticated;
revoke all on function public.next_card_number(uuid) from public, anon;
grant execute on function public.next_card_number(uuid) to authenticated;
-- public card verification page must stay callable anonymously
revoke all on function public.verify_card(text) from public;
grant execute on function public.verify_card(text) to anon, authenticated;

-- 3. user_roles: explicitly block client-side writes (no policies + no grants)
revoke insert, update, delete on public.user_roles from anon, authenticated;
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;