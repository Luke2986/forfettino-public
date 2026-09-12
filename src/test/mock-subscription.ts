/**
 * Shared subscription mock factory for tests.
 * Avoids 14-property copy-paste across test files.
 */

import type { SubscriptionTier } from "@/types/subscription";

export const FREE_SUBSCRIPTION: {
  isPro: boolean;
  isStudio: boolean;
  hasPaidPlan: boolean;
  tier: SubscriptionTier;
  isLoading: boolean;
  subscription: any;
  canImport: boolean;
  canExport: boolean;
  canSelectYear: boolean;
  canAddReceipt: boolean;
  receiptsUsed: number;
  receiptsLimit: number;
  importsUsed: number;
  importsLimit: number;
  canAddImport: boolean;
} = {
  isPro: false,
  isStudio: false,
  hasPaidPlan: false,
  tier: "free",
  isLoading: false,
  subscription: null,
  canImport: false,
  canExport: false,
  canSelectYear: false,
  canAddReceipt: true,
  receiptsUsed: 0,
  receiptsLimit: 5,
  importsUsed: 0,
  importsLimit: 3,
  canAddImport: true,
};

export const PRO_SUBSCRIPTION: typeof FREE_SUBSCRIPTION = {
  isPro: true,
  isStudio: false,
  hasPaidPlan: true,
  tier: "pro",
  isLoading: false,
  subscription: null,
  canImport: true,
  canExport: true,
  canSelectYear: true,
  canAddReceipt: true,
  receiptsUsed: 0,
  receiptsLimit: 999,
  importsUsed: 0,
  importsLimit: 999,
  canAddImport: true,
};

/**
 * Story 56-1: Override PRO via admin_override_tier = 'pro' (no Stripe).
 * Permissions identiche a PRO_SUBSCRIPTION — la distinzione e' nel profilo mock,
 * non nell'output di useSubscription. Usare questo mock per chiarezza semantica
 * nei test che verificano il percorso override (non Stripe).
 */
export const OVERRIDE_PRO_SUBSCRIPTION: typeof FREE_SUBSCRIPTION = {
  ...PRO_SUBSCRIPTION,
  subscription: null, // nessun record Stripe — il PRO viene dall'override
};

/**
 * Story 56-1: Override beta_tester — stesse permission di PRO.
 * Usare nei test che verificano beta_tester = isPro.
 */
export const OVERRIDE_BETA_SUBSCRIPTION: typeof FREE_SUBSCRIPTION = {
  ...PRO_SUBSCRIPTION,
  subscription: null, // nessun record Stripe — il PRO viene dall'override
};
