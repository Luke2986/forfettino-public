import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CalendarIcon, CheckCircle2, AlertTriangle, RefreshCw, Unlink, Loader2 } from "lucide-react";
import { useCalendarConnection } from "@/hooks/useCalendarConnection";
import { formatDistanceToNow, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";

/**
 * Google Calendar connection section.
 * Shows: disconnected (CTA), connected (email + date), denied (retry), loading (skeleton).
 */
interface GoogleCalendarConnectProps {
  /** True when Google returned ?error=access_denied (user denied consent) */
  denied?: boolean;
  /** Callback to trigger manual sync */
  onSync?: () => void;
  /** True while sync is in progress */
  isSyncing?: boolean;
}

export function GoogleCalendarConnect({ denied, onSync, isSyncing }: GoogleCalendarConnectProps) {
  const {
    connection,
    isConnected,
    connectionStatus,
    isLoading,
    error,
    connectGoogle,
    disconnectGoogle,
    isDisconnecting,
    isCallbackLoading,
  } = useCalendarConnection();

  // Loading state during initial fetch or callback processing
  if (isLoading || isCallbackLoading) {
    return (
      <Card className="bg-white rounded-2xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.05),0_0_0_1px_rgba(23,23,23,0.05)] border-0">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-64" />
          </div>
        </div>
      </Card>
    );
  }

  // Connected state (active)
  if (isConnected && connection) {
    const lastSynced = connection.last_synced_at
      ? formatDistanceToNow(parseISO(connection.last_synced_at), { addSuffix: true, locale: it })
      : "mai";

    return (
      <Card className="bg-white rounded-2xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.05),0_0_0_1px_rgba(23,23,23,0.05)] border-0">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">
              Google Calendar collegato
            </p>
            <p className="text-sm text-slate-600 truncate">
              {connection.provider_email}
            </p>
            <p className="text-sm text-slate-500">
              Ultimo aggiornamento: {lastSynced}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onSync && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onSync}
                disabled={isSyncing}
                className="text-slate-600"
                aria-label={isSyncing ? "Aggiornamento in corso" : "Aggiorna calendario"}
              >
                <RefreshCw className={cn("h-4 w-4 mr-1.5", isSyncing && "animate-spin")} aria-hidden="true" />
                {isSyncing ? "Aggiornamento..." : "Aggiorna"}
              </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:bg-red-50"
                  disabled={isDisconnecting}
                >
                  {isDisconnecting ? (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Unlink className="h-4 w-4 mr-1.5" aria-hidden="true" />
                  )}
                  Disconnetti
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Disconnetti Google Calendar?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Sei sicuro? Gli eventi Google verranno rimossi dal calendario.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annulla</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={disconnectGoogle}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Disconnetti
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </Card>
    );
  }

  // Error / revoked state — connection exists but is broken
  if (connection && (connectionStatus === "error" || connectionStatus === "revoked")) {
    return (
      <Card className="bg-amber-50 rounded-2xl p-5 border border-amber-200/60 shadow-none">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800">
              La connessione con Google Calendar non e' piu' attiva.
            </p>
            {connection.provider_email && (
              <p className="text-sm text-slate-600 truncate">
                {connection.provider_email}
              </p>
            )}
          </div>
          <Button
            variant="default"
            size="sm"
            onClick={connectGoogle}
            className="shrink-0"
          >
            <RefreshCw className="h-4 w-4 mr-1.5" aria-hidden="true" />
            Ricollega
          </Button>
        </div>
      </Card>
    );
  }

  // Denial / OAuth error state (from Google redirect)
  if (error || denied) {
    return (
      <Card className="bg-white rounded-2xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.05),0_0_0_1px_rgba(23,23,23,0.05)] border-0">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800">
              Collegamento annullato. Puoi riprovare quando vuoi.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={connectGoogle}
            className="shrink-0"
          >
            Riprova
          </Button>
        </div>
      </Card>
    );
  }

  // Disconnected state — "Coming soon" until Google verifies the app
  return (
    <Card className="bg-white rounded-2xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.05),0_0_0_1px_rgba(23,23,23,0.05)] border-0 opacity-60">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
            <CalendarIcon className="h-5 w-5 text-blue-400" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900">
              Google Calendar
              <span className="ml-2 inline-block text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full align-middle">
                In arrivo
              </span>
            </p>
            <p className="text-sm text-slate-500">
              Presto potrai visualizzare i tuoi appuntamenti insieme alle scadenze fiscali
            </p>
          </div>
        </div>
        <Button
          size="sm"
          disabled
          className="shrink-0 w-full sm:w-auto"
        >
          <CalendarIcon className="h-4 w-4 mr-1.5" aria-hidden="true" />
          Collega Google Calendar
        </Button>
      </div>
    </Card>
  );
}
