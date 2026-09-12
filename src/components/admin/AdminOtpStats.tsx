import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminStatCard } from "./AdminStatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { KeyRound, ShieldCheck, Clock, CalendarCheck } from "lucide-react";

interface OtpStats {
  total_users: number;
  users_with_otp: number;
  users_needing_otp: number;
  verified_last_30d: number;
  last_otp_verified: string | null;
}

function formatRelativeTime(isoDate: string | null): string {
  if (!isoDate) return "—";
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "adesso";
  if (minutes < 60) return `${minutes}m fa`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h fa`;
  const days = Math.floor(hours / 24);
  return `${days}gg fa`;
}

export function AdminOtpStats() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-otp-stats"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_otp_stats");
      if (error) throw error;
      return data as OtpStats;
    },
    staleTime: 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-indigo-600" />
          <h2 className="text-lg font-semibold">Statistiche OTP</h2>
        </div>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-7 w-16" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-indigo-600" />
          <h2 className="text-lg font-semibold">Statistiche OTP</h2>
        </div>
        <p className="text-sm text-destructive">Impossibile caricare le statistiche OTP.</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <KeyRound className="h-5 w-5 text-indigo-600" />
        <h2 className="text-lg font-semibold">Statistiche OTP</h2>
      </div>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <AdminStatCard
          icon={<ShieldCheck className="h-5 w-5 text-indigo-500" />}
          label="Verificati OTP"
          value={`${data.users_with_otp}/${data.total_users}`}
          subLabel="utenti con almeno 1 verifica"
          iconClassName="bg-indigo-500/10"
        />
        <AdminStatCard
          icon={<Clock className="h-5 w-5 text-amber-500" />}
          label="Richiedono OTP (stima)"
          value={data.users_needing_otp}
          subLabel="Include utenti OAuth-only"
          iconClassName="bg-amber-500/10"
        />
        <AdminStatCard
          icon={<CalendarCheck className="h-5 w-5 text-teal-500" />}
          label="Verificati ultimi 30gg"
          value={data.verified_last_30d}
          subLabel="proxy device trust"
          iconClassName="bg-teal-500/10"
        />
        <AdminStatCard
          icon={<KeyRound className="h-5 w-5 text-slate-500" />}
          label="Ultima verifica"
          value={formatRelativeTime(data.last_otp_verified)}
          subLabel="timestamp piu' recente"
          iconClassName="bg-slate-500/10"
        />
      </div>
    </div>
  );
}
