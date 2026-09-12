import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, AlertCircle, Download, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

type Status = "loading" | "success" | "error";
type LeadMagnet = "guida_protezione" | "scadenziario_2026" | "simulatore_acconti_2026" | null;

const VALID_LEAD_MAGNETS: string[] = ["guida_protezione", "scadenziario_2026", "simulatore_acconti_2026"];

function parseLeadMagnet(raw: string | null): LeadMagnet {
  if (raw && VALID_LEAD_MAGNETS.includes(raw)) return raw as LeadMagnet;
  return null;
}

export default function ConfermaEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const lm = parseLeadMagnet(searchParams.get("lm"));

  const [status, setStatus] = useState<Status>("loading");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      return;
    }

    (async () => {
      const { data, error } = await supabase.rpc("confirm_newsletter_subscription", {
        p_token: token,
      });

      if (error || !(data as any)?.success) {
        setStatus("error");
        return;
      }

      setStatus("success");
    })();
  }, [token]);

  function handleDownloadGuida() {
    // Track event
    try {
      if (typeof window !== "undefined" && (window as any).posthog) {
        (window as any).posthog.capture("lead_magnet_downloaded", {
          magnet: "guida_protezione",
          source: "conferma_email",
        });
      }
    } catch {
      // analytics non-blocking
    }
  }

  function handleDownloadSimulatore() {
    // Track event
    try {
      if (typeof window !== "undefined" && (window as any).posthog) {
        (window as any).posthog.capture("lead_magnet_downloaded", {
          magnet: "simulatore_acconti_2026",
          source: "conferma_email",
        });
      }
    } catch {
      // analytics non-blocking
    }
  }

  async function handleDownloadScadenziario() {
    setPdfLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-scadenzario-pdf", {
        body: {},
      });

      if (error || !data?.pdf_base64) {
        console.error("PDF generation failed:", error);
        setPdfError(true);
        setPdfLoading(false);
        return;
      }
      setPdfError(false);

      // Track event
      try {
        if (typeof window !== "undefined" && (window as any).posthog) {
          (window as any).posthog.capture("lead_magnet_generated", {
            magnet: "scadenziario_2026",
            source: "conferma_email",
          });
        }
      } catch {
        // analytics non-blocking
      }

      // Convert base64 to blob and trigger download
      const binaryStr = atob(data.pdf_base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename || "scadenziario-forfettario-2026.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download error:", err);
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <>
      <Helmet>
        <title>Conferma Email | Forfettino</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-100/80 to-slate-200/60 flex flex-col items-center justify-center p-4">
        {/* Logo */}
        <div className="mb-8">
          <span className="font-display font-bold text-2xl text-teal-700">Forfettino</span>
        </div>

        <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.08)] border border-slate-200/60 max-w-md w-full p-8 text-center">
          {/* Loading */}
          {status === "loading" && (
            <div className="space-y-4">
              <Loader2 className="h-10 w-10 animate-spin text-teal-600 mx-auto" />
              <p className="text-sm text-slate-600">Conferma in corso...</p>
            </div>
          )}

          {/* Success */}
          {status === "success" && (
            <div className="space-y-5">
              <CheckCircle2 className="h-12 w-12 text-teal-600 mx-auto" />
              <h1 className="text-2xl font-bold text-slate-900">Email confermata!</h1>

              {lm === "guida_protezione" && (
                <div className="space-y-3">
                  <p className="text-sm text-slate-600">
                    La tua iscrizione e' confermata. Scarica subito la guida gratuita.
                  </p>
                  <Button asChild className="w-full" onClick={handleDownloadGuida}>
                    <a
                      href="/guide/guida-protezione-freelancer.pdf"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Scarica la Guida Protezione Freelancer
                    </a>
                  </Button>
                </div>
              )}

              {lm === "scadenziario_2026" && (
                <div className="space-y-3">
                  <p className="text-sm text-slate-600">
                    La tua iscrizione e' confermata. Genera e scarica lo scadenziario.
                  </p>
                  <Button
                    className="w-full"
                    onClick={handleDownloadScadenziario}
                    disabled={pdfLoading}
                  >
                    {pdfLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generazione in corso...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        Scarica lo Scadenziario Forfettario 2026
                      </>
                    )}
                  </Button>
                  {pdfError && (
                    <p className="text-sm text-red-600">
                      Errore nella generazione del PDF. Riprova tra qualche istante.
                    </p>
                  )}
                </div>
              )}

              {lm === "simulatore_acconti_2026" && (
                <div className="space-y-3">
                  <p className="text-sm text-slate-600">
                    La tua iscrizione e' confermata. Scarica subito il simulatore in Excel.
                  </p>
                  <Button asChild className="w-full" onClick={handleDownloadSimulatore}>
                    <a
                      href="/guide/forfettino-simulatore-acconti-2026.xlsx"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Scarica il Simulatore Acconti 2026 (Excel)
                    </a>
                  </Button>
                </div>
              )}

              {!lm && (
                <p className="text-sm text-slate-600">
                  Iscrizione confermata! Ti contatteremo presto.
                </p>
              )}
            </div>
          )}

          {/* Error */}
          {status === "error" && (
            <div className="space-y-5">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
              <h1 className="text-2xl font-bold text-slate-900">Link non valido o scaduto</h1>
              <p className="text-sm text-slate-600">
                Il link di conferma non e' valido o e' scaduto. Richiedi una nuova iscrizione.
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link to="/">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Torna alla home
                </Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
