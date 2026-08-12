ALTER TABLE public.card_sizes ALTER COLUMN orientation SET DEFAULT 'both';
UPDATE public.card_sizes SET orientation = 'both';

ALTER TABLE public.card_templates ADD COLUMN IF NOT EXISTS width_mm numeric;
ALTER TABLE public.card_templates ADD COLUMN IF NOT EXISTS height_mm numeric;

ALTER TABLE public.id_cards ADD COLUMN IF NOT EXISTS orientation text NOT NULL DEFAULT 'portrait';

ALTER TABLE public.card_templates ADD CONSTRAINT card_templates_orientation_chk CHECK (orientation IN ('portrait','landscape'));
ALTER TABLE public.id_cards ADD CONSTRAINT id_cards_orientation_chk CHECK (orientation IN ('portrait','landscape'));
ALTER TABLE public.card_sizes ADD CONSTRAINT card_sizes_orientation_chk CHECK (orientation IN ('portrait','landscape','both'));