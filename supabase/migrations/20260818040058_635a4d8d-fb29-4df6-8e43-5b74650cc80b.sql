create schema if not exists private;
revoke all on schema private from anon, authenticated;
grant usage on schema private to authenticated, service_role;

alter function public.current_org_id() set schema private;
alter function public.has_role(uuid, public.app_role) set schema private;

alter function private.current_org_id() set search_path = public;
alter function private.has_role(uuid, public.app_role) set search_path = public;

revoke all on function private.current_org_id() from public, anon;
revoke all on function private.has_role(uuid, public.app_role) from public, anon;
grant execute on function private.current_org_id() to authenticated, service_role;
grant execute on function private.has_role(uuid, public.app_role) to authenticated, service_role;

create or replace function public.next_card_number(_org uuid)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare pfx text; n integer;
begin
  if auth.uid() is null or _org is null or _org <> private.current_org_id() then
    raise exception 'not authorized';
  end if;
  select card_prefix into pfx from public.organizations where id = _org;
  select count(*) + 1 into n from public.id_cards
    where organization_id = _org and extract(year from created_at) = extract(year from now());
  return coalesce(pfx,'ORG') || '-' || to_char(now(),'YYYY') || '-' || lpad(n::text, 6, '0');
end $$;

revoke all on function public.next_card_number(uuid) from public, anon;
grant execute on function public.next_card_number(uuid) to authenticated, service_role;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare new_org uuid;
begin
  insert into public.organizations (name, card_prefix)
  values (coalesce(nullif(new.raw_user_meta_data->>'organization',''), 'My Organization'),
          upper(left(regexp_replace(coalesce(nullif(new.raw_user_meta_data->>'organization',''),'ORG'), '[^a-zA-Z]', '', 'g') || 'ORG', 3)))
  returning id into new_org;
  insert into public.profiles (id, organization_id, full_name, email)
  values (new.id, new_org, new.raw_user_meta_data->>'full_name', new.email);
  insert into public.user_roles (user_id, role) values (new.id, 'admin');
  return new;
end $$;
revoke all on function public.handle_new_user() from public, anon, authenticated;