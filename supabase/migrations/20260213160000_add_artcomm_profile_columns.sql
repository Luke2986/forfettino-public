-- ============================================
-- STORY 2.1: Evoluzione Schema Database per Profilo Art/Comm
-- Aggiunge colonne per gestione INPS, anno iscrizione e riduzioni
-- alla tabella fiscal_year_settings.
-- BACKWARD COMPATIBLE: tutti i default preservano il comportamento Separata V1.
-- ============================================
-- Nota: Supabase CLI wrappa automaticamente ogni migration in una transazione.
-- NON usare BEGIN/COMMIT espliciti (causerebbe commit prematuro della transazione del CLI).
-- ============================================

-- ============================================
-- 1. COLONNA inps_management
-- Sostituisce semanticamente inps_type. Allineato al tipo
-- GestioneINPS = 'separata' | 'artigiani' | 'commercianti' di fiscal-engine.ts.
-- Default 'separata' per backward compatibility utenti esistenti.
-- ============================================
ALTER TABLE public.fiscal_year_settings
  ADD COLUMN IF NOT EXISTS inps_management TEXT NOT NULL DEFAULT 'separata';

-- CHECK constraint per valori ammessi
-- (uso DO block per idempotenza: non aggiunge se esiste già)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fiscal_year_settings_inps_management_check'
      AND conrelid = 'public.fiscal_year_settings'::regclass
  ) THEN
    ALTER TABLE public.fiscal_year_settings
      ADD CONSTRAINT fiscal_year_settings_inps_management_check
      CHECK (inps_management IN ('separata', 'artigiani', 'commercianti'));
  END IF;
END$$;

-- ============================================
-- 2. COLONNA inps_enrollment_year
-- Anno iscrizione alla gestione INPS. Nullable: solo Art/Comm.
-- CHECK: range ragionevole (2000-2100) quando valorizzato.
-- ============================================
ALTER TABLE public.fiscal_year_settings
  ADD COLUMN IF NOT EXISTS inps_enrollment_year INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fiscal_year_settings_enrollment_year_check'
      AND conrelid = 'public.fiscal_year_settings'::regclass
  ) THEN
    ALTER TABLE public.fiscal_year_settings
      ADD CONSTRAINT fiscal_year_settings_enrollment_year_check
      CHECK (inps_enrollment_year IS NULL OR (inps_enrollment_year >= 2000 AND inps_enrollment_year <= 2100));
  END IF;
END$$;

-- ============================================
-- 3. COLONNA riduzione_35_attiva
-- Riduzione contributiva 35% per Art/Comm.
-- Default false per non alterare calcoli esistenti (Separata).
-- ============================================
ALTER TABLE public.fiscal_year_settings
  ADD COLUMN IF NOT EXISTS riduzione_35_attiva BOOLEAN NOT NULL DEFAULT false;

-- ============================================
-- 4. COLONNA riduzione_50_attiva
-- Riduzione 50% nuova iscrizione (primi 3 anni).
-- Default false per non alterare calcoli esistenti (Separata).
-- ============================================
ALTER TABLE public.fiscal_year_settings
  ADD COLUMN IF NOT EXISTS riduzione_50_attiva BOOLEAN NOT NULL DEFAULT false;

-- ============================================
-- 5. COLONNA riduzione_50_scadenza
-- Data scadenza riduzione 50% (anno_iscrizione + 3, fine anno).
-- Nullable: solo se riduzione 50% attiva.
-- ============================================
ALTER TABLE public.fiscal_year_settings
  ADD COLUMN IF NOT EXISTS riduzione_50_scadenza DATE;
