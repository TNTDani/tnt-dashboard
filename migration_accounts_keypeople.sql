-- Voeg key_people kolom toe aan accounts (voor gevonden contactpersonen via enrichment).
-- Draai dit in de Supabase SQL-editor als je migration_accounts_pitch.sql al hebt gedraaid.

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS key_people jsonb NOT NULL DEFAULT '[]';
