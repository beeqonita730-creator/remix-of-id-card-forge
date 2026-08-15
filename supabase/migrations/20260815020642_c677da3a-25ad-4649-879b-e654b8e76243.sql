-- 1. WITH CHECK on update policies
DROP POLICY IF EXISTS "update org sizes" ON public.card_sizes;
CREATE POLICY "update org sizes" ON public.card_sizes
  FOR UPDATE TO authenticated
  USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());

DROP POLICY IF EXISTS "admins update own org" ON public.organizations;
CREATE POLICY "admins update own org" ON public.organizations
  FOR UPDATE TO authenticated
  USING (id = public.current_org_id() AND public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (id = public.current_org_id() AND public.has_role(auth.uid(), 'admin'::app_role));

-- 2. Restrict EXECUTE on SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.current_org_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.next_card_number(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.verify_card(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.current_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_card_number(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_card(text) TO anon, authenticated;

-- 3. next_card_number must only work for the caller's own organization
CREATE OR REPLACE FUNCTION public.next_card_number(_org uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare pfx text; n integer;
begin
  if auth.uid() is null or _org is null or _org <> public.current_org_id() then
    raise exception 'not authorized';
  end if;
  select card_prefix into pfx from public.organizations where id = _org;
  select count(*) + 1 into n from public.id_cards
    where organization_id = _org and extract(year from created_at) = extract(year from now());
  return coalesce(pfx,'ORG') || '-' || to_char(now(),'YYYY') || '-' || lpad(n::text, 6, '0');
end $function$;

REVOKE ALL ON FUNCTION public.next_card_number(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_card_number(uuid) TO authenticated;