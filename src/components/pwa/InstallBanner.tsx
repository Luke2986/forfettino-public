import { useState, useEffect, useRef } from "react";
import { X, Download } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const DISMISS_KEY = "pwa_install_dismissed";
const DISMISS_DAYS = 30;

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallBanner() {
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Never show in standalone mode (already installed)
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    // Never show on desktop — only mobile
    if (!("ontouchstart" in window) && !navigator.maxTouchPoints) return;

    // Check 30-day dismiss cooldown
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed) {
      try {
        const ts = JSON.parse(dismissed).timestamp;
        if (Date.now() - ts < DISMISS_DAYS * 24 * 60 * 60 * 1000) return;
      } catch {
        // Corrupted value — ignore and proceed
      }
    }

    const handler = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      deferredPrompt.current = e;
      setShowBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt.current) return;
    deferredPrompt.current.prompt();
    const { outcome } = await deferredPrompt.current.userChoice;
    if (outcome === "accepted") {
      deferredPrompt.current = null;
      setShowBanner(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(
      DISMISS_KEY,
      JSON.stringify({ timestamp: Date.now() })
    );
    setShowBanner(false);
  };

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed bottom-0 left-0 right-0 z-50 mx-4 mb-4"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.08)] p-4 flex items-center gap-3">
            <Download className="h-5 w-5 text-teal-600 shrink-0" />
            <p className="text-sm text-slate-700 flex-1">
              Installa Forfettino sulla tua Home
            </p>
            <button
              onClick={handleInstall}
              className="bg-teal-600 text-white text-sm font-medium rounded-lg px-4 py-2 shrink-0 hover:bg-teal-700 transition-colors"
            >
              Installa
            </button>
            <button
              onClick={handleDismiss}
              className="text-slate-500 hover:text-slate-700 transition-colors shrink-0"
              aria-label="Chiudi banner installazione"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
