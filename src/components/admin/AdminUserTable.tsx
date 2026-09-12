import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { MoreHorizontal, ChevronLeft, ChevronRight, MessageCircle, ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2, XCircle, Download, Check, Search } from "lucide-react";
import type { OverrideTier } from "@/types/subscription";
import { formatDistanceToNow } from "date-fns";
import { AdminUserMessagesDialog } from "./AdminUserMessagesDialog";
import { csvSafe, downloadCsv } from "@/lib/csv-export";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableCaption,
} from "@/components/ui/table";

export interface AdminUser {
  id: string;
  userCode: string;
  firstName: string;
  lastName: string;
  tier: string;
  status: string | null;
  cancelAtPeriodEnd: boolean;
  billingInterval: string | null;
  createdAt: string;
  isInternal?: boolean;
  receiptCount: number;
  onboardingCompleted: boolean;
  lastSeenAt: string | null;
  adminOverrideTier: 'pro' | 'beta_tester' | null;
  gestione: string | null;
}

type SortField = "userCode" | "receiptCount" | "createdAt" | "lastSeenAt";
type SortDirection = "asc" | "desc";
type SortState = { field: SortField; direction: SortDirection } | null;

type PlanFilter = "all" | "free" | "beta_tester" | "pro";

function getPlanCategory(user: AdminUser): "free" | "beta_tester" | "pro" {
  if (user.tier === "pro" && (user.status === "active" || user.status === "trialing")) {
    return "pro";
  }
  if (user.tier === "studio") return "pro";
  if (user.adminOverrideTier === "pro") return "pro";
  if (user.adminOverrideTier === "beta_tester") return "beta_tester";
  return "free";
}

function SortIcon({ field, sortState }: { field: SortField; sortState: SortState }) {
  if (sortState?.field !== field) {
    return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
  }
  return sortState.direction === "asc"
    ? <ArrowUp className="h-3 w-3 ml-1" />
    : <ArrowDown className="h-3 w-3 ml-1" />;
}

interface AdminUserTableProps {
  users: AdminUser[];
  showInternal?: boolean;
  onOverrideChange?: (userId: string, newTier: OverrideTier | null) => void;
}

const PAGE_SIZE = 10;

function getTierBadge(tier: string, status: string | null, cancelAtPeriodEnd: boolean, adminOverrideTier: 'pro' | 'beta_tester' | null) {
  // Stripe Pro attivo (active/trialing) prevale sempre sull'override
  if (tier === "pro" && (status === "active" || status === "trialing")) {
    if (cancelAtPeriodEnd) {
      return <Badge variant="secondary">Pro (cancella)</Badge>;
    }
    if (status === "trialing") {
      return <Badge variant="secondary">Pro (trial)</Badge>;
    }
    return <Badge variant="default">Pro</Badge>;
  }
  if (tier === "studio") {
    return (
      <Badge variant="default" className="bg-accent text-accent-foreground hover:bg-accent/80">
        Studio
      </Badge>
    );
  }
  // Override badges (Stripe non attivo — canceled/expired/assente)
  if (adminOverrideTier === "pro") {
    return (
      <Badge variant="default" className="bg-teal-600 hover:bg-teal-600/80 text-white">
        Pro (regalo)
      </Badge>
    );
  }
  if (adminOverrideTier === "beta_tester") {
    return (
      <Badge variant="default" className="bg-violet-600 hover:bg-violet-600/80 text-white">
        Beta Tester
      </Badge>
    );
  }
  return <Badge variant="outline">Free</Badge>;
}

function getDisplayName(firstName: string, lastName: string) {
  if (firstName && lastName) {
    return `${firstName} ${lastName.charAt(0)}.`;
  }
  if (firstName) {
    return firstName;
  }
  if (lastName) {
    return `${lastName.charAt(0)}.`;
  }
  return "—";
}

function safeParseDate(dateStr: string): Date {
  if (dateStr.includes("T")) {
    return new Date(dateStr);
  }
  return new Date(dateStr + "T00:00:00");
}

function getTierLabel(tier: string, status: string | null, cancelAtPeriodEnd: boolean, adminOverrideTier: 'pro' | 'beta_tester' | null): string {
  if (tier === "pro" && (status === "active" || status === "trialing")) {
    if (cancelAtPeriodEnd) return "pro (cancella)";
    if (status === "trialing") return "pro (trial)";
    return "pro";
  }
  if (tier === "studio") return "studio";
  if (adminOverrideTier === "pro") return "pro (regalo)";
  if (adminOverrideTier === "beta_tester") return "beta_tester";
  return "free";
}

function exportUsersCsv(users: AdminUser[]) {
  const header = "id,nome,piano,gestione,onboarding,incassi,ultimo_accesso,registrazione";
  const rows = users.map((u) => {
    const name = csvSafe(getDisplayName(u.firstName, u.lastName));
    const piano = getTierLabel(u.tier, u.status, u.cancelAtPeriodEnd, u.adminOverrideTier);
    const gestione = u.gestione || "";
    const onboarding = u.onboardingCompleted ? "si" : "no";
    const lastSeen = u.lastSeenAt
      ? format(safeParseDate(u.lastSeenAt), "dd/MM/yyyy", { locale: it })
      : "";
    const reg = format(safeParseDate(u.createdAt), "dd/MM/yyyy", { locale: it });
    return `${u.userCode},${name},${piano},${gestione},${onboarding},${u.receiptCount},${lastSeen},${reg}`;
  });
  const now = new Date();
  const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const filename = `utenti_${localDate}.csv`;
  downloadCsv(header, rows, filename);
}

const headerCellClass = "text-xs font-semibold uppercase tracking-wider text-muted-foreground";

export function AdminUserTable({ users, showInternal = false, onOverrideChange }: AdminUserTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [messagesUser, setMessagesUser] = useState<AdminUser | null>(null);
  const [sortState, setSortState] = useState<SortState>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [planFilter, setPlanFilter] = useState<PlanFilter>("all");

  const baseFilteredUsers = useMemo(() => {
    let list = showInternal ? users : users.filter((u) => !u.isInternal);
    // Escludi utenti che non hanno completato l'onboarding (i loro 0 incassi inquinano i dati)
    list = list.filter((u) => u.onboardingCompleted);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (u) =>
          u.userCode.toLowerCase().includes(q) ||
          u.firstName.toLowerCase().includes(q) ||
          u.lastName.toLowerCase().includes(q)
      );
    }
    return list;
  }, [users, showInternal, searchQuery]);

  const planCounts = useMemo(() => {
    const counts = { all: baseFilteredUsers.length, free: 0, beta_tester: 0, pro: 0 };
    for (const u of baseFilteredUsers) {
      counts[getPlanCategory(u)]++;
    }
    return counts;
  }, [baseFilteredUsers]);

  const filteredUsers = useMemo(() => {
    if (planFilter === "all") return baseFilteredUsers;
    return baseFilteredUsers.filter((u) => getPlanCategory(u) === planFilter);
  }, [baseFilteredUsers, planFilter]);

  const sortedUsers = useMemo(() => {
    if (!sortState) return filteredUsers;
    const { field, direction } = sortState;
    return [...filteredUsers].sort((a, b) => {
      let cmp = 0;
      switch (field) {
        case "userCode":
          cmp = a.userCode.localeCompare(b.userCode);
          break;
        case "receiptCount":
          cmp = a.receiptCount - b.receiptCount;
          break;
        case "createdAt":
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case "lastSeenAt":
          // null = mai visto → in fondo (valore minimo)
          cmp = (a.lastSeenAt || "0").localeCompare(b.lastSeenAt || "0");
          break;
      }
      return direction === "desc" ? -cmp : cmp;
    });
  }, [filteredUsers, sortState]);

  function handleSort(field: SortField) {
    setSortState((prev) => {
      if (prev?.field !== field) return { field, direction: "asc" };
      if (prev.direction === "asc") return { field, direction: "desc" };
      return null;
    });
    setCurrentPage(1);
  }

  useEffect(() => {
    setCurrentPage(1);
  }, [filteredUsers.length]);

  const hasActiveFilters = searchQuery.trim() !== "" || planFilter !== "all";
  if (baseFilteredUsers.length === 0 && !hasActiveFilters) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold tracking-tight">Lista Utenti</CardTitle>
          <CardDescription>Nessun utente registrato</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const totalItems = sortedUsers.length;
  const totalPages = Math.ceil(totalItems / PAGE_SIZE);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, totalItems);
  const paginatedUsers = sortedUsers.slice(startIndex, endIndex);
  const isFirstPage = currentPage === 1;
  const isLastPage = currentPage === totalPages;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-lg font-semibold tracking-tight">Lista Utenti</CardTitle>
            <CardDescription>{totalItems} utenti{searchQuery.trim() || planFilter !== "all" ? " trovati" : " registrati"}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cerca codice o nome…"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-8 h-9 w-[200px]"
              />
            </div>
            {filteredUsers.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportUsersCsv(filteredUsers)}
              >
                <Download className="h-4 w-4 mr-1" />
                Esporta CSV
              </Button>
            )}
          </div>
        </div>
        <div
          role="tablist"
          aria-label="Filtra per piano"
          className="inline-flex items-center gap-1 rounded-lg bg-muted p-1 w-fit"
        >
          {([
            { key: "all", label: "Tutti" },
            { key: "free", label: "Free" },
            { key: "beta_tester", label: "Beta Tester" },
            { key: "pro", label: "Pro" },
          ] as const).map((opt) => {
            const isActive = planFilter === opt.key;
            const count = planCounts[opt.key];
            return (
              <button
                key={opt.key}
                role="tab"
                aria-selected={isActive}
                type="button"
                onClick={() => {
                  setPlanFilter(opt.key);
                  setCurrentPage(1);
                }}
                className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-sm transition-colors ${
                  isActive
                    ? "bg-background text-foreground shadow-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
                <span className={`tabular-nums text-xs ${isActive ? "text-muted-foreground" : "text-muted-foreground/70"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableCaption className="sr-only">Lista utenti registrati</TableCaption>
          <TableHeader>
            <TableRow className="bg-muted hover:bg-muted">
              <TableHead className={headerCellClass}>
                <button
                  type="button"
                  onClick={() => handleSort("userCode")}
                  className="inline-flex items-center gap-0.5 hover:text-foreground transition-colors"
                  aria-label="Ordina per ID"
                >
                  ID
                  <SortIcon field="userCode" sortState={sortState} />
                </button>
              </TableHead>
              <TableHead className={headerCellClass}>Nome</TableHead>
              <TableHead className={headerCellClass}>Piano</TableHead>
              <TableHead className={headerCellClass}>Gestione</TableHead>
              <TableHead className={`${headerCellClass} text-center`}>Onboarding</TableHead>
              <TableHead className={`${headerCellClass} text-right`}>
                <button
                  type="button"
                  onClick={() => handleSort("receiptCount")}
                  className="inline-flex items-center gap-0.5 hover:text-foreground transition-colors ml-auto"
                  aria-label="Ordina per incassi"
                >
                  Incassi
                  <SortIcon field="receiptCount" sortState={sortState} />
                </button>
              </TableHead>
              <TableHead className={`${headerCellClass} text-right`}>
                <button
                  type="button"
                  onClick={() => handleSort("lastSeenAt")}
                  className="inline-flex items-center gap-0.5 hover:text-foreground transition-colors ml-auto"
                  aria-label="Ordina per ultimo accesso"
                >
                  Ultimo Accesso
                  <SortIcon field="lastSeenAt" sortState={sortState} />
                </button>
              </TableHead>
              <TableHead className={`${headerCellClass} text-right`}>
                <button
                  type="button"
                  onClick={() => handleSort("createdAt")}
                  className="inline-flex items-center gap-0.5 hover:text-foreground transition-colors ml-auto"
                  aria-label="Ordina per data registrazione"
                >
                  Registrazione
                  <SortIcon field="createdAt" sortState={sortState} />
                </button>
              </TableHead>
              <TableHead className={`${headerCellClass} w-[50px]`}>
                <span className="sr-only">Azioni</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedUsers.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                  Nessun utente corrisponde ai filtri attivi.
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setPlanFilter("all");
                      setCurrentPage(1);
                    }}
                    className="ml-2 text-teal-700 hover:underline font-medium"
                  >
                    Azzera filtri
                  </button>
                </TableCell>
              </TableRow>
            )}
            {paginatedUsers.map((user) => (
              <TableRow key={user.id} className="hover:bg-muted">
                <TableCell className="py-4">
                  <span className="font-mono text-xs text-muted-foreground tracking-wider">{user.userCode}</span>
                  {user.isInternal && (
                    <Badge variant="outline" className="ml-2 text-xs text-slate-500 border-slate-300">
                      Interno
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="py-4 font-semibold text-foreground">
                  {getDisplayName(user.firstName, user.lastName)}
                </TableCell>
                <TableCell className="py-4">
                  {getTierBadge(user.tier, user.status, user.cancelAtPeriodEnd, user.adminOverrideTier)}
                </TableCell>
                <TableCell className="py-4 text-sm text-muted-foreground">
                  {user.gestione ? (
                    <Badge variant="outline" className="text-xs capitalize">
                      {user.gestione}
                    </Badge>
                  ) : "—"}
                </TableCell>
                <TableCell className="py-4 text-center">
                  {user.onboardingCompleted ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 inline-block" aria-label="Onboarding completato" />
                  ) : (
                    <XCircle className="h-4 w-4 text-slate-500 inline-block" aria-label="Onboarding non completato" />
                  )}
                </TableCell>
                <TableCell className="py-4 text-right text-sm tabular-nums text-muted-foreground">
                  {user.receiptCount}
                </TableCell>
                <TableCell className="py-4 text-right text-xs text-muted-foreground">
                  {user.lastSeenAt
                    ? formatDistanceToNow(safeParseDate(user.lastSeenAt), { addSuffix: true, locale: it })
                    : <span title="Nessuna sessione tracciata">reg. {format(safeParseDate(user.createdAt), "dd MMM yy", { locale: it })}</span>}
                </TableCell>
                <TableCell className="py-4 text-right text-xs text-muted-foreground tabular-nums">
                  {format(safeParseDate(user.createdAt), "dd MMM yyyy", { locale: it })}
                </TableCell>
                <TableCell className="py-4 w-[50px]">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        className="h-8 w-8 p-0 min-h-[44px] min-w-[44px]"
                      >
                        <MoreHorizontal className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        <span className="sr-only">Azioni per {user.userCode}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Azioni</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem>Visualizza dettagli</DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setMessagesUser(user)}
                        data-testid={`messages-btn-${user.userCode}`}
                      >
                        <MessageCircle className="h-4 w-4 mr-2" />
                        Messaggi inviati
                      </DropdownMenuItem>
                      {onOverrideChange && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuLabel>Livello</DropdownMenuLabel>
                          <DropdownMenuItem
                            onClick={() => onOverrideChange(user.id, null)}
                            disabled={user.adminOverrideTier === null}
                          >
                            {user.adminOverrideTier === null && <Check className="h-4 w-4 mr-2" />}
                            Nessuno
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onOverrideChange(user.id, "pro")}
                            disabled={user.adminOverrideTier === "pro"}
                          >
                            {user.adminOverrideTier === "pro" && <Check className="h-4 w-4 mr-2" />}
                            Pro (regalo)
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onOverrideChange(user.id, "beta_tester")}
                            disabled={user.adminOverrideTier === "beta_tester"}
                          >
                            {user.adminOverrideTier === "beta_tester" && <Check className="h-4 w-4 mr-2" />}
                            Beta Tester
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
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
      <AdminUserMessagesDialog
        open={!!messagesUser}
        onOpenChange={(open) => { if (!open) setMessagesUser(null); }}
        userId={messagesUser?.id ?? null}
        userCode={messagesUser?.userCode ?? ""}
        userName={messagesUser ? getDisplayName(messagesUser.firstName, messagesUser.lastName) : ""}
      />
    </Card>
  );
}
