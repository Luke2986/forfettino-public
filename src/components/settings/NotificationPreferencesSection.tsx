import { Bell } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotificationPreferences } from "@/hooks/useNotificationPreferences";
import { useUpdateNotificationPreference } from "@/hooks/useUpdateNotificationPreference";

export function NotificationPreferencesSection() {
  const { data: preferences, isLoading } = useNotificationPreferences();
  const { mutate: updatePreference, isPending } = useUpdateNotificationPreference();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent className="space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="space-y-1">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-48" />
              </div>
              <Skeleton className="h-6 w-11 rounded-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const prefs = preferences ?? { scadenze: true, insights: true, aggiornamenti: false };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Preferenze Notifiche
        </CardTitle>
        <CardDescription>
          Gestisci le notifiche che ricevi nell'app
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Scadenze fiscali */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label>Scadenze fiscali</Label>
            <p className="text-sm text-muted-foreground">
              Avvisi sulle scadenze imminenti
            </p>
          </div>
          <Switch
            checked={prefs.scadenze}
            disabled={isPending}
            aria-label="Scadenze fiscali"
            onCheckedChange={(val) => updatePreference({ category: "scadenze", enabled: val })}
          />
        </div>

        <Separator />

        {/* Insights */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label>Insights</Label>
            <p className="text-sm text-muted-foreground">
              Riepilogo incassi e suggerimenti
            </p>
          </div>
          <Switch
            checked={prefs.insights}
            disabled={isPending}
            aria-label="Insights"
            onCheckedChange={(val) => updatePreference({ category: "insights", enabled: val })}
          />
        </div>

        <Separator />

        {/* Aggiornamenti prodotto */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label>Aggiornamenti prodotto</Label>
            <p className="text-sm text-muted-foreground">
              Novità e miglioramenti dell'app
            </p>
          </div>
          <Switch
            checked={prefs.aggiornamenti}
            disabled={isPending}
            aria-label="Aggiornamenti prodotto"
            onCheckedChange={(val) => updatePreference({ category: "aggiornamenti", enabled: val })}
          />
        </div>
      </CardContent>
    </Card>
  );
}
