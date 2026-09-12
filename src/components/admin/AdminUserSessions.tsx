import { useState, useEffect } from "react";
import { Activity, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import type { UserSessionData } from "@/hooks/useAdminStats";

const PAGE_SIZE = 10;

interface AdminUserSessionsProps {
  data: UserSessionData[];
  internalUserCodes?: Set<string>;
  showInternal?: boolean;
}

export function AdminUserSessions({ data, internalUserCodes, showInternal = false }: AdminUserSessionsProps) {
  const [currentPage, setCurrentPage] = useState(1);

  const filteredData = showInternal || !internalUserCodes
    ? data
    : data.filter((row) => !internalUserCodes.has(row.userCode));

  useEffect(() => {
    setCurrentPage(1);
  }, [filteredData.length]);

  if (filteredData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Attività Utenti
          </CardTitle>
          <CardDescription>Sessioni per codice utente</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Activity className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              Nessuna sessione registrata
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalItems = filteredData.length;
  const totalPages = Math.ceil(totalItems / PAGE_SIZE);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, totalItems);
  const paginatedData = filteredData.slice(startIndex, endIndex);
  const isFirstPage = currentPage === 1;
  const isLastPage = currentPage === totalPages;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Attività Utenti
        </CardTitle>
        <CardDescription>
          Sessioni per codice utente — ultimi 30 giorni, ordinati per attività
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Codice Utente</TableHead>
              <TableHead className="text-right">Oggi</TableHead>
              <TableHead className="text-right">7gg</TableHead>
              <TableHead className="text-right">30gg</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.map((row) => (
              <TableRow key={row.userCode}>
                <TableCell className="font-mono text-xs tracking-wider">
                  {row.userCode}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.today}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.week}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.month}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      {totalPages > 1 && (
        <CardFooter className="flex items-center justify-between border-t border-border px-6 py-4">
          <p className="text-sm text-muted-foreground">
            Mostra {startIndex + 1} – {endIndex} di {totalItems} risultati
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={isFirstPage}
            >
              <ChevronLeft className="h-4 w-4" />
              Precedente
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={isLastPage}
            >
              Successivo
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}
