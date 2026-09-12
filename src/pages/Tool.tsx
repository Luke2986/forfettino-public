import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, useFiscalCalculations } from "@/hooks/useFiscalCalculations";
import { sanitizeMoney, isValidMoney } from "@/lib/money";
import { CostCoverageCard } from "@/components/tool/CostCoverageCard";
import { computeCoverageDots, toAnnual } from "@/components/tool/coverage-helpers";
import { AppLayout } from "@/components/layout/AppLayout";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { Plus, Wrench, Loader2, MoreHorizontal, Pencil, Trash2, Briefcase, Calculator } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type CategoryType = "tool" | "accountant" | "other";
type FrequencyType = "monthly" | "quarterly" | "yearly";

interface ToolRow {
  id: string;
  name: string;
  cost: number;
  frequency: string;
  category: string;
  renewal_date: string | null;
  is_active: boolean;
  is_recurring: boolean;
}

export default function ToolPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { metrics, isLoading: isMetricsLoading } = useFiscalCalculations();
  const metricsReady = !isMetricsLoading && !!metrics;

  // Filter state
  const [categoryFilter, setCategoryFilter] = useState<CategoryType | "all">("all");

  // Create dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newTool, setNewTool] = useState({
    name: "",
    cost: "",
    category: "tool" as CategoryType,
    frequency: "monthly" as FrequencyType,
    renewal_date: "",
    is_recurring: true,
  });

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTool, setEditingTool] = useState<ToolRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editCost, setEditCost] = useState("");
  const [editCategory, setEditCategory] = useState<CategoryType>("tool");
  const [editFrequency, setEditFrequency] = useState<FrequencyType>("monthly");
  const [editIsRecurring, setEditIsRecurring] = useState(true);
  const [editRenewalDate, setEditRenewalDate] = useState("");

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingToolId, setDeletingToolId] = useState<string | null>(null);

  const { data: tools, isLoading } = useQuery({
    queryKey: ["tool_subscriptions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("tool_subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const parsedCost = sanitizeMoney(newTool.cost);
      if (!isValidMoney(parsedCost) || parsedCost <= 0) {
        throw new Error("Costo non valido");
      }
      const { error } = await supabase.from("tool_subscriptions").insert({
        user_id: user.id,
        name: newTool.name.trim(),
        cost: parsedCost,
        category: newTool.category,
        frequency: newTool.frequency,
        renewal_date: newTool.renewal_date || null,
        is_active: true,
        is_recurring: newTool.is_recurring,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tool_subscriptions"] });
      setCreateDialogOpen(false);
      setNewTool({ name: "", cost: "", category: "tool", frequency: "monthly", renewal_date: "", is_recurring: true });
      toast({ title: "Tool aggiunto!" });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile aggiungere il tool.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingTool) throw new Error("Invalid state");
      const parsedCost = sanitizeMoney(editCost);
      if (!isValidMoney(parsedCost) || parsedCost <= 0) {
        throw new Error("Costo non valido");
      }
      const { error } = await supabase
        .from("tool_subscriptions")
        .update({
          name: editName.trim(),
          cost: parsedCost,
          category: editCategory,
          frequency: editFrequency,
          renewal_date: editRenewalDate || null,
          is_recurring: editIsRecurring,
        })
        .eq("id", editingTool.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tool_subscriptions"] });
      setEditDialogOpen(false);
      setEditingTool(null);
      toast({ title: "Tool aggiornato!" });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile aggiornare il tool.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tool_subscriptions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tool_subscriptions"] });
      setDeleteDialogOpen(false);
      setDeletingToolId(null);
      toast({ title: "Tool eliminato!" });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile eliminare il tool.", variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("tool_subscriptions")
        .update({ is_active: isActive })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tool_subscriptions"] });
    },
  });

  const openEditDialog = (tool: ToolRow) => {
    setEditingTool(tool);
    setEditName(tool.name);
    setEditCost(tool.cost.toString());
    setEditCategory(tool.category as CategoryType);
    setEditFrequency(tool.frequency as FrequencyType);
    setEditRenewalDate(tool.renewal_date || "");
    setEditIsRecurring(tool.is_recurring);
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (id: string) => {
    setDeletingToolId(id);
    setDeleteDialogOpen(true);
  };

  // Helper to convert cost to monthly equivalent
  const toMonthly = (cost: number, freq: string) => {
    if (freq === "yearly") return cost / 12;
    if (freq === "quarterly") return cost / 3;
    return cost;
  };

  // Filter tools by category
  const filteredTools = tools?.filter((t) => {
    if (categoryFilter === "all") return true;
    return t.category === categoryFilter;
  }) || [];

  const activeTools = tools?.filter((t) => t.is_active) || [];
  const monthlyTotal = activeTools.reduce((sum, tool) => {
    return sum + toMonthly(Number(tool.cost), tool.frequency);
  }, 0);

  const yearlyTotal = activeTools.reduce((sum, tool) => {
    return sum + toAnnual(Number(tool.cost), tool.frequency);
  }, 0);

  // Category breakdown for active tools
  const toolsCost = activeTools
    .filter((t) => t.category === "tool")
    .reduce((sum, t) => sum + toMonthly(Number(t.cost), t.frequency), 0);
  const accountantCost = activeTools
    .filter((t) => t.category === "accountant")
    .reduce((sum, t) => sum + toMonthly(Number(t.cost), t.frequency), 0);
  const otherCost = activeTools
    .filter((t) => t.category === "other")
    .reduce((sum, t) => sum + toMonthly(Number(t.cost), t.frequency), 0);

  // Helper for category label
  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case "accountant": return "Commercialista";
      case "other": return "Altro";
      default: return "Tool";
    }
  };

  // Helper for category icon
  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case "accountant": return <Calculator className="h-4 w-4" />;
      case "other": return <Briefcase className="h-4 w-4" />;
      default: return <Wrench className="h-4 w-4" />;
    }
  };

  // Helper for frequency label
  const getFrequencyLabel = (freq: string) => {
    switch (freq) {
      case "quarterly": return "Trimestrale";
      case "yearly": return "Annuale";
      default: return "Mensile";
    }
  };

  const spendable = metrics?.spendable ?? 0;
  const fiscalYearlyToolCost = metrics?.yearlyToolCost ?? 0;
  // Use spendableRaw (pre-floor) to get the real gross available before tool deduction.
  // When spendable is floored at 0, spendable + yearlyToolCost overstates coverage.
  const rawSpendable = metrics?.spendableRaw ?? spendable;
  const grossBeforeTools = rawSpendable + fiscalYearlyToolCost;
  const coveredAmount = yearlyTotal > 0 ? Math.min(Math.max(0, grossBeforeTools), yearlyTotal) : 0;
  const coverageDots = metricsReady
    ? computeCoverageDots(
        activeTools.map((t) => ({ id: t.id, cost: Number(t.cost), frequency: t.frequency })),
        coveredAmount,
      )
    : new Map<string, "covered" | "partial" | "uncovered">();

  const dotColorClass = (status: "covered" | "partial" | "uncovered") => {
    switch (status) {
      case "covered": return "bg-teal-500";
      case "partial": return "bg-amber-500";
      case "uncovered": return "bg-slate-300";
    }
  };

  const mobileRightAction = (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setCreateDialogOpen(true)}
    >
      <Plus className="h-5 w-5" />
    </Button>
  );

  return (
    <AppLayout>
      {isMobile && (
        <MobileHeader
          title="Costi Fissi"
          rightAction={mobileRightAction}
        />
      )}
      <PageContainer>
        {/* Header - desktop only */}
        <div className="hidden md:flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Costi Fissi</h1>
            <p className="text-muted-foreground">
              Gestisci le tue subscription e costi fissi
            </p>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Aggiungi Costo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nuovo Costo</DialogTitle>
                <DialogDescription>
                  Aggiungi una nuova subscription o costo ricorrente.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="tool-name">Nome</Label>
                  <Input
                    id="tool-name"
                    placeholder="Es. Figma, GitHub, Commercialista..."
                    value={newTool.name}
                    onChange={(e) => setNewTool({ ...newTool, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select
                    value={newTool.category}
                    onValueChange={(v) => setNewTool({ ...newTool, category: v as CategoryType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tool">Tool</SelectItem>
                      <SelectItem value="accountant">Commercialista</SelectItem>
                      <SelectItem value="other">Altro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tool-cost">Costo (€)</Label>
                  <Input
                    id="tool-cost"
                    type="number"
                    step="0.01"
                    placeholder="12.00"
                    value={newTool.cost}
                    onChange={(e) => setNewTool({ ...newTool, cost: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Frequenza</Label>
                  <Select
                    value={newTool.frequency}
                    onValueChange={(v) => setNewTool({ ...newTool, frequency: v as FrequencyType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Mensile</SelectItem>
                      <SelectItem value="quarterly">Trimestrale</SelectItem>
                      <SelectItem value="yearly">Annuale</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tool-renewal">Data Rinnovo (opzionale)</Label>
                  <Input
                    id="tool-renewal"
                    type="date"
                    value={newTool.renewal_date}
                    onChange={(e) => setNewTool({ ...newTool, renewal_date: e.target.value })}
                  />
                </div>
                {newTool.renewal_date && (
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <Label htmlFor="tool-recurring">Ripetizione automatica</Label>
                      <p className="text-xs text-muted-foreground">
                        Il rinnovo si ripeterà ogni {getFrequencyLabel(newTool.frequency).toLowerCase()}
                      </p>
                    </div>
                    <Switch
                      id="tool-recurring"
                      checked={newTool.is_recurring}
                      onCheckedChange={(checked) => setNewTool({ ...newTool, is_recurring: checked })}
                    />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Annulla
                </Button>
                <Button
                  onClick={() => createMutation.mutate()}
                  disabled={!newTool.name.trim() || !newTool.cost || createMutation.isPending}
                >
                  {createMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Aggiungi
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Mobile Dialog */}
        {isMobile && (
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nuovo Costo</DialogTitle>
                <DialogDescription>
                  Aggiungi una nuova subscription o costo ricorrente.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="tool-name-mobile">Nome</Label>
                  <Input
                    id="tool-name-mobile"
                    placeholder="Es. Figma, GitHub, Commercialista..."
                    value={newTool.name}
                    onChange={(e) => setNewTool({ ...newTool, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select
                    value={newTool.category}
                    onValueChange={(v) => setNewTool({ ...newTool, category: v as CategoryType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tool">Tool</SelectItem>
                      <SelectItem value="accountant">Commercialista</SelectItem>
                      <SelectItem value="other">Altro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tool-cost-mobile">Costo (€)</Label>
                  <Input
                    id="tool-cost-mobile"
                    type="number"
                    step="0.01"
                    placeholder="12.00"
                    value={newTool.cost}
                    onChange={(e) => setNewTool({ ...newTool, cost: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Frequenza</Label>
                  <Select
                    value={newTool.frequency}
                    onValueChange={(v) => setNewTool({ ...newTool, frequency: v as FrequencyType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Mensile</SelectItem>
                      <SelectItem value="quarterly">Trimestrale</SelectItem>
                      <SelectItem value="yearly">Annuale</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tool-renewal-mobile">Data Rinnovo (opzionale)</Label>
                  <Input
                    id="tool-renewal-mobile"
                    type="date"
                    value={newTool.renewal_date}
                    onChange={(e) => setNewTool({ ...newTool, renewal_date: e.target.value })}
                  />
                </div>
                {newTool.renewal_date && (
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <Label htmlFor="tool-recurring-mobile">Ripetizione automatica</Label>
                      <p className="text-xs text-muted-foreground">
                        Il rinnovo si ripeterà ogni {getFrequencyLabel(newTool.frequency).toLowerCase()}
                      </p>
                    </div>
                    <Switch
                      id="tool-recurring-mobile"
                      checked={newTool.is_recurring}
                      onCheckedChange={(checked) => setNewTool({ ...newTool, is_recurring: checked })}
                    />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Annulla
                </Button>
                <Button
                  onClick={() => createMutation.mutate()}
                  disabled={!newTool.name.trim() || !newTool.cost || createMutation.isPending}
                >
                  {createMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Aggiungi
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Coverage Card */}
        <CostCoverageCard
          monthlyTotal={monthlyTotal}
          yearlyTotal={yearlyTotal}
          coveredAmount={coveredAmount}
          spendable={spendable}
          yearlyToolCost={fiscalYearlyToolCost}
          isMetricsLoading={isMetricsLoading}
        />

        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={categoryFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setCategoryFilter("all")}
          >
            Tutti ({tools?.length || 0})
          </Button>
          <Button
            variant={categoryFilter === "tool" ? "default" : "outline"}
            size="sm"
            onClick={() => setCategoryFilter("tool")}
            className="gap-1"
          >
            <Wrench className="h-3 w-3" />
            Tool ({tools?.filter((t) => t.category === "tool").length || 0})
          </Button>
          <Button
            variant={categoryFilter === "accountant" ? "default" : "outline"}
            size="sm"
            onClick={() => setCategoryFilter("accountant")}
            className="gap-1"
          >
            <Calculator className="h-3 w-3" />
            Commercialista ({tools?.filter((t) => t.category === "accountant").length || 0})
          </Button>
          <Button
            variant={categoryFilter === "other" ? "default" : "outline"}
            size="sm"
            onClick={() => setCategoryFilter("other")}
            className="gap-1"
          >
            <Briefcase className="h-3 w-3" />
            Altro ({tools?.filter((t) => t.category === "other").length || 0})
          </Button>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : filteredTools && filteredTools.length > 0 ? (
              <div className="overflow-x-auto">
              <Table>
                <TableCaption className="sr-only">Elenco strumenti e abbonamenti</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead className="hidden md:table-cell">Categoria</TableHead>
                    <TableHead>Costo</TableHead>
                    <TableHead className="hidden md:table-cell">Frequenza</TableHead>
                    <TableHead className="hidden md:table-cell">Rinnovo</TableHead>
                    <TableHead className="hidden md:table-cell">Equiv. Mensile</TableHead>
                    <TableHead className="text-center">Attivo</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTools.map((tool) => (
                    <TableRow key={tool.id} className={!tool.is_active ? "opacity-50" : ""}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {metricsReady && tool.is_active && coverageDots.has(tool.id) && (
                            <span
                              className={`h-2 w-2 rounded-full shrink-0 ${dotColorClass(coverageDots.get(tool.id)!)}`}
                              title={
                                coverageDots.get(tool.id) === "covered"
                                  ? "Coperto"
                                  : coverageDots.get(tool.id) === "partial"
                                    ? "Parzialmente coperto"
                                    : "Non ancora coperto"
                              }
                            />
                          )}
                          {getCategoryIcon(tool.category)}
                          {tool.name}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="secondary">{getCategoryLabel(tool.category)}</Badge>
                      </TableCell>
                      <TableCell>{formatCurrency(Number(tool.cost))}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        {getFrequencyLabel(tool.frequency)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {tool.renewal_date
                          ? new Date(tool.renewal_date + "T00:00:00").toLocaleDateString("it-IT")
                          : "-"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {formatCurrency(toMonthly(Number(tool.cost), tool.frequency))}
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={tool.is_active}
                          onCheckedChange={(checked) =>
                            toggleMutation.mutate({ id: tool.id, isActive: checked })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(tool)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Modifica
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => openDeleteDialog(tool.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Elimina
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Wrench className="h-12 w-12 text-muted-foreground/50" />
                <h2 className="mt-4 text-lg font-medium">Nessun tool</h2>
                <p className="text-muted-foreground">
                  Aggiungi le tue subscription per monitorare i costi.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Modifica Tool</DialogTitle>
              <DialogDescription>
                Modifica i dati del tool selezionato.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nome</Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select
                  value={editCategory}
                  onValueChange={(v) => setEditCategory(v as CategoryType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tool">Tool</SelectItem>
                    <SelectItem value="accountant">Commercialista</SelectItem>
                    <SelectItem value="other">Altro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-cost">Costo (€)</Label>
                <Input
                  id="edit-cost"
                  type="number"
                  step="0.01"
                  value={editCost}
                  onChange={(e) => setEditCost(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Frequenza</Label>
                <Select
                  value={editFrequency}
                  onValueChange={(v) => setEditFrequency(v as FrequencyType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Mensile</SelectItem>
                    <SelectItem value="quarterly">Trimestrale</SelectItem>
                    <SelectItem value="yearly">Annuale</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-renewal">Data Rinnovo (opzionale)</Label>
                <Input
                  id="edit-renewal"
                  type="date"
                  value={editRenewalDate}
                  onChange={(e) => setEditRenewalDate(e.target.value)}
                />
              </div>
              {editRenewalDate && (
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="edit-recurring">Ripetizione automatica</Label>
                    <p className="text-xs text-muted-foreground">
                      Il rinnovo si ripeterà ogni {getFrequencyLabel(editFrequency).toLowerCase()}
                    </p>
                  </div>
                  <Switch
                    id="edit-recurring"
                    checked={editIsRecurring}
                    onCheckedChange={setEditIsRecurring}
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Annulla
              </Button>
              <Button
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending || !editName.trim() || !editCost}
              >
                {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salva
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminare il tool?</AlertDialogTitle>
              <AlertDialogDescription>
                Questa azione non può essere annullata. Il tool verrà eliminato permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annulla</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deletingToolId && deleteMutation.mutate(deletingToolId)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Elimina
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PageContainer>
    </AppLayout>
  );
}
