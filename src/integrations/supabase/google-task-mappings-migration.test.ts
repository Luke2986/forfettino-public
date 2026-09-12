/**
 * Story 53.1 — Test di validazione strutturale della migration google_task_mappings.
 * Verifica che il file SQL contenga tutte le colonne, constraint, RLS e indici richiesti.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const MIGRATION_PATH = resolve(
  __dirname,
  "../../../supabase/migrations/20260324120000_create_google_task_mappings.sql"
);

const migrationSQL = readFileSync(MIGRATION_PATH, "utf-8");

describe("google_task_mappings migration — Story 53.1", () => {
  // ===== TABLE CREATION =====

  it("should CREATE TABLE google_task_mappings", () => {
    expect(migrationSQL).toMatch(/CREATE TABLE.*google_task_mappings/i);
  });

  // ===== COLUMNS (AC #2) =====

  it("should have id UUID PRIMARY KEY DEFAULT gen_random_uuid()", () => {
    expect(migrationSQL).toMatch(/id\s+UUID\s+PRIMARY KEY\s+DEFAULT\s+gen_random_uuid\(\)/i);
  });

  it("should have user_id UUID NOT NULL REFERENCES auth.users", () => {
    expect(migrationSQL).toMatch(/user_id\s+UUID\s+NOT NULL\s+REFERENCES\s+auth\.users/i);
  });

  it("should have schedule_event_id TEXT NOT NULL", () => {
    expect(migrationSQL).toMatch(/schedule_event_id\s+TEXT\s+NOT NULL/i);
  });

  it("should have google_task_id TEXT NOT NULL", () => {
    expect(migrationSQL).toMatch(/google_task_id\s+TEXT\s+NOT NULL/i);
  });

  it("should have google_tasklist_id TEXT NOT NULL", () => {
    expect(migrationSQL).toMatch(/google_tasklist_id\s+TEXT\s+NOT NULL/i);
  });

  it("should have status TEXT NOT NULL DEFAULT 'synced' with CHECK constraint", () => {
    expect(migrationSQL).toMatch(/status\s+TEXT\s+NOT NULL\s+DEFAULT\s+'synced'/i);
    expect(migrationSQL).toMatch(/CHECK\s*\(\s*status\s+IN\s*\(\s*'synced'\s*,\s*'error'\s*,\s*'deleted'\s*\)\s*\)/i);
  });

  it("should have last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now()", () => {
    expect(migrationSQL).toMatch(/last_synced_at\s+TIMESTAMPTZ\s+NOT NULL\s+DEFAULT\s+now\(\)/i);
  });

  it("should have created_at TIMESTAMPTZ NOT NULL DEFAULT now()", () => {
    expect(migrationSQL).toMatch(/created_at\s+TIMESTAMPTZ\s+NOT NULL\s+DEFAULT\s+now\(\)/i);
  });

  // ===== UNIQUE CONSTRAINT =====

  it("should have UNIQUE constraint on (user_id, schedule_event_id)", () => {
    expect(migrationSQL).toMatch(/UNIQUE\s*\(\s*user_id\s*,\s*schedule_event_id\s*\)/i);
  });

  // ===== INDEX =====

  it("should have index on user_id for RLS performance", () => {
    expect(migrationSQL).toMatch(/CREATE INDEX.*google_task_mappings.*user_id/i);
  });

  // ===== RLS (AC #3) =====

  it("should ENABLE ROW LEVEL SECURITY", () => {
    expect(migrationSQL).toMatch(/ENABLE ROW LEVEL SECURITY/i);
  });

  it("should have SELECT policy with auth.uid() = user_id", () => {
    expect(migrationSQL).toMatch(/FOR SELECT[\s\S]*?auth\.uid\(\)\s*=\s*user_id/i);
  });

  it("should have INSERT policy with auth.uid() = user_id", () => {
    expect(migrationSQL).toMatch(/FOR INSERT[\s\S]*?auth\.uid\(\)\s*=\s*user_id/i);
  });

  it("should have UPDATE policy with auth.uid() = user_id (USING + WITH CHECK)", () => {
    // UPDATE policy needs both USING and WITH CHECK
    const updateSection = migrationSQL.match(/FOR UPDATE[\s\S]*?(?=CREATE POLICY|$)/i)?.[0] ?? "";
    expect(updateSection).toMatch(/USING\s*\(\s*auth\.uid\(\)\s*=\s*user_id\s*\)/i);
    expect(updateSection).toMatch(/WITH CHECK\s*\(\s*auth\.uid\(\)\s*=\s*user_id\s*\)/i);
  });

  it("should have DELETE policy with auth.uid() = user_id", () => {
    expect(migrationSQL).toMatch(/FOR DELETE[\s\S]*?auth\.uid\(\)\s*=\s*user_id/i);
  });

  // ===== ON DELETE CASCADE =====

  it("should CASCADE on user deletion", () => {
    expect(migrationSQL).toMatch(/ON DELETE CASCADE/i);
  });
});
