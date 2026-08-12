-- Migration 002: Enumerated Types
-- Enums must match src/integrations/supabase/types.ts exactly.

DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'designer', 'operator', 'viewer');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.card_status AS ENUM ('draft', 'active', 'expired', 'blocked', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
