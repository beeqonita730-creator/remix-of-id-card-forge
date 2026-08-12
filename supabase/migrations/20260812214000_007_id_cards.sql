-- Migration 007: ID Cards

CREATE TABLE IF NOT EXISTS public.id_cards (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    card_size_id uuid REFERENCES public.card_sizes(id) ON DELETE SET NULL,
    template_id uuid REFERENCES public.card_templates(id) ON DELETE SET NULL,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    template_version integer,
    card_number text NOT NULL,
    qr_token text NOT NULL DEFAULT encode(gen_random_bytes(12), 'hex'),
    full_name text NOT NULL,
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
    issue_date date NOT NULL DEFAULT CURRENT_DATE,
    expiry_date date,
    photo_url text,
    status public.card_status NOT NULL DEFAULT 'draft'::public.card_status,
    orientation text NOT NULL DEFAULT 'portrait'::text,
    snapshot jsonb,
    custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS id_cards_org_number_uniq
    ON public.id_cards (organization_id, card_number);

CREATE UNIQUE INDEX IF NOT EXISTS id_cards_qr_token_uniq
    ON public.id_cards (qr_token);

CREATE INDEX IF NOT EXISTS id_cards_org_idx ON public.id_cards (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS id_cards_template_idx ON public.id_cards (template_id);
CREATE INDEX IF NOT EXISTS id_cards_size_idx ON public.id_cards (card_size_id);
CREATE INDEX IF NOT EXISTS id_cards_status_idx ON public.id_cards (status);
CREATE INDEX IF NOT EXISTS id_cards_full_name_idx ON public.id_cards (full_name);
CREATE INDEX IF NOT EXISTS id_cards_department_idx ON public.id_cards (department);
CREATE INDEX IF NOT EXISTS id_cards_holder_search_idx
    ON public.id_cards (organization_id, lower(full_name), lower(coalesce(department, '')));
