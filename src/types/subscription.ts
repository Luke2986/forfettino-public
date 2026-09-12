/**
 * Subscription types for the freemium tier system
 */

export type SubscriptionTier = "free" | "pro" | "studio";
export type SubscriptionStatus = "active" | "trialing" | "canceled" | "past_due" | "incomplete";

/** Admin-assigned tier override (bypasses Stripe) */
export type OverrideTier = 'pro' | 'beta_tester';

export interface Subscription {
  id: string;
  user_id: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  billing_interval?: "month" | "year" | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean | null;
  created_at: string;
  updated_at: string;
}

/** Free tier limit: max manual receipts per year */
export const FREE_RECEIPT_LIMIT = 5;

/** Free tier limit: max XML imports per year */
export const FREE_IMPORT_LIMIT = 3;

/** Free tier limit: max active service categories */
export const FREE_CATEGORY_LIMIT = 3;
