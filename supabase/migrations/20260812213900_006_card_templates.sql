-- Migration 006: Card Templates, Versions and Assets

CREATE TABLE IF NOT EXISTS public.card_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    card_size_id uuid REFERENCES public.card_sizes(id) ON DELETE SET NULL,
    name text NOT NULL,
    description text,
    orientation text NOT NULL DEFAULT 'portrait'::text,
    version integer NOT NULL DEFAULT 1,
    front_design jsonb NOT NULL DEFAULT '{}'::jsonb,
    back_design jsonb NOT NULL DEFAULT '{}'::jsonb,
    background_url text,
    thumbnail_url text,
    bleed_mm numeric NOT NULL DEFAULT 0,
    width_mm numeric,
    height_mm numeric,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS card_templates_org_idx ON public.card_templates (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS card_templates_size_idx ON public.card_templates (card_size_id);

CREATE TABLE IF NOT EXISTS public.template_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id uuid NOT NULL REFERENCES public.card_templates(id) ON DELETE CASCADE,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    version integer NOT NULL,
    snapshot jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (template_id, version)
);
CREATE INDEX IF NOT EXISTS template_versions_org_idx ON public.template_versions (organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.template_assets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id uuid REFERENCES public.card_templates(id) ON DELETE SET NULL,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    card_size_id uuid REFERENCES public.card_sizes(id) ON DELETE SET NULL,
    side text NOT NULL DEFAULT 'FRONT'::text,
    asset_type text NOT NULL DEFAULT 'OTHER'::text,
    name text,
    storage_path text NOT NULL,
    file_name text,
    mime_type text,
    width_px integer,
    height_px integer,
    size_bytes bigint,
    orientation text,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS template_assets_org_idx ON public.template_assets (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS template_assets_template_idx ON public.template_assets (template_id);
CREATE INDEX IF NOT EXISTS template_assets_type_idx ON public.template_assets (asset_type);
