// Story 84-5: Edge Function `resend-webhook` — receiver eventi ciclo di vita email da Resend.
//
// Blueprint: stripe-webhook (endpoint PUBBLICO, nessun CORS / nessuna Authorization — il provider
// chiama direttamente, non il browser). La sicurezza è SOLO la firma (qui Svix, non Stripe).
// Flusso: raw body → verifica firma Svix → parse difensivo → insert idempotente in email_events
// (ON CONFLICT svix_id DO NOTHING) → best-effort update email_log.status (delivered/bounced) → 200.
//
// Eventi SMTP (sent/delivered/delivery_delayed/bounced/complained/failed) arrivano SUBITO,
// indipendenti dal toggle dominio. opened/clicked sono gestiti ma NON attesi al lancio (84-1/84-7).

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Webhook } from "https://esm.sh/svix@1.24.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4?target=denonext";
import {
  parseResendEvent,
  emailLogStatusForEvent,
} from "../_shared/resend-webhook-logic.ts";

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[RESEND-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  // Webhook: nessun CORS/Authorization — Resend chiama direttamente.
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200 });
  }

  // ── Firma Svix: leggere il RAW body PRIMA del parse (la verifica è sui byte esatti) ──
  const webhookSecret = Deno.env.get("RESEND_WEBHOOK_SECRET");
  if (!webhookSecret) {
    // Configurazione mancante: log + 500 (Resend ritenta dopo che il deploy fissa il secret).
    logStep("ERROR: RESEND_WEBHOOK_SECRET not set");
    return new Response(JSON.stringify({ error: "Webhook secret not configured" }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }

  const svixId = req.headers.get("svix-id") ?? "";
  const raw = await req.text();

  let evt: unknown;
  try {
    const wh = new Webhook(webhookSecret);
    // verify valida firma + finestra anti-replay; ritorna il payload parsato.
    evt = wh.verify(raw, {
      "svix-id": svixId,
      "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
      "svix-signature": req.headers.get("svix-signature") ?? "",
    });
  } catch (err) {
    // Firma assente/invalida ⇒ 400. Errore client PERMANENTE → Resend NON ritenta (no loop).
    const msg = err instanceof Error ? err.message : String(err);
    logStep("Signature verification failed", { error: msg });
    return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400 });
  }

  try {
    const parsed = parseResendEvent(evt);
    logStep("Event verified", { type: parsed.eventType, svixId, emailId: parsed.emailId });

    // Service-role client: scrive bypassando RLS.
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // ── 1. Insert idempotente in email_events (ON CONFLICT svix_id DO NOTHING) ──
    // raw_payload = payload integrale (audit/debug; PII → retention 6 mesi, cleanup 84-8).
    const { error: insertErr } = await supabase
      .from("email_events")
      .upsert(
        {
          svix_id: svixId,
          event_type: parsed.eventType,
          recipient_email: parsed.recipient,
          user_id: parsed.userId, // null-safe (solo UUID valido, altrimenti null — §user_id)
          resend_message_id: parsed.emailId,
          clicked_url: parsed.clickedUrl,
          bounce_type: parsed.bounceType,
          occurred_at: parsed.occurredAt ?? new Date().toISOString(),
          raw_payload: evt,
        },
        { onConflict: "svix_id", ignoreDuplicates: true },
      );

    if (insertErr) {
      // Errore DB (probabilmente transitorio) → 500 → Resend ritenta → recuperiamo l'evento.
      logStep("ERROR inserting email_event", { error: insertErr.message, svixId });
      return new Response(JSON.stringify({ error: "DB insert failed" }), {
        headers: { "Content-Type": "application/json" },
        status: 500,
      });
    }

    // ── 2. Best-effort update email_log.status (solo delivered/bounced; no-downgrade) ──
    const targetStatus = emailLogStatusForEvent(parsed.eventType);
    if (targetStatus && parsed.emailId) {
      // No-downgrade (UPDATE allo stesso stato = innocuo/idempotente):
      //  - 'delivered' sovrascrive solo 'sent' (non riporta indietro 'bounced'/'failed');
      //  - 'bounced'   sovrascrive 'sent'/'delivered' (un bounce è terminale, vince sul delivered);
      //  - 'failed'    sovrascrive solo 'sent' (fallimento Resend post-invio; non tocca delivered/bounced).
      const allowedPrev =
        targetStatus === "bounced" ? ["sent", "delivered"] : ["sent"];

      const updatePayload: Record<string, unknown> = { status: targetStatus };
      if (targetStatus === "bounced") {
        const reason = parsed.bounceType ? `bounce: ${parsed.bounceType}` : "bounced";
        updatePayload.error_message = reason;
      } else if (targetStatus === "failed") {
        updatePayload.error_message = "failed (resend webhook)";
      }

      const { error: updateErr } = await supabase
        .from("email_log")
        .update(updatePayload)
        .eq("resend_message_id", parsed.emailId)
        .in("status", allowedPrev);

      // Best-effort: nessun match (riga assente / email non-scadenza / race) ⇒ log e prosegui.
      if (updateErr) {
        logStep("WARN email_log update failed (best-effort)", {
          error: updateErr.message,
          emailId: parsed.emailId,
        });
      }
    }

    // ── 3. Switch sugli event type (osservabilità; il lavoro DB è già fatto sopra) ──
    switch (parsed.eventType) {
      case "email.sent":
      case "email.delivered":
      case "email.delivery_delayed":
      case "email.bounced":
      case "email.complained":
      case "email.failed":
      case "email.opened":
      case "email.clicked":
        logStep("Event processed", { type: parsed.eventType });
        break;
      default:
        // Event type sconosciuto: già registrato in email_events, log + ignora.
        logStep("Unhandled event type, recorded + ignored", { type: parsed.eventType });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    // Errore inatteso dopo la verifica firma. La logica di parse è difensiva (non lancia), quindi
    // qui finiscono solo errori runtime/DB → 500 → Resend ritenta (recuperabile). Un payload
    // permanentemente non processabile NON arriva qui (parse → null, insert comunque valido).
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
