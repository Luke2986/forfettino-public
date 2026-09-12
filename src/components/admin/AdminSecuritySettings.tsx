import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Shield } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface AppSettings {
  device_trust_enabled: boolean;
  otp_threshold_days: number;
}

export function AdminSecuritySettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [thresholdInput, setThresholdInput] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["app-settings"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("app_settings")
        .select("device_trust_enabled, otp_threshold_days")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? { device_trust_enabled: true, otp_threshold_days: 14 }) as AppSettings;
    },
  });

  // Sync input con dati DB quando caricati
  useEffect(() => {
    if (data?.otp_threshold_days != null) {
      setThresholdInput(String(data.otp_threshold_days));
    }
  }, [data?.otp_threshold_days]);

  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await (supabase as any)
        .from("app_settings")
        .update({ device_trust_enabled: enabled })
        .eq("id", 1);
      if (error) throw error;
    },
    onSuccess: (_data, enabled) => {
      queryClient.setQueryData(["app-settings"], (old: AppSettings | undefined) => ({
        ...old,
        device_trust_enabled: enabled,
      }));
      toast({
        title: enabled ? "Device Trust attivato" : "Device Trust disattivato",
        description: enabled
          ? "Gli utenti potranno saltare l'OTP su dispositivi fidati."
          : "Tutti gli utenti dovranno verificare l'OTP dopo inattivita'.",
      });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Impossibile aggiornare l'impostazione.",
        variant: "destructive",
      });
    },
  });

  const thresholdMutation = useMutation({
    mutationFn: async (days: number) => {
      const { error } = await (supabase as any)
        .from("app_settings")
        .update({ otp_threshold_days: days })
        .eq("id", 1);
      if (error) throw error;
    },
    onSuccess: (_data, days) => {
      queryClient.setQueryData(["app-settings"], (old: AppSettings | undefined) => ({
        ...old,
        otp_threshold_days: days,
      }));
      toast({
        title: "Soglia OTP aggiornata",
        description: `Soglia OTP aggiornata a ${days} giorni`,
      });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Impossibile aggiornare la soglia OTP.",
        variant: "destructive",
      });
    },
  });

  const parsedThreshold = parseInt(thresholdInput, 10);
  const isThresholdValid = !isNaN(parsedThreshold) && parsedThreshold >= 1 && parsedThreshold <= 90;
  const hasThresholdChanged = isThresholdValid && parsedThreshold !== data?.otp_threshold_days;

  const handleSaveThreshold = () => {
    if (isThresholdValid && hasThresholdChanged) {
      thresholdMutation.mutate(parsedThreshold);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="h-5 w-5 text-slate-500" />
          Sicurezza
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-6 w-48" />
          </div>
        ) : (
          <div className="space-y-4">
            {isError && (
              <p className="text-sm text-destructive">
                Impossibile caricare le impostazioni. I valori mostrati sono predefiniti.
              </p>
            )}
            {/* Device Trust Toggle */}
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="device-trust-toggle" className="text-sm font-medium">
                  Device Trust
                </Label>
                <p className="text-sm text-muted-foreground">
                  Consenti di saltare l'OTP su dispositivi gia' verificati (30 giorni)
                </p>
              </div>
              <Switch
                id="device-trust-toggle"
                checked={data?.device_trust_enabled ?? true}
                onCheckedChange={(checked) => toggleMutation.mutate(checked)}
                disabled={toggleMutation.isPending}
              />
            </div>

            <Separator />

            {/* OTP Threshold Input */}
            <div className="space-y-2">
              <Label htmlFor="otp-threshold-input" className="text-sm font-medium">
                Soglia inattivita' OTP (giorni)
              </Label>
              <p className="text-sm text-muted-foreground">
                Dopo quanti giorni di inattivita' richiedere la verifica OTP (1-90)
              </p>
              <div className="flex items-center gap-2">
                <Input
                  id="otp-threshold-input"
                  type="number"
                  min={1}
                  max={90}
                  step={1}
                  value={thresholdInput}
                  onChange={(e) => setThresholdInput(e.target.value)}
                  className="w-24"
                />
                <Button
                  size="sm"
                  onClick={handleSaveThreshold}
                  disabled={!hasThresholdChanged || thresholdMutation.isPending}
                >
                  Salva
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
