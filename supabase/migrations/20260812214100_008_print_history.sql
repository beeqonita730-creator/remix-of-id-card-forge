-- Migration 008: Print History / Audit Log

CREATE TABLE IF NOT EXISTS public.print_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    card_id uuid REFERENCES public.id_cards(id) ON DELETE SET NULL,
    print_type text NOT NULL DEFAULT 'single_card'::text,
    template_version integer,
    card_size_code text,
    paper text,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS print_history_org_idx ON public.print_history (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS print_history_card_idx ON public.print_history (card_id);
CREATE INDEX IF NOT EXISTS print_history_user_idx ON public.print_history (user_id);
