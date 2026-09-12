import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4?target=denonext";

// Product IDs to tier mapping — MUST stay in sync with check-subscription/index.ts
const PRODUCT_TIERS: Record<string, string> = {
  "prod_Tw8QUsJmF3kaQB": "pro", // Monthly
  "prod_Tw8PblWPW5tafe": "pro", // Annual
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  // Webhook does NOT need CORS or Authorization — Stripe calls directly
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200 });
  }

  try {
    logStep("Webhook received");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Verify webhook signature using raw body
    const signature = req.headers.get("stripe-signature");
    if (!signature) throw new Error("No stripe-signature header");

    const body = await req.text();
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logStep("Signature verification failed", { error: msg });
      return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400 });
    }

    logStep("Event verified", { type: event.type, id: event.id });

    // Service role client for DB writes (bypasses RLS)
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // Handle relevant events
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        logStep("Checkout completed", { sessionId: session.id, customerId: session.customer });

        // Extract user_id from metadata
        const userId = session.metadata?.user_id;
        if (!userId) {
          logStep("No user_id in session metadata, skipping");
          break;
        }

        // --- Launch Cap Enforcement (before subscription sync) ---
        const windowId = session.metadata?.window_id;
        if (windowId) {
          logStep("Launch window detected, enforcing cap", { windowId, sessionId: session.id });

          const { data: capResult, error: capError } = await supabaseClient.rpc(
            "decrement_launch_cap",
            {
              p_window_id: windowId,
              p_checkout_session_id: session.id,
              p_user_id: userId,
            }
          );

          if (capError) {
            logStep("Cap decrement RPC error", { error: capError.message });
            // RPC call failed entirely — proceed with subscription (don't block paying user)
          } else if (capResult && !capResult.success) {
            const reason = capResult.reason as string;
            logStep("Cap decrement failed", { reason, windowId });

            if (reason === "already_processed") {
              // Idempotent retry from Stripe — safe to proceed
              logStep("Already processed, proceeding normally");
            } else if (reason === "lock_timeout") {
              // Lock contention — don't block paying user, log warning
              logStep("WARN: Lock timeout on cap decrement, proceeding with subscription");
            } else {
              // cap_exhausted, window_inactive, window_closed, window_not_found → refund
              logStep("Initiating refund due to cap failure", { reason });
              let refundSucceeded = false;

              try {
                // In subscription mode, payment_intent may be null — get it from the invoice
                let paymentIntentId: string | null = null;

                if (session.payment_intent) {
                  paymentIntentId = typeof session.payment_intent === "string"
                    ? session.payment_intent
                    : session.payment_intent.id;
                } else if (session.invoice) {
                  const invoiceId = typeof session.invoice === "string"
                    ? session.invoice
                    : session.invoice.id;
                  const invoice = await stripe.invoices.retrieve(invoiceId);
                  if (invoice.payment_intent) {
                    paymentIntentId = typeof invoice.payment_intent === "string"
                      ? invoice.payment_intent
                      : invoice.payment_intent.id;
                  }
                }

                if (paymentIntentId) {
                  await stripe.refunds.create({ payment_intent: paymentIntentId });
                  logStep("Refund issued successfully", { paymentIntentId, reason });
                  refundSucceeded = true;
                } else {
                  logStep("ERROR: Could not find payment_intent for refund", { sessionId: session.id });
                  await supabaseClient.from("event_logs").insert({
                    user_id: userId,
                    event_name: "cap_refund_failed",
                    props: { window_id: windowId, user_id: userId, checkout_session_id: session.id, error: "no_payment_intent" },
                  });
                }
              } catch (refundError) {
                const refundMsg = refundError instanceof Error ? refundError.message : String(refundError);
                logStep("ERROR: Refund failed, proceeding with subscription", { error: refundMsg });
                await supabaseClient.from("event_logs").insert({
                  user_id: userId,
                  event_name: "cap_refund_failed",
                  props: { window_id: windowId, user_id: userId, checkout_session_id: session.id, error: refundMsg },
                });
              }

              if (refundSucceeded) {
                // Refund issued — do NOT create subscription
                logStep("Skipping subscription sync due to cap failure + successful refund", { reason });
                break;
              }
              // Refund failed — proceed with subscription (honor payment, logged for manual review)
              logStep("WARN: Refund failed, honoring subscription despite cap failure", { reason });
            }
          } else if (capResult && capResult.success) {
            logStep("Cap decremented successfully", { remaining: capResult.remaining });
          }
        }

        // If subscription mode, fetch the subscription to sync
        if (session.mode === "subscription" && session.subscription) {
          const subscriptionId = typeof session.subscription === "string"
            ? session.subscription
            : session.subscription.id;

          await syncSubscription(stripe, supabaseClient, subscriptionId, userId);
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Subscription event", { type: event.type, subscriptionId: subscription.id, status: subscription.status });

        // Extract user_id from subscription metadata
        const userId = subscription.metadata?.user_id;
        if (!userId) {
          logStep("No user_id in subscription metadata, looking up by stripe_subscription_id");
          // Fallback: find user_id in subscriptions table by stripe_subscription_id
          const { data: existingSub } = await supabaseClient
            .from("subscriptions")
            .select("user_id")
            .eq("stripe_subscription_id", subscription.id)
            .maybeSingle();

          if (!existingSub?.user_id) {
            logStep("Cannot find user_id, skipping event");
            break;
          }
          await syncSubscriptionData(supabaseClient, subscription, existingSub.user_id);
          break;
        }

        await syncSubscriptionData(supabaseClient, subscription, userId);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        logStep("Payment succeeded", { invoiceId: invoice.id, subscriptionId: invoice.subscription });

        // Re-sync subscription to active after successful payment (e.g. recovery from past_due)
        if (invoice.subscription) {
          const subscriptionId = typeof invoice.subscription === "string"
            ? invoice.subscription
            : invoice.subscription.id;

          // Fetch fresh subscription data from Stripe to get accurate status
          const freshSub = await stripe.subscriptions.retrieve(subscriptionId);
          const userId = freshSub.metadata?.user_id;

          if (userId) {
            await syncSubscriptionData(supabaseClient, freshSub, userId);
          } else {
            // Fallback: find user_id in DB
            const { data: existingSub } = await supabaseClient
              .from("subscriptions")
              .select("user_id")
              .eq("stripe_subscription_id", subscriptionId)
              .maybeSingle();

            if (existingSub?.user_id) {
              await syncSubscriptionData(supabaseClient, freshSub, existingSub.user_id);
            } else {
              logStep("Cannot find user_id for payment_succeeded, skipping");
            }
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        logStep("Payment failed", { invoiceId: invoice.id, subscriptionId: invoice.subscription });

        // Update subscription status to past_due if applicable
        if (invoice.subscription) {
          const subscriptionId = typeof invoice.subscription === "string"
            ? invoice.subscription
            : invoice.subscription.id;

          const { error } = await supabaseClient
            .from("subscriptions")
            .update({
              status: "past_due",
              updated_at: new Date().toISOString(),
            })
            .eq("stripe_subscription_id", subscriptionId);

          if (error) {
            logStep("Error updating subscription to past_due", { error: error.message });
          } else {
            logStep("Subscription marked as past_due");
          }
        }
        break;
      }

      default:
        logStep("Unhandled event type, ignoring", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});

/**
 * Sync subscription data by fetching full subscription from Stripe
 */
async function syncSubscription(
  stripe: Stripe,
  supabaseClient: any,
  subscriptionId: string,
  userId: string
) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  await syncSubscriptionData(supabaseClient, subscription, userId);
}

/**
 * Sync subscription data to DB — mirrors logic from check-subscription
 */
async function syncSubscriptionData(
  supabaseClient: any,
  subscription: Stripe.Subscription,
  userId: string
) {
  const isActive = ["active", "trialing"].includes(subscription.status);

  if (!isActive && subscription.status === "canceled") {
    // Subscription fully canceled — delete record so user reverts to free
    logStep("Subscription canceled, deleting record", { userId });
    const { error } = await supabaseClient
      .from("subscriptions")
      .delete()
      .eq("user_id", userId);

    if (error) {
      logStep("Error deleting subscription", { error: error.message });
    }
    return;
  }

  // Extract product and tier
  const priceItem = subscription.items.data[0]?.price;
  let productId: string | null = null;

  if (priceItem?.product) {
    if (typeof priceItem.product === "string") {
      productId = priceItem.product;
    } else if (typeof priceItem.product === "object" && priceItem.product !== null) {
      productId = (priceItem.product as { id: string }).id;
    }
  }

  let tier = "free";
  if (productId) {
    const mappedTier = PRODUCT_TIERS[productId];
    if (mappedTier) {
      tier = mappedTier;
    } else {
      logStep("WARNING: Unknown product ID, defaulting to free", { productId });
      tier = "free";
    }
  } else {
    logStep("WARNING: No product ID found in subscription items");
  }
  const billingInterval = priceItem?.recurring?.interval || null;

  // Safe timestamp conversion
  let currentPeriodStart: string | null = null;
  let currentPeriodEnd: string | null = null;

  const periodStart = subscription.current_period_start;
  const periodEnd = subscription.current_period_end;

  if (typeof periodStart === "number" && periodStart > 0) {
    currentPeriodStart = new Date(periodStart * 1000).toISOString();
  }
  if (typeof periodEnd === "number" && periodEnd > 0) {
    currentPeriodEnd = new Date(periodEnd * 1000).toISOString();
  }

  // Find Stripe customer ID
  const customerId = typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer.id;

  const upsertData = {
    user_id: userId,
    tier,
    status: subscription.status,
    billing_interval: billingInterval,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    current_period_start: currentPeriodStart,
    current_period_end: currentPeriodEnd,
    cancel_at_period_end: subscription.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  };

  logStep("Upserting subscription", { userId, tier, status: subscription.status, cancelAtPeriodEnd: subscription.cancel_at_period_end });

  const { error } = await supabaseClient
    .from("subscriptions")
    .upsert(upsertData, { onConflict: "user_id" });

  if (error) {
    logStep("Error upserting subscription", { error: error.message });
  } else {
    logStep("Subscription synced successfully");
  }
}
