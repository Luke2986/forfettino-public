import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Crown, Plus, Pencil, Trash2, ChevronDown, Users } from "lucide-react";
import {
  useAdminMilestones,
  useAdminDeleteMilestone,
  type AdminMilestone,
} from "@/hooks/useAdminMilestones";
import { AdminMilestoneEditor } from "./AdminMilestoneEditor";
import { AdminMilestoneClaimsTable } from "./AdminMilestoneClaimsTable";
import { useToast } from "@/hooks/use-toast";

export function AdminMilestones() {
  const { data: milestones, isLoading } = useAdminMilestones();
  const deleteMutation = useAdminDeleteMilestone();
  const { toast } = useToast();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<AdminMilestone | null>(null);
  const [claimsOpen, setClaimsOpen] = useState(false);

  const headerCellClass =
    "text-xs font-semibold uppercase tracking-wider text-muted-foreground";

  const handleEdit = (m: AdminMilestone) => {
    setEditingMilestone(m);
    setEditorOpen(true);
  };

  const handleCreate = () => {
    setEditingMilestone(null);
    setEditorOpen(true);
  };

  const handleDelete = (m: AdminMilestone) => {
    if (!confirm(`Eliminare il traguardo "${m.name}" (Lv${m.level})?`)) return;
    deleteMutation.mutate(m.id, {
      onSuccess: () => toast({ title: `Traguardo "${m.name}" eliminato` }),
      onError: (err: Error) =>
        toast({
          title: "Errore",
          description: err.message ?? "Impossibile eliminare",
          variant: "destructive",
        }),
    });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Crown className="h-5 w-5 text-violet-500" />
              Gestione Traguardi
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1"
              onClick={handleCreate}
            >
              <Plus className="h-3.5 w-3.5" />
              Nuovo
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Milestones table */}
          {isLoading ? (
            <div className="animate-pulse space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-8 bg-slate-100 rounded" />
              ))}
            </div>
          ) : !milestones || milestones.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nessun traguardo configurato.
            </p>
          ) : (
            <Table>
              <TableCaption className="sr-only">Traguardi e livelli configurati</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className={headerCellClass}>Lvl</TableHead>
                  <TableHead className={headerCellClass}>Nome</TableHead>
                  <TableHead className={`${headerCellClass} text-right`}>Punti</TableHead>
                  <TableHead className={headerCellClass}>Premio</TableHead>
                  <TableHead className={headerCellClass}>Stato</TableHead>
                  <TableHead className={`${headerCellClass} text-right`}>Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {milestones.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-bold text-sm tabular-nums">
                      {m.level}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {m.name}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-sm">
                      {m.pointsRequired} pt
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {m.rewardLabel}
                    </TableCell>
                    <TableCell>
                      {m.isActive ? (
                        <Badge className="bg-emerald-100 text-emerald-700 text-xs h-5 hover:bg-emerald-100">
                          Attivo
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs h-5 text-slate-500">
                          Disattivo
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 min-h-[44px] min-w-[44px]"
                          onClick={() => handleEdit(m)}
                          title="Modifica"
                          aria-label={`Modifica traguardo ${m.name}`}
                        >
                          <Pencil className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 min-h-[44px] min-w-[44px]"
                          onClick={() => handleDelete(m)}
                          disabled={deleteMutation.isPending}
                          title="Elimina"
                          aria-label={`Elimina traguardo ${m.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Collapsible: users who achieved milestones */}
          <Collapsible open={claimsOpen} onOpenChange={setClaimsOpen}>
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-between py-2 px-1 hover:bg-slate-50 transition-colors rounded-lg text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-slate-500" />
                  <span className="font-medium">Utenti che hanno raggiunto traguardi</span>
                </div>
                <ChevronDown
                  className={`h-4 w-4 text-slate-500 transition-transform duration-200 ${
                    claimsOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="pt-2">
                <AdminMilestoneClaimsTable />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      {/* Editor dialog — key forces remount when switching milestones */}
      {editorOpen && (
        <AdminMilestoneEditor
          key={editingMilestone?.id ?? "new"}
          milestone={editingMilestone}
          open={editorOpen}
          onOpenChange={setEditorOpen}
        />
      )}
    </>
  );
}
