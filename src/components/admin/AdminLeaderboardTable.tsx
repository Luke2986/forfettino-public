import { Fragment, useState, useEffect } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from "lucide-react";
import { useAdminUserBreakdown } from "@/hooks/useAdminUserBreakdown";
import { useActionConfig } from "@/hooks/useActionConfig";
import type { AdminLeaderboardEntry } from "@/hooks/useAdminLeaderboard";

const PAGE_SIZE = 10;

function BreakdownPanel({ userId }: { userId: string }) {
  const { data: breakdown, isLoading } = useAdminUserBreakdown(userId, true);
  const { data: configs } = useActionConfig();

  if (isLoading) {
    return (
      <div className="flex gap-2 py-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-28 rounded-full" />
        ))}
      </div>
    );
  }

  if (!breakdown || breakdown.length === 0) {
    return (
      <p className="text-sm text-slate-500 py-2">Nessuna azione registrata</p>
    );
  }

  const configMap = new Map(
    (configs ?? []).map((c) => [c.actionType, c]),
  );

  return (
    <div className="flex flex-wrap gap-2 py-2">
      {breakdown.map((entry) => {
        const cfg = configMap.get(entry.actionType as any);
        const label = cfg?.label ?? entry.actionType;
        const bgColor = cfg?.colorBg ?? "bg-slate-200";
        const textColor = cfg?.colorText ?? "text-slate-700";

        return (
          <span
            key={entry.actionType}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${bgColor} ${textColor}`}
          >
            {label}: {entry.totalPoints} pt ({entry.actionCount}&times;)
          </span>
        );
      })}
    </div>
  );
}

interface AdminLeaderboardTableProps {
  entries: AdminLeaderboardEntry[];
}

export function AdminLeaderboardTable({
  entries,
}: AdminLeaderboardTableProps) {
  const [page, setPage] = useState(0);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  // Reset page when entries change (e.g., after query invalidation)
  useEffect(() => {
    setPage(0);
    setExpandedUserId(null);
  }, [entries.length]);

  const totalPages = Math.ceil(entries.length / PAGE_SIZE);
  const pagedEntries = entries.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const headerCellClass = "text-xs font-semibold uppercase tracking-wider text-muted-foreground";

  const toggleExpand = (userId: string) => {
    setExpandedUserId((prev) => (prev === userId ? null : userId));
  };

  return (
    <div>
      <Table>
        <TableCaption className="sr-only">Classifica admin con dettagli utente</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className={`${headerCellClass} w-8`} />
            <TableHead className={headerCellClass}>#</TableHead>
            <TableHead className={`${headerCellClass} hidden sm:table-cell`}>Codice</TableHead>
            <TableHead className={headerCellClass}>Nome</TableHead>
            <TableHead className={`${headerCellClass} text-right`}>Punti</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pagedEntries.map((entry) => {
            const isExpanded = expandedUserId === entry.userId;
            return (
              <Fragment key={entry.userId}>
                <TableRow
                  className="cursor-pointer hover:bg-slate-50"
                  onClick={() => toggleExpand(entry.userId)}
                  data-testid={`leaderboard-row-${entry.userCode}`}
                >
                  <TableCell className="w-8 px-2">
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-slate-500" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-500" />
                    )}
                  </TableCell>
                  <TableCell className="font-bold text-sm tabular-nums">
                    #{entry.rank}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded font-mono">
                      {entry.userCode}
                    </code>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    <span className="block truncate max-w-[120px]">
                      {entry.firstName ?? "\u2014"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums text-sm">
                    {entry.totalPts} pt
                  </TableCell>
                </TableRow>
                {isExpanded && (
                  <TableRow>
                    <TableCell colSpan={5} className="bg-slate-50/50 px-4 py-1">
                      <code className="sm:hidden inline-block text-xs bg-slate-100 px-1.5 py-0.5 rounded font-mono mb-1">
                        {entry.userCode}
                      </code>
                      <BreakdownPanel userId={entry.userId} />
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col items-center sm:flex-row sm:justify-between gap-2 mt-3">
          <span className="text-xs text-muted-foreground">
            {page + 1} / {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Prec.
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >
              Succ.
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
