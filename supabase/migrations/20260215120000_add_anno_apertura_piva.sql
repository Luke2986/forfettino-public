-- ============================================
-- STORY 2.7: Anno Apertura Partita IVA e Switch Automatico Aliquota
-- Aggiunge colonna per anno apertura partita IVA
-- alla tabella fiscal_year_settings.
-- Usata per derivare automaticamente l'aliquota sostitutiva (5% primi 5 anni, 15% dal 6°).
-- BACKWARD COMPATIBLE: default NULL preserva il comportamento manuale V1.
-- ============================================
-- Nota: Supabase CLI wrappa automaticamente ogni migration in una transazione.
-- NON usare BEGIN/COMMIT espliciti (causerebbe commit prematuro della transazione del CLI).
-- ============================================

-- ============================================
-- 1. COLONNA anno_apertura_piva
-- Anno solare di apertura della partita IVA.
-- Nullable: se NULL l'utente sceglie l'aliquota manualmente.
-- Se valorizzato, il sistema suggerisce 5% per i primi 5 anni solari, 15% dal 6°.
-- Conteggio: anno apertura = anno 1. Switch al 15% dal 1° gennaio di (anno_apertura + 5).
-- ============================================
ALTER TABLE public.fiscal_year_settings
  ADD COLUMN IF NOT EXISTS anno_apertura_piva INTEGER;

-- CHECK constraint: anno ragionevole (>= 1900, <= 2100) quando valorizzato
-- Uso DO block per idempotenza (non aggiunge se esiste già)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fiscal_year_settings_anno_apertura_piva_check'
      AND conrelid = 'public.fiscal_year_settings'::regclass
  ) THEN
    ALTER TABLE public.fiscal_year_settings
      ADD CONSTRAINT fiscal_year_settings_anno_apertura_piva_check
      CHECK (anno_apertura_piva IS NULL OR (anno_apertura_piva >= 1900 AND anno_apertura_piva <= 2100));
  END IF;
END$$;
