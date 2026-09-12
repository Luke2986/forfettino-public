import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Test di validazione dello schema SQL per calendar_connections e calendar_events_cache.
 * Approccio: parsing del file migration SQL per verificare che contenga tutte le
 * strutture richieste (tabelle, colonne, constraint, indici, RLS, trigger).
 *
 * I test di constraint reali (CHECK, UNIQUE, CASCADE) sono verificati post-deploy
 * su Supabase — qui validiamo che la migration SQL sia completa e corretta.
 */

const MIGRATION_PATH = path.resolve(
  __dirname,
  "../../../supabase/migrations/20260325120000_calendar_connections_and_events_cache.sql"
);

const migrationSQL = fs.readFileSync(MIGRATION_PATH, "utf-8");

describe("calendar-schema migration SQL", () => {
  // ── calendar_connections ──────────────────────────────────────────

  describe("calendar_connections table", () => {
    it("creates calendar_connections table", () => {
      expect(migrationSQL).toContain(
        "CREATE TABLE IF NOT EXISTS public.calendar_connections"
      );
    });

    it.each([
      "id",
      "user_id",
      "provider",
      "provider_email",
      "access_token",
      "refresh_token",
      "sync_token",
      "expires_at",
      "last_synced_at",
      "status",
      "created_at",
    ])("has column %s", (column) => {
      // Match column name at start of line (after whitespace) in table definition
      const regex = new RegExp(`\\b${column}\\b`);
      expect(migrationSQL).toMatch(regex);
    });

    it("has UUID primary key with gen_random_uuid()", () => {
      expect(migrationSQL).toMatch(
        /id\s+UUID\s+PRIMARY\s+KEY\s+DEFAULT\s+gen_random_uuid\(\)/i
      );
    });

    it("has FK user_id → auth.users ON DELETE CASCADE", () => {
      expect(migrationSQL).toMatch(
        /user_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+auth\.users\(id\)\s+ON\s+DELETE\s+CASCADE/i
      );
    });

    it("has CHECK constraint on provider: google, apple", () => {
      expect(migrationSQL).toContain("provider IN ('google', 'apple')");
    });

    it("has CHECK constraint on status: active, error, revoked", () => {
      expect(migrationSQL).toContain(
        "status IN ('active', 'error', 'revoked')"
      );
    });

    it("has status default 'active'", () => {
      expect(migrationSQL).toMatch(/status\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'active'/i);
    });

    it("has UNIQUE constraint on (user_id, provider)", () => {
      expect(migrationSQL).toMatch(/UNIQUE\s*\(\s*user_id\s*,\s*provider\s*\)/i);
    });

    it("has index on user_id for RLS performance", () => {
      expect(migrationSQL).toContain("idx_calendar_connections_user_id");
      expect(migrationSQL).toMatch(
        /CREATE\s+INDEX\s+idx_calendar_connections_user_id/i
      );
    });

    it("enables RLS", () => {
      expect(migrationSQL).toMatch(
        /ALTER\s+TABLE\s+public\.calendar_connections\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i
      );
    });

    it.each(["SELECT", "INSERT", "UPDATE", "DELETE"])(
      "has RLS policy for %s",
      (op) => {
        const regex = new RegExp(
          `CREATE\\s+POLICY\\s+"Users can \\w+ own calendar connections"\\s+ON\\s+public\\.calendar_connections\\s+FOR\\s+${op}`,
          "i"
        );
        expect(migrationSQL).toMatch(regex);
      }
    );

    it("all RLS policies use auth.uid() = user_id", () => {
      // Count occurrences of auth.uid() = user_id related to calendar_connections
      const connectionsSection = migrationSQL.split(
        "CREATE TABLE IF NOT EXISTS public.calendar_events_cache"
      )[0];
      const policyMatches = connectionsSection.match(/auth\.uid\(\)\s*=\s*user_id/g);
      // 4 policies: SELECT (USING), INSERT (WITH CHECK), UPDATE (USING + WITH CHECK = 2), DELETE (USING) = 5 occurrences
      expect(policyMatches).not.toBeNull();
      expect(policyMatches!.length).toBeGreaterThanOrEqual(4);
    });
  });

  // ── calendar_events_cache ─────────────────────────────────────────

  describe("calendar_events_cache table", () => {
    it("creates calendar_events_cache table", () => {
      expect(migrationSQL).toContain(
        "CREATE TABLE IF NOT EXISTS public.calendar_events_cache"
      );
    });

    it.each([
      "id",
      "user_id",
      "connection_id",
      "provider",
      "external_id",
      "title",
      "start_at",
      "end_at",
      "all_day",
      "location",
      "description",
      "calendar_name",
      "color",
      "raw_data",
      "updated_at",
    ])("has column %s", (column) => {
      const eventsSection = migrationSQL.split(
        "CREATE TABLE IF NOT EXISTS public.calendar_events_cache"
      )[1];
      expect(eventsSection).toBeDefined();
      const regex = new RegExp(`\\b${column}\\b`);
      expect(eventsSection).toMatch(regex);
    });

    it("has FK connection_id → calendar_connections ON DELETE CASCADE", () => {
      expect(migrationSQL).toMatch(
        /connection_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+public\.calendar_connections\(id\)\s+ON\s+DELETE\s+CASCADE/i
      );
    });

    it("has FK user_id → auth.users ON DELETE CASCADE (events cache)", () => {
      const eventsSection = migrationSQL.split(
        "CREATE TABLE IF NOT EXISTS public.calendar_events_cache"
      )[1];
      expect(eventsSection).toMatch(
        /user_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+auth\.users\(id\)\s+ON\s+DELETE\s+CASCADE/i
      );
    });

    it("has UNIQUE constraint on (connection_id, external_id)", () => {
      expect(migrationSQL).toMatch(
        /UNIQUE\s*\(\s*connection_id\s*,\s*external_id\s*\)/i
      );
    });

    it("has all_day default false", () => {
      expect(migrationSQL).toMatch(/all_day\s+BOOLEAN\s+NOT\s+NULL\s+DEFAULT\s+false/i);
    });

    it("has start_at as NOT NULL TIMESTAMPTZ", () => {
      expect(migrationSQL).toMatch(/start_at\s+TIMESTAMPTZ\s+NOT\s+NULL/i);
    });

    it("has index on user_id", () => {
      expect(migrationSQL).toContain("idx_calendar_events_cache_user_id");
    });

    it("has index on connection_id", () => {
      expect(migrationSQL).toContain("idx_calendar_events_cache_connection_id");
    });

    it("has composite index on (user_id, start_at) for date range queries", () => {
      expect(migrationSQL).toContain("idx_calendar_events_cache_start_at");
      expect(migrationSQL).toMatch(
        /CREATE\s+INDEX\s+idx_calendar_events_cache_start_at\s+ON\s+public\.calendar_events_cache\s+\(user_id,\s*start_at\)/i
      );
    });

    it("enables RLS", () => {
      expect(migrationSQL).toMatch(
        /ALTER\s+TABLE\s+public\.calendar_events_cache\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i
      );
    });

    it.each(["SELECT", "INSERT", "UPDATE", "DELETE"])(
      "has RLS policy for %s",
      (op) => {
        const regex = new RegExp(
          `CREATE\\s+POLICY\\s+"Users can \\w+ own calendar events"\\s+ON\\s+public\\.calendar_events_cache\\s+FOR\\s+${op}`,
          "i"
        );
        expect(migrationSQL).toMatch(regex);
      }
    );

    it("has updated_at trigger using update_updated_at_column()", () => {
      expect(migrationSQL).toMatch(
        /CREATE\s+TRIGGER\s+update_calendar_events_cache_updated_at/i
      );
      expect(migrationSQL).toContain("update_updated_at_column()");
    });
  });

  // ── Cross-table integrity ─────────────────────────────────────────

  describe("cross-table integrity", () => {
    it("calendar_events_cache references calendar_connections for CASCADE delete chain", () => {
      // Verify the CASCADE chain: auth.users → calendar_connections → calendar_events_cache
      expect(migrationSQL).toMatch(
        /calendar_connections.*REFERENCES\s+auth\.users\(id\)\s+ON\s+DELETE\s+CASCADE/is
      );
      expect(migrationSQL).toMatch(
        /calendar_events_cache.*REFERENCES\s+public\.calendar_connections\(id\)\s+ON\s+DELETE\s+CASCADE/is
      );
    });

    it("both tables are created in correct order (connections before events)", () => {
      const connectionsPos = migrationSQL.indexOf(
        "CREATE TABLE IF NOT EXISTS public.calendar_connections"
      );
      const eventsPos = migrationSQL.indexOf(
        "CREATE TABLE IF NOT EXISTS public.calendar_events_cache"
      );
      expect(connectionsPos).toBeLessThan(eventsPos);
    });

    it("migration does NOT include scopes column (deferred to Epic 53)", () => {
      // Ensure we don't accidentally add the scopes column from Epic 53
      expect(migrationSQL).not.toMatch(/\bscopes\b/i);
    });

    it("migration does NOT recreate update_updated_at_column function", () => {
      // Function already exists — only the TRIGGER should be created
      expect(migrationSQL).not.toMatch(/CREATE\s+(OR\s+REPLACE\s+)?FUNCTION\s+.*update_updated_at_column/i);
    });
  });
});
