-- Migration 005: Card Sizes

CREATE TABLE IF NOT EXISTS public.card_sizes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
    name text NOT NULL,
    code text NOT NULL,
    width_mm numeric NOT NULL,
    height_mm numeric NOT NULL,
    orientation text NOT NULL DEFAULT 'portrait'::text,
    category text,
    description text,
    is_system_default boolean NOT NULL DEFAULT false,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT card_sizes_dims_positive CHECK (width_mm > 0 AND height_mm > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS card_sizes_org_code_uniq
    ON public.card_sizes (organization_id, code)
    WHERE organization_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS card_sizes_system_code_uniq
    ON public.card_sizes (code)
    WHERE organization_id IS NULL AND is_system_default = true;

CREATE INDEX IF NOT EXISTS card_sizes_default_idx ON public.card_sizes (is_system_default DESC, width_mm);
