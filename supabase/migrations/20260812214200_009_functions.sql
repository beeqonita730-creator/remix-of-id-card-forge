-- Migration 009: Helper Functions and RPCs
-- Order matters: utility helpers first, then business RPCs.

-- 1. Resolve the current user's organization id.
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT p.organization_id
    FROM public.profiles p
    WHERE p.id = auth.uid()
    LIMIT 1;
$$;

-- 2. Role check helper (used by RLS and hooks).
CREATE OR REPLACE FUNCTION public.has_role(_role public.app_role, _user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles r
        WHERE r.user_id = _user_id AND r.role = _role
    );
$$;

-- 3. Next card number generator.
-- Pattern: <prefix>-<YYYY>-<NNNNNN>
CREATE OR REPLACE FUNCTION public.next_card_number(_org uuid)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _prefix text := 'ORG';
    _year text := to_char(now(), 'YYYY');
    _n integer;
    _padded text;
BEGIN
    SELECT COALESCE(NULLIF(o.card_prefix, ''), 'ORG')
    INTO _prefix
    FROM public.organizations o
    WHERE o.id = _org;

    IF _prefix IS NULL THEN _prefix := 'ORG'; END IF;

    SELECT COALESCE(
        max(substring(c.card_number from '(' || _year || '-)([0-9]+)$')::integer),
        0
    ) + 1
    INTO _n
    FROM public.id_cards c
    WHERE c.organization_id = _org
      AND c.card_number LIKE (regexp_replace(_prefix, '([^A-Za-z0-9])', '\\\1', 'g') || '-' || _year || '-%');

    _padded := lpad(_n::text, 6, '0');
    RETURN _prefix || '-' || _year || '-' || _padded;
END;
$$;

-- 4. Public card verification RPC.
-- NEVER return sensitive fields (identity_number, nik, address, phone, email, internal ids).
CREATE OR REPLACE FUNCTION public.verify_card(_token text)
RETURNS TABLE (
    card_number text,
    card_state text,
    expiry timestamptz,
    full_name text,
    job_position text,
    org_name text
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        c.card_number,
        CASE
            WHEN c.status = 'blocked'::public.card_status THEN 'blocked'
            WHEN c.status = 'cancelled'::public.card_status THEN 'cancelled'
            WHEN c.status = 'draft'::public.card_status THEN 'draft'
            WHEN c.expiry_date IS NOT NULL AND c.expiry_date < CURRENT_DATE THEN 'expired'
            ELSE COALESCE(c.status::text, 'active')
        END AS card_state,
        CASE WHEN c.expiry_date IS NULL THEN NULL::timestamptz
             ELSE (c.expiry_date || ' 23:59:59')::timestamptz
        END AS expiry,
        c.full_name,
        c.position AS job_position,
        COALESCE(c.organization, o.name) AS org_name
    FROM public.id_cards c
    LEFT JOIN public.organizations o ON o.id = c.organization_id
    WHERE c.qr_token = _token
    LIMIT 1;
$$;

-- 5. Trigger to keep updated_at in sync.
CREATE OR REPLACE FUNCTION public.set_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;
