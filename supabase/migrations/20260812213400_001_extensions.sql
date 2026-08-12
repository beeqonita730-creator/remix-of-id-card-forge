-- Migration 001: Extensions
-- Installs required PostgreSQL extensions.

CREATE EXTENSION IF NOT EXISTS "pgcrypto" SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA public;
