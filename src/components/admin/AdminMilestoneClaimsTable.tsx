import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Gift, Check, Loader2 } from "lucide-react";
import {
  useAdminMilestoneAchievers,
  useAdminClaimMilestone,
  type MilestoneAchiever,
} from "@/hooks/useAdminMilestones";
import { useToast } from "@/hooks/use-toast";

const PAGE_SIZE = 10;

export function AdminMilestoneClaimsTable() {
  const { data: achievers, isLoading } = useAdminMilestoneAchievers();
  const claimMutation = useAdminClaimMilestone();
  const { toast } = useToast();
  const [page, setPage] = useState(0);

  // Reset page when data changes; also clamp page to valid range
  useEffect(() => {
    setPage(0);
  }, [achievers]);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-8 bg-slate-100 rounded" />
        ))}
      </div>
    );
  }

  if (!achievers || achievers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        Nessun utente ha ancora raggiunto un traguardo.
      </p>
    );
  }

  const totalPages = Math.ceil(achievers.length / PAGE_SIZE);
  const safePage = Math.min(page, Math.max(0, totalPages - 1));
  const pagedAchievers = achievers.slice(
    safePage * PAGE_SIZE,
    (safePage + 1) * PAGE_SIZE,
  );
  const headerCellClass =
    "text-xs font-semibold uppercase tracking-wider text-muted-foreground";

  const handleClaim = (achiever: MilestoneAchiever) => {
    claimMutation.mutate(
      {
        userId: achiever.userId,
        milestoneId: achiever.milestoneId,
        notes: `Premio "${achiever.rewardLabel}" consegnato da admin`,
      },
      {
        onSuccess: () =>
          toast({ title: `Premio consegnato a ${achiever.userCode}` }),
        onError: (err: Error) =>
          toast({
            title: "Errore",
            description: err.message ?? "Impossibile consegnare il premio",
            variant: "destructive",
          }),
      },
    );
  };

  return (
    <div>
      <Table>
        <TableCaption className="sr-only">Richieste premi traguardi</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className={headerCellClass}>Codice</TableHead>
            <TableHead className={headerCellClass}>Nome</TableHead>
            <TableHead className={`${headerCellClass} text-right`}>Punti</TableHead>
            <TableHead className={headerCellClass}>Traguardo</TableHead>
            <TableHead className={headerCellClass}>Premio</TableHead>
            <TableHead className={`${headerCellClass} text-right`}>Stato</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pagedAchievers.map((a) => (
            <TableRow key={`${a.userId}-${a.milestoneId}`}>
              <TableCell>
                <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded font-mono">
                  {a.userCode}
                </code>
              </TableCell>
              <TableCell className="text-sm text-slate-600">
                {a.firstName ?? "—"}
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums text-sm">
                {a.totalPts} pt
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="text-xs h-5">
                  Lv{a.milestoneLevel} — {a.milestoneName}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-slate-600">
                {a.rewardLabel}
              </TableCell>
              <TableCell className="text-right">
                {a.rewardClaimed ? (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                    <Check className="h-3.5 w-3.5" />
                    Consegnato
                  </span>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => handleClaim(a)}
                    disabled={claimMutation.isPending}
                  >
                    {claimMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Gift className="h-3 w-3 text-violet-500" />
                    )}
                    Consegna
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
            aria-label={`Pagina precedente (pagina ${safePage + 1} di ${totalPages})`}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Prec.
          </Button>
          <span className="text-xs text-muted-foreground">
            {safePage + 1} / {totalPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={safePage >= totalPages - 1}
            aria-label={`Pagina successiva (pagina ${safePage + 2} di ${totalPages})`}
          >
            Succ.
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
