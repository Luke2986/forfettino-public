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

// Stripe price IDs (LIVE)
const PRICES = {
  month: "price_1SyTc7RYVYMiNd8LLDyzqhIf", // €10/month
  year: "price_1SyTc7RYVYMiNd8LZl5tvzrT",  // €99/year
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
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

    // Create Supabase client to get user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Parse request body
    const { billingInterval, windowId } = await req.json();
    const interval = billingInterval === "month" ? "month" : "year";
    const priceId = PRICES[interval];
    logStep("Selected price", { interval, priceId, windowId: windowId || "none" });

    // Initialize Stripe
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // --- Launch Window Pre-Validation ---
    // RLS allows authenticated users to SELECT active windows — no service_role needed
    const { data: activeWindows } = await supabaseClient
      .from("launch_windows")
      .select("id, cap_remaining, is_active, starts_at, ends_at")
      .eq("is_active", true)
      .lte("starts_at", new Date().toISOString())
      .gte("ends_at", new Date().toISOString());

    const hasActiveWindow = activeWindows && activeWindows.length > 0;

    if (hasActiveWindow && !windowId) {
      // SECURITY: active window exists but no windowId provided — reject (prevents cap bypass)
      logStep("SECURITY: Active window exists but windowId not provided, rejecting");
      return new Response(JSON.stringify({ error: "window_id_required" }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        status: 400,
      });
    }

    if (windowId) {
      // Validate the specific window
      const targetWindow = activeWindows?.find((w: any) => w.id === windowId);
      if (!targetWindow || targetWindow.cap_remaining <= 0) {
        logStep("Window unavailable", { windowId, found: !!targetWindow, capRemaining: targetWindow?.cap_remaining });
        return new Response(JSON.stringify({ error: "window_unavailable" }), {
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
          status: 409,
        });
      }
      logStep("Window validated", { windowId, capRemaining: targetWindow.cap_remaining });
    }

    // Check if customer already exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });
    } else {
      logStep("No existing customer, will create new one");
    }

    // Create checkout session
    const origin = req.headers.get("origin") || "https://forfettino.lovable.app";
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      allow_promotion_codes: true,
      success_url: `${origin}/impostazioni?success=true`,
      cancel_url: `${origin}/impostazioni?canceled=true`,
      metadata: {
        user_id: user.id,
        ...(windowId ? { window_id: windowId } : {}),
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          ...(windowId ? { window_id: windowId } : {}),
        },
      },
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ url: session.url }), {
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
