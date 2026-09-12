import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type BillingPlan = "monthly" | "yearly" | "month" | "year";

interface UseCheckoutResult {
  checkout: (plan?: BillingPlan) => Promise<void>;
  openPortal: () => Promise<void>;
  isLoading: boolean;
}

export function useCheckout(): UseCheckoutResult {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const checkout = async (plan?: BillingPlan) => {
    setIsLoading(true);
    try {
      const billingInterval = (plan === "monthly" || plan === "month") ? "month" : "year";
      
      const { data, error } = await supabase.functions.invoke("create-checkout-session", {
        body: { billingInterval },
      });

      if (error) throw error;
      if (!data?.url) throw new Error("No checkout URL returned");

      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (error) {
      console.error("Checkout error:", error);
      toast({
        title: "Errore",
        description: "Impossibile aprire il checkout. Riprova più tardi.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const openPortal = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-portal-session");

      if (error) throw error;
      if (!data?.url) throw new Error("No portal URL returned");

      // Redirect to Stripe Customer Portal
      window.location.href = data.url;
    } catch (error) {
      console.error("Portal error:", error);
      toast({
        title: "Errore",
        description: "Impossibile aprire il portale. Riprova più tardi.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return {
    checkout,
    openPortal,
    isLoading,
  };
}
