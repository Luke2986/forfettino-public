/**
 * ateco-to-role-mapping.ts — Story 46.2
 * Maps Italian ATECO codes (used in regime forfettario) to Datapizza jobTitle keys.
 * Uses exact match first, then prefix fallback (first 5 chars, e.g. "62.01").
 */

export type BenchmarkJobTitle =
  | "software_developer"
  | "it_consultant"
  | "it_specialist"
  | "data_engineer"
  | "product_designer"
  | "content_creator"
  | "business_analyst"
  | "project_manager"
  | "marketing_specialist"
  | "data_analyst";

/** Exact ATECO → jobTitle */
const EXACT_MAP: Record<string, BenchmarkJobTitle> = {
  "62.01.00": "software_developer",
  "62.02.00": "it_consultant",
  "62.09.09": "it_specialist",
  "62.03.00": "it_consultant",
  "63.11.11": "data_engineer",
  "63.11.19": "data_engineer",
  "63.12.00": "data_analyst",
  "74.10.21": "product_designer",
  "74.10.29": "product_designer",
  "73.11.01": "content_creator",
  "73.11.02": "content_creator",
  "73.12.00": "marketing_specialist",
  "70.22.09": "it_consultant",
  "69.20.11": "business_analyst",
  "69.20.13": "business_analyst",
  "70.22.01": "project_manager",
};

/** Prefix (first 5 chars) → jobTitle fallback */
const PREFIX_MAP: Record<string, BenchmarkJobTitle> = {
  "62.01": "software_developer",
  "62.02": "it_consultant",
  "62.03": "it_consultant",
  "62.09": "it_specialist",
  "63.11": "data_engineer",
  "63.12": "data_analyst",
  "74.10": "product_designer",
  "73.11": "content_creator",
  "73.12": "marketing_specialist",
  "70.22": "it_consultant",
  "69.20": "business_analyst",
};

/**
 * Maps an ATECO code to a Datapizza benchmark jobTitle.
 * Returns null if no mapping exists (e.g. artigiani, commercianti).
 */
export function mapAtecoToJobTitle(atecoCode: string): BenchmarkJobTitle | null {
  const code = atecoCode.trim();
  if (!code) return null;

  // Exact match
  if (EXACT_MAP[code]) return EXACT_MAP[code];

  // Prefix fallback (first 5 chars, e.g. "62.01")
  const prefix = code.slice(0, 5);
  if (PREFIX_MAP[prefix]) return PREFIX_MAP[prefix];

  return null;
}
