create table public.template_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  template_id uuid references public.card_templates(id) on delete set null,
  side text not null default 'FRONT' check (side in ('FRONT','BACK')),
  asset_type text not null default 'BACKGROUND' check (asset_type in ('BACKGROUND','LOGO','IMAGE','PHOTO_PLACEHOLDER','OTHER')),
  name text,
  storage_path text not null,
  file_name text,
  mime_type text,
  width_px integer,
  height_px integer,
  size_bytes bigint,
  orientation text check (orientation in ('portrait','landscape')),
  card_size_id uuid references public.card_sizes(id) on delete set null,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index template_assets_org_idx on public.template_assets (organization_id);
create index template_assets_template_idx on public.template_assets (template_id);

grant select, insert, update, delete on public.template_assets to authenticated;
grant all on public.template_assets to service_role;

alter table public.template_assets enable row level security;

create policy "org members read template assets" on public.template_assets
  for select to authenticated
  using (organization_id = public.current_org_id());

create policy "org members write template assets" on public.template_assets
  for insert to authenticated
  with check (organization_id = public.current_org_id());

create policy "org members update template assets" on public.template_assets
  for update to authenticated
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create policy "org members delete template assets" on public.template_assets
  for delete to authenticated
  using (organization_id = public.current_org_id());

create trigger template_assets_updated_at
  before update on public.template_assets
  for each row execute function public.update_updated_at_column();