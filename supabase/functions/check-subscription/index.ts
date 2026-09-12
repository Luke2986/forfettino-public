import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4?target=denonext";

const ALLOWED_ORIGINS = [
  "https://forfettino.lovable.app",
  "https://forfettino.it",
  "http://localhost:5173",
  "http://localhost:8080",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

// Product IDs to tier mapping
const PRODUCT_TIERS: Record<string, string> = {
  "prod_Tw8QUsJmF3kaQB": "pro", // Monthly
  "prod_Tw8PblWPW5tafe": "pro", // Annual
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");

    // Use anon key client for auth (avoids connection reset on Lovable Cloud)
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await anonClient.auth.getUser(token);
    if (userError) {
      logStep("Auth failed (likely expired token), returning free state", { error: userError.message });
      return new Response(JSON.stringify({ 
        subscribed: false,
        tier: "free",
        subscription_end: null
      }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Service role client for DB writes
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });
    
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Initialize Stripe
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Find customer by email
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      logStep("No customer found, returning unsubscribed state");
      
      // Delete any existing subscription record
      await supabaseClient
        .from("subscriptions")
        .delete()
        .eq("user_id", user.id);
      
      return new Response(JSON.stringify({ 
        subscribed: false,
        tier: "free",
        subscription_end: null
      }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    // Get active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    const hasActiveSub = subscriptions.data.length > 0;
    let tier = "free";
    let subscriptionEnd: string | null = null;
    let currentPeriodStart: string | null = null;
    let billingInterval: string | null = null;
    let stripeSubscriptionId: string | null = null;

    if (hasActiveSub) {
      const subscription = subscriptions.data[0];
      stripeSubscriptionId = subscription.id;
      
      // Safe timestamp conversion
      try {
        const periodStart = subscription.current_period_start;
        const periodEnd = subscription.current_period_end;
        
        logStep("Raw timestamps", { periodStart, periodEnd, typeStart: typeof periodStart, typeEnd: typeof periodEnd });
        
        if (typeof periodStart === 'number' && periodStart > 0) {
          currentPeriodStart = new Date(periodStart * 1000).toISOString();
        } else {
          logStep("Invalid period_start value", { periodStart });
        }
        
        if (typeof periodEnd === 'number' && periodEnd > 0) {
          subscriptionEnd = new Date(periodEnd * 1000).toISOString();
        } else {
          logStep("Invalid period_end value", { periodEnd });
        }
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        logStep("Error converting timestamps", { error: errorMsg });
      }
      
      // Safe product ID extraction (handle both string and expanded object)
      const priceItem = subscription.items.data[0]?.price;
      let productId: string | null = null;
      
      if (priceItem?.product) {
        if (typeof priceItem.product === 'string') {
          productId = priceItem.product;
        } else if (typeof priceItem.product === 'object' && priceItem.product !== null) {
          // Product is expanded as an object
          productId = (priceItem.product as { id: string }).id;
        }
      }
      
      tier = productId ? (PRODUCT_TIERS[productId] || "pro") : "pro";
      billingInterval = priceItem?.recurring?.interval || null;
      
      logStep("Active subscription found", { 
        subscriptionId: subscription.id, 
        startDate: currentPeriodStart,
        endDate: subscriptionEnd,
        tier,
        productId,
        billingInterval,
        cancelAtPeriodEnd: subscription.cancel_at_period_end
      });

      // Upsert subscription in database using user_id as conflict key
      const upsertData = {
        user_id: user.id,
        tier,
        status: subscription.status,
        billing_interval: billingInterval,
        stripe_customer_id: customerId,
        stripe_subscription_id: stripeSubscriptionId,
        current_period_start: currentPeriodStart,
        current_period_end: subscriptionEnd,
        cancel_at_period_end: subscription.cancel_at_period_end,
        updated_at: new Date().toISOString(),
      };
      
      logStep("Upserting subscription", upsertData);

      const { error: upsertError } = await supabaseClient
        .from("subscriptions")
        .upsert(upsertData, { 
          onConflict: "user_id" 
        });

      if (upsertError) {
        logStep("Error upserting subscription", { error: upsertError.message, code: upsertError.code });
      } else {
        logStep("Subscription synced to database successfully");
      }
    } else {
      logStep("No active subscription found");
      
      // Delete any existing subscription record
      const { error: deleteError } = await supabaseClient
        .from("subscriptions")
        .delete()
        .eq("user_id", user.id);
        
      if (deleteError) {
        logStep("Error deleting subscription record", { error: deleteError.message });
      }
    }

    return new Response(JSON.stringify({
      subscribed: hasActiveSub,
      tier,
      billing_interval: billingInterval,
      subscription_end: subscriptionEnd
    }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      status: 500,
    });
  }
});
