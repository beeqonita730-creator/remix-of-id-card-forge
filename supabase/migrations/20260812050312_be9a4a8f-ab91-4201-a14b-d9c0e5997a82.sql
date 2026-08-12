
create type public.app_role as enum ('admin','designer','operator','viewer');
create type public.card_status as enum ('draft','active','expired','blocked','cancelled');

create or replace function public.update_updated_at_column()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  logo_url text,
  address text,
  contact text,
  card_prefix text not null default 'ORG',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.organizations to authenticated;
grant all on public.organizations to service_role;
alter table public.organizations enable row level security;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  full_name text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.current_org_id()
returns uuid language sql stable security definer set search_path = public as $$
  select organization_id from public.profiles where id = auth.uid()
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
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

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create policy "members read own org" on public.organizations for select to authenticated
  using (id = public.current_org_id());
create policy "admins update own org" on public.organizations for update to authenticated
  using (id = public.current_org_id() and public.has_role(auth.uid(),'admin'));
create policy "read profiles in org" on public.profiles for select to authenticated
  using (organization_id = public.current_org_id() or id = auth.uid());
create policy "update own profile" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy "read own roles" on public.user_roles for select to authenticated
  using (user_id = auth.uid());

create table public.card_sizes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  name text not null,
  code text not null,
  width_mm numeric(8,2) not null,
  height_mm numeric(8,2) not null,
  orientation text not null default 'landscape',
  category text,
  description text,
  is_system_default boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.card_sizes to authenticated;
grant all on public.card_sizes to service_role;
alter table public.card_sizes enable row level security;
create policy "read system or org sizes" on public.card_sizes for select to authenticated
  using (organization_id is null or organization_id = public.current_org_id());
create policy "insert org sizes" on public.card_sizes for insert to authenticated
  with check (organization_id = public.current_org_id());
create policy "update org sizes" on public.card_sizes for update to authenticated
  using (organization_id = public.current_org_id());
create policy "delete org sizes" on public.card_sizes for delete to authenticated
  using (organization_id = public.current_org_id());

insert into public.card_sizes (name, code, width_mm, height_mm, orientation, category, description, is_system_default) values
 ('ISO CR80','CR80',85.6,54,'landscape','Standard ID Card','ISO standard ID card size',true),
 ('Event B1','B1',102,65,'landscape','Event / Committee Card','Event committee card',true),
 ('Event B2','B2',105,70,'landscape','Event / Committee Card','Large event committee card',true),
 ('Jumbo ID','JUMBO-90',90,54,'landscape','Large ID Card','Jumbo ID card',true),
 ('ID-2','ID2',105,74,'landscape','Large ID Card','ID-2 format card',true);

create table public.card_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  card_size_id uuid references public.card_sizes(id),
  orientation text not null default 'landscape',
  front_design jsonb not null default '{"elements":[],"background":{"color":"#ffffff"}}'::jsonb,
  back_design jsonb not null default '{"elements":[],"background":{"color":"#ffffff"}}'::jsonb,
  thumbnail_url text,
  background_url text,
  bleed_mm numeric(5,2) not null default 3,
  version integer not null default 1,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.card_templates to authenticated;
grant all on public.card_templates to service_role;
alter table public.card_templates enable row level security;
create policy "org templates" on public.card_templates for all to authenticated
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());
create trigger t_templates_updated before update on public.card_templates
  for each row execute function public.update_updated_at_column();

create table public.template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.card_templates(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  version integer not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);
grant select, insert on public.template_versions to authenticated;
grant all on public.template_versions to service_role;
alter table public.template_versions enable row level security;
create policy "org template versions" on public.template_versions for all to authenticated
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create table public.id_cards (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  template_id uuid references public.card_templates(id) on delete set null,
  template_version integer,
  card_size_id uuid references public.card_sizes(id),
  card_number text not null unique,
  full_name text not null,
  identification_number text,
  nik text,
  birth_place text,
  birth_date date,
  gender text,
  address text,
  phone text,
  email text,
  organization text,
  department text,
  position text,
  membership_number text,
  issue_date date not null default current_date,
  expiry_date date,
  photo_url text,
  qr_token text not null unique default encode(gen_random_bytes(16),'hex'),
  status public.card_status not null default 'draft',
  snapshot jsonb,
  custom_fields jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.id_cards to authenticated;
grant all on public.id_cards to service_role;
alter table public.id_cards enable row level security;
create policy "org cards" on public.id_cards for all to authenticated
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());
create trigger t_cards_updated before update on public.id_cards
  for each row execute function public.update_updated_at_column();

create or replace function public.next_card_number(_org uuid)
returns text language plpgsql security definer set search_path = public as $$
declare pfx text; n integer;
begin
  select card_prefix into pfx from public.organizations where id = _org;
  select count(*) + 1 into n from public.id_cards
    where organization_id = _org and extract(year from created_at) = extract(year from now());
  return coalesce(pfx,'ORG') || '-' || to_char(now(),'YYYY') || '-' || lpad(n::text, 6, '0');
end $$;
grant execute on function public.next_card_number(uuid) to authenticated;

create or replace function public.verify_card(_token text)
returns table (full_name text, org_name text, job_position text, card_state text, expiry date, card_number text)
language sql stable security definer set search_path = public as $$
  select c.full_name, c.organization, c.position,
    case when c.status = 'active' and c.expiry_date is not null and c.expiry_date < current_date
      then 'expired' else c.status::text end,
    c.expiry_date, c.card_number
  from public.id_cards c where c.qr_token = _token
$$;
grant execute on function public.verify_card(text) to anon, authenticated;

create table public.print_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  card_id uuid references public.id_cards(id) on delete cascade,
  user_id uuid references auth.users(id),
  print_type text not null default 'original',
  template_version integer,
  card_size_code text,
  paper text,
  notes text,
  created_at timestamptz not null default now()
);
grant select, insert on public.print_history to authenticated;
grant all on public.print_history to service_role;
alter table public.print_history enable row level security;
create policy "org print history" on public.print_history for all to authenticated
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create policy "auth read buckets" on storage.objects for select to authenticated
  using (bucket_id in ('organization-assets','template-assets','card-photos','generated-documents'));
create policy "auth upload buckets" on storage.objects for insert to authenticated
  with check (bucket_id in ('organization-assets','template-assets','card-photos','generated-documents'));
create policy "auth update buckets" on storage.objects for update to authenticated
  using (bucket_id in ('organization-assets','template-assets','card-photos','generated-documents'));
create policy "auth delete buckets" on storage.objects for delete to authenticated
  using (bucket_id in ('organization-assets','template-assets','card-photos','generated-documents'));
