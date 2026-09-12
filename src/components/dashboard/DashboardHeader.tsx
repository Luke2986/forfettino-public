import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw, FileUp, Lock, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useProfile } from "@/hooks/useProfile";
import { useSubscription } from "@/hooks/useSubscription";
import { ImportFattureDialog } from "@/components/import/ImportFattureDialog";
import { track } from "@/lib/analytics";
import { capitalize } from "@/lib/string-utils";
import { cn } from "@/lib/utils";
import { UserCountBadge } from "@/components/dashboard/UserCountBadge";
import { AvatarDropdown } from "@/components/dashboard/AvatarDropdown";

export function DashboardHeader() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const { canImport } = useSubscription();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  const greeting = profile?.first_name
    ? `Ciao, ${capitalize(profile.first_name)}!`
    : "Ciao!";

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries();
    // Minimo 600ms di animazione per feedback visivo
    await new Promise((resolve) => setTimeout(resolve, 600));
    setIsRefreshing(false);
  }, [queryClient]);

  return (
    <div className="flex items-center justify-between gap-2 sm:gap-4">
      {/* Left: Greeting + User Count */}
      <div className="flex items-center gap-2">
        <h1 className="sr-only">Dashboard Fiscale</h1>
        <h2 className="text-base font-semibold text-slate-800 whitespace-nowrap">
          {greeting}
        </h2>
        <UserCountBadge className="hidden sm:inline-flex" />
      </div>

      {/* Right: CTA + Azioni dropdown + Avatar dropdown */}
      <div className="flex items-center gap-2">
        {/* CTA Aggiungi incasso — icon-only su mobile, icon+testo su desktop */}
        <Button
          size="sm"
          className="min-h-[44px] min-w-[44px]"
          onClick={() => {
            track("add_income_click", { source: "dashboard_header" });
            navigate("/incassi/nuovo");
          }}
        >
          <Plus className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Aggiungi incasso</span>
        </Button>

        {/* Dropdown Azioni (⋮) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 min-h-[44px] min-w-[44px]"
              aria-label="Azioni"
            >
              <MoreVertical className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              disabled={!canImport}
              onSelect={() => {
                if (!canImport) return;
                track("import_xml_click", { source: "dashboard_header_actions_dropdown" });
                setImportDialogOpen(true);
              }}
            >
              {canImport ? (
                <FileUp className="mr-2 h-4 w-4" />
              ) : (
                <Lock className="mr-2 h-4 w-4" />
              )}
              {canImport ? "Importa XML" : "Importa XML (limite)"}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={isRefreshing}
              onSelect={() => {
                track("refresh_click", { source: "dashboard_header_actions_dropdown" });
                handleRefresh();
              }}
            >
              <RefreshCw className={cn("mr-2 h-4 w-4", isRefreshing && "animate-spin")} />
              Aggiorna dati
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Dropdown Avatar/Profilo */}
        <AvatarDropdown />
      </div>

      <ImportFattureDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
      />
    </div>
  );
}
