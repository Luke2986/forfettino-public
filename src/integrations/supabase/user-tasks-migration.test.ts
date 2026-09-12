/**
 * Story 61.1 — Test di validazione strutturale della migration user_tasks.
 * Verifica che il file SQL contenga tutte le colonne, constraint, RLS, indici e trigger richiesti.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const MIGRATION_PATH = resolve(
  __dirname,
  "../../../supabase/migrations/20260324130000_create_user_tasks.sql"
);

const migrationSQL = readFileSync(MIGRATION_PATH, "utf-8");

describe("user_tasks migration — Story 61.1", () => {
  // ===== TABLE CREATION =====

  it("should CREATE TABLE user_tasks", () => {
    expect(migrationSQL).toMatch(/CREATE TABLE.*user_tasks/i);
  });

  // ===== COLUMNS (AC #1) =====

  it("should have id UUID PRIMARY KEY DEFAULT gen_random_uuid()", () => {
    expect(migrationSQL).toMatch(/id\s+UUID\s+PRIMARY KEY\s+DEFAULT\s+gen_random_uuid\(\)/i);
  });

  it("should have user_id UUID NOT NULL REFERENCES auth.users", () => {
    expect(migrationSQL).toMatch(/user_id\s+UUID\s+NOT NULL\s+REFERENCES\s+auth\.users/i);
  });

  it("should have title TEXT NOT NULL", () => {
    expect(migrationSQL).toMatch(/title\s+TEXT\s+NOT NULL/i);
  });

  it("should have description TEXT (nullable, no NOT NULL)", () => {
    expect(migrationSQL).toMatch(/description\s+TEXT/i);
    expect(migrationSQL).not.toMatch(/description\s+TEXT\s+NOT NULL/i);
  });

  it("should have due_date DATE (nullable, no NOT NULL)", () => {
    expect(migrationSQL).toMatch(/due_date\s+DATE/i);
    expect(migrationSQL).not.toMatch(/due_date\s+DATE\s+NOT NULL/i);
  });

  it("should have priority TEXT NOT NULL DEFAULT 'media' with named CHECK constraint", () => {
    expect(migrationSQL).toMatch(/priority\s+TEXT\s+NOT NULL\s+DEFAULT\s+'media'/i);
    expect(migrationSQL).toMatch(/CONSTRAINT\s+user_tasks_priority_check\s+CHECK\s*\(\s*priority\s+IN\s*\(\s*'bassa'\s*,\s*'media'\s*,\s*'alta'\s*\)\s*\)/i);
  });

  it("should have status TEXT NOT NULL DEFAULT 'da_fare' with named CHECK constraint", () => {
    expect(migrationSQL).toMatch(/status\s+TEXT\s+NOT NULL\s+DEFAULT\s+'da_fare'/i);
    expect(migrationSQL).toMatch(/CONSTRAINT\s+user_tasks_status_check\s+CHECK\s*\(\s*status\s+IN\s*\(\s*'da_fare'\s*,\s*'in_corso'\s*,\s*'completato'\s*\)\s*\)/i);
  });

  it("should have completed_at TIMESTAMPTZ (nullable)", () => {
    expect(migrationSQL).toMatch(/completed_at\s+TIMESTAMPTZ/i);
  });

  it("should have created_at TIMESTAMPTZ NOT NULL DEFAULT now()", () => {
    expect(migrationSQL).toMatch(/created_at\s+TIMESTAMPTZ\s+NOT NULL\s+DEFAULT\s+now\(\)/i);
  });

  it("should have updated_at TIMESTAMPTZ NOT NULL DEFAULT now()", () => {
    expect(migrationSQL).toMatch(/updated_at\s+TIMESTAMPTZ\s+NOT NULL\s+DEFAULT\s+now\(\)/i);
  });

  // ===== INDEX (AC #3) =====

  it("should have index on user_id for RLS performance", () => {
    expect(migrationSQL).toMatch(/CREATE INDEX.*user_tasks.*user_id/i);
  });

  // ===== RLS (AC #2) =====

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

  // ===== TRIGGER (AC #5) =====

  it("should have trigger for updated_at using update_updated_at_column()", () => {
    expect(migrationSQL).toMatch(/CREATE TRIGGER.*update_user_tasks_updated_at/i);
    expect(migrationSQL).toMatch(/EXECUTE FUNCTION.*update_updated_at_column\(\)/i);
  });
});
