-- Migration 010: Triggers (updated_at, auth profile sync)

-- 1. Automatic updated_at trigger application
DO $$
DECLARE
    t record;
    tables text[] := ARRAY[
        'organizations', 'profiles', 'card_sizes',
        'card_templates', 'template_assets',
        'id_cards', 'print_history'
    ];
    _tbl text;
BEGIN
    FOREACH _tbl IN ARRAY tables LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = _tbl
              AND column_name = 'updated_at'
        ) THEN
            EXECUTE format(
                'DROP TRIGGER IF EXISTS %I_updated_at_trg ON public.%I;
                 CREATE TRIGGER %I_updated_at_trg
                 BEFORE UPDATE ON public.%I
                 FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_column()',
                _tbl, _tbl, _tbl, _tbl
            );
        END IF;
    END LOOP;
END $$;

-- 2. Profile creation on auth.users insert.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    _org_id uuid;
    _org_name text;
    _full_name text;
    _email text;
BEGIN
    _email := NEW.email;
    _full_name := COALESCE(
        NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
        NULLIF(NEW.raw_user_meta_data->>'fullName', ''),
        NULLIF(NEW.raw_user_meta_data->>'organization_name', ''),
        _email
    );
    _org_name := COALESCE(
        NULLIF(NEW.raw_user_meta_data->>'organization_name', ''),
        NULLIF(NEW.raw_user_meta_data->>'organization', '')
    );

    IF _org_name IS NOT NULL THEN
        INSERT INTO public.organizations (name) VALUES (_org_name)
        ON CONFLICT DO NOTHING;
        SELECT id INTO _org_id FROM public.organizations WHERE name = _org_name LIMIT 1;
    END IF;

    INSERT INTO public.profiles (id, organization_id, full_name, email)
    VALUES (NEW.id, _org_id, _full_name, _email)
    ON CONFLICT (id) DO UPDATE
      SET organization_id = COALESCE(profiles.organization_id, EXCLUDED.organization_id),
          full_name = COALESCE(profiles.full_name, EXCLUDED.full_name),
          email = COALESCE(profiles.email, EXCLUDED.email);

    IF _org_id IS NOT NULL THEN
        INSERT INTO public.user_roles (user_id, role)
        VALUES (NEW.id, 'admin')
        ON CONFLICT DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
