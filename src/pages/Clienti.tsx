import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useClientDraft } from "@/hooks/useClientDraft";
import { formatCurrency } from "@/hooks/useFiscalCalculations";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageYearSelector } from "@/components/shared/PageYearSelector";
import { useAvailableYears } from "@/hooks/useAvailableYears";
import { usePrefetchAdjacentYears } from "@/hooks/usePrefetchAdjacentYears";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Plus,
  Search,
  Users,
  MoreHorizontal,
  Pencil,
  UserX,
  UserCheck,
  Trash2,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { z } from "zod";

const clientSchema = z.object({
  display_name: z.string().min(1, "Nome visualizzato obbligatorio").max(200, "Nome troppo lungo"),
  legal_name: z.string().max(200, "Ragione sociale troppo lunga").optional().or(z.literal("")),
  vat_number: z.string().max(20, "P.IVA troppo lunga").optional().or(z.literal("")),
  tax_code: z.string().max(20, "Codice fiscale troppo lungo").optional().or(z.literal("")),
  email: z.string().email("Email non valida").optional().or(z.literal("")),
  phone: z.string().max(30, "Telefono troppo lungo").optional().or(z.literal("")),
  address_text: z.string().max(500, "Indirizzo troppo lungo").optional().or(z.literal("")),
  notes: z.string().max(1000, "Note troppo lunghe").optional().or(z.literal("")),
});

interface ClientRow {
  id: string;
  display_name: string;
  name: string;
  legal_name: string | null;
  vat_number: string | null;
  tax_code: string | null;
  email: string | null;
  phone: string | null;
  address_text: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
}

interface ClientStats {
  [clientId: string]: {
    totalYTD: number;
    lastReceipt: Date | null;
  };
}

export default function ClientiPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [searchTerm, setSearchTerm] = useState("");
  const [onlyActive, setOnlyActive] = useState(true);

  // Form drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientRow | null>(null);
  const [formData, setFormData] = useState({
    display_name: "",
    legal_name: "",
    vat_number: "",
    tax_code: "",
    email: "",
    phone: "",
    address_text: "",
    notes: "",
    active: true,
  });
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [formWarnings, setFormWarnings] = useState<string[]>([]);

  // Persistenza draft in sessionStorage — sopravvive a reload accidentali
  const { draft, saveDraft, clearDraft } = useClientDraft({
    userId: user?.id,
    clientId: editingClient?.id ?? null,
    enabled: drawerOpen,
  });

  // Restore silenzioso: quando il Sheet si apre con un draft salvato,
  // sovrascrive i dati caricati da DB con l'ultimo stato dell'utente.
  useEffect(() => {
    if (drawerOpen && draft) {
      setFormData(draft);
    }
  }, [drawerOpen, draft]);

  const handleFieldChange = <K extends keyof typeof formData>(
    field: K,
    value: (typeof formData)[K],
  ) => {
    const next = { ...formData, [field]: value };
    setFormData(next);
    saveDraft(next);
  };

  // Deactivate dialog
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [deactivatingClientId, setDeactivatingClientId] = useState<string | null>(null);

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingClientId, setDeletingClientId] = useState<string | null>(null);

  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const { availableYears } = useAvailableYears();
  usePrefetchAdjacentYears(currentYear, availableYears);

  // Fetch clients
  const { data: clients, isLoading } = useQuery({
    queryKey: ["clients", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from("clients").select("*").eq("user_id", user.id).order("display_name");
      if (error) throw error;
      return (data || []) as ClientRow[];
    },
    enabled: !!user,
  });

  // Fetch receipts for YTD stats
  const { data: clientStats } = useQuery({
    queryKey: ["client_stats", user?.id, currentYear],
    queryFn: async () => {
      if (!user) return {} as ClientStats;
      const { data, error } = await supabase
        .from("receipts")
        .select("client_id, gross_amount, receipt_date")
        .eq("user_id", user.id)
        .eq("fiscal_year", currentYear);
      if (error) throw error;

      return (data || []).reduce((acc: ClientStats, r) => {
        if (!r.client_id) return acc;
        if (!acc[r.client_id]) {
          acc[r.client_id] = { totalYTD: 0, lastReceipt: null };
        }
        acc[r.client_id].totalYTD += Number(r.gross_amount);
        const receiptDate = new Date(r.receipt_date + "T00:00:00");
        if (!acc[r.client_id].lastReceipt || receiptDate > acc[r.client_id].lastReceipt) {
          acc[r.client_id].lastReceipt = receiptDate;
        }
        return acc;
      }, {} as ClientStats);
    },
    enabled: !!user,
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");

      const payload = {
        user_id: user.id,
        display_name: formData.display_name.trim(),
        name: formData.display_name.trim(),
        legal_name: formData.legal_name.trim() || null,
        vat_number: formData.vat_number.trim() || null,
        tax_code: formData.tax_code.trim() || null,
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
        address_text: formData.address_text.trim() || null,
        notes: formData.notes.trim() || null,
        active: formData.active,
      };

      if (editingClient) {
        const { error } = await supabase.from("clients").update(payload).eq("id", editingClient.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("clients").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      clearDraft();
      setDrawerOpen(false);
      resetForm();
      toast({ title: editingClient ? "Cliente aggiornato!" : "Cliente creato!" });
    },
    onError: (error: Error) => {
      if (error.message?.includes("clients_user_vat_unique")) {
        toast({
          title: "Errore",
          description: "Esiste già un cliente con questa P.IVA.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Errore",
          description: "Impossibile salvare il cliente.",
          variant: "destructive",
        });
      }
    },
  });

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("clients").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { active }) => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setDeactivateDialogOpen(false);
      setDeactivatingClientId(null);
      toast({ title: active ? "Cliente riattivato!" : "Cliente disattivato!" });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Impossibile aggiornare lo stato del cliente.",
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setDeleteDialogOpen(false);
      setDeletingClientId(null);
      toast({ title: "Cliente eliminato!" });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Impossibile eliminare il cliente. Potrebbe avere incassi collegati.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      display_name: "",
      legal_name: "",
      vat_number: "",
      tax_code: "",
      email: "",
      phone: "",
      address_text: "",
      notes: "",
      active: true,
    });
    setFormErrors({});
    setFormWarnings([]);
    setEditingClient(null);
  };

  const openNewClientDrawer = () => {
    resetForm();
    setDrawerOpen(true);
  };

  const openEditDrawer = (client: ClientRow) => {
    setEditingClient(client);
    setFormData({
      display_name: client.display_name,
      legal_name: client.legal_name || "",
      vat_number: client.vat_number || "",
      tax_code: client.tax_code || "",
      email: client.email || "",
      phone: client.phone || "",
      address_text: client.address_text || "",
      notes: client.notes || "",
      active: client.active,
    });
    setFormErrors({});
    setFormWarnings([]);
    setDrawerOpen(true);
  };

  const validateAndSave = () => {
    const result = clientSchema.safeParse(formData);
    if (!result.success) {
      const errors: { [key: string]: string } = {};
      result.error.errors.forEach((e) => {
        const path = e.path[0] as string;
        errors[path] = e.message;
      });
      setFormErrors(errors);
      return;
    }

    // Soft validations (warnings)
    const warnings: string[] = [];
    if (formData.vat_number && !/^\d{11}$/.test(formData.vat_number.trim())) {
      warnings.push("La P.IVA dovrebbe essere di 11 cifre");
    }
    if (formData.tax_code && !/^[A-Z0-9]{16}$/i.test(formData.tax_code.trim())) {
      warnings.push("Il Codice Fiscale dovrebbe essere di 16 caratteri alfanumerici");
    }

    // Check duplicate display_name
    const existingWithSameName = clients?.find(
      (c) => c.display_name.toLowerCase() === formData.display_name.trim().toLowerCase() && c.id !== editingClient?.id,
    );
    if (existingWithSameName) {
      warnings.push(`Esiste già un cliente con nome simile: "${existingWithSameName.display_name}"`);
    }

    setFormWarnings(warnings);
    setFormErrors({});
    saveMutation.mutate();
  };

  const openDeactivateDialog = (id: string) => {
    setDeactivatingClientId(id);
    setDeactivateDialogOpen(true);
  };

  const openDeleteDialog = (id: string) => {
    setDeletingClientId(id);
    setDeleteDialogOpen(true);
  };

  // Filtered clients
  const filteredClients = useMemo(() => {
    if (!clients) return [];
    return clients.filter((c) => {
      if (onlyActive && !c.active) return false;
      const searchLower = searchTerm.toLowerCase();
      return (
        c.display_name.toLowerCase().includes(searchLower) ||
        c.legal_name?.toLowerCase().includes(searchLower) ||
        c.vat_number?.toLowerCase().includes(searchLower) ||
        c.email?.toLowerCase().includes(searchLower)
      );
    });
  }, [clients, onlyActive, searchTerm]);

  // Stats
  const totalClients = clients?.length || 0;
  const activeClients = clients?.filter((c) => c.active).length || 0;
  const totalYTDAll = Object.values(clientStats || {}).reduce((sum, s) => sum + s.totalYTD, 0);

  const mobileRightAction = (
    <Button variant="ghost" size="icon" onClick={openNewClientDrawer}>
      <Plus className="h-5 w-5" />
    </Button>
  );

  return (
    <AppLayout>
      {isMobile && <MobileHeader title="Clienti" rightAction={mobileRightAction} />}
      <PageContainer>
        {/* Mobile: year selector */}
        {isMobile && (
          <div className="flex justify-center">
            <PageYearSelector
              year={currentYear}
              onYearChange={setCurrentYear}
              availableYears={availableYears}
            />
          </div>
        )}

        {/* Header - desktop only */}
        <div className="hidden md:flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold">Clienti</h1>
              <p className="text-muted-foreground">Gestisci la tua rubrica clienti</p>
            </div>
            <PageYearSelector
              year={currentYear}
              onYearChange={setCurrentYear}
              availableYears={availableYears}
            />
          </div>
          <Button onClick={openNewClientDrawer} className="gap-2">
            <Plus className="h-4 w-4" />
            Nuovo Cliente
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Totale Clienti</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold tabular-nums">{totalClients}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Clienti Attivi</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold tabular-nums">{activeClients}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Incassi YTD Totali</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold tabular-nums">{formatCurrency(totalYTDAll)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Cerca per nome, P.IVA, email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch id="only-active" checked={onlyActive} onCheckedChange={setOnlyActive} />
                <Label htmlFor="only-active" className="cursor-pointer">
                  Solo attivi
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredClients.length > 0 ? (
              <div className="overflow-x-auto">
              <Table>
                <TableCaption className="sr-only">Anagrafica clienti</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead className="hidden md:table-cell">P.IVA</TableHead>
                    <TableHead className="hidden md:table-cell">Email</TableHead>
                    <TableHead className="text-right">Incassi YTD</TableHead>
                    <TableHead className="hidden md:table-cell">Ultimo Incasso</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients.map((client) => {
                    const stats = clientStats?.[client.id];
                    return (
                      <TableRow key={client.id}>
                        <TableCell className="font-medium">
                          {client.display_name}
                          {client.legal_name && (
                            <span className="block text-sm text-slate-600">{client.legal_name}</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">{client.vat_number || <span className="text-muted-foreground italic text-sm">–</span>}</TableCell>
                        <TableCell className="text-muted-foreground hidden md:table-cell">
                          {client.email || <span className="text-muted-foreground italic text-sm">–</span>}
                        </TableCell>
                        <TableCell className="text-right">{stats ? formatCurrency(stats.totalYTD) : <span className="text-muted-foreground italic text-sm">–</span>}</TableCell>
                        <TableCell className="text-muted-foreground hidden md:table-cell">
                          {stats?.lastReceipt ? stats.lastReceipt.toLocaleDateString("it-IT") : <span className="text-muted-foreground italic text-sm">–</span>}
                        </TableCell>
                        <TableCell>
                          <Badge variant={client.active ? "default" : "secondary"}>
                            {client.active ? "Attivo" : "Inattivo"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditDrawer(client)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Modifica
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {client.active ? (
                                <DropdownMenuItem onClick={() => openDeactivateDialog(client.id)}>
                                  <UserX className="mr-2 h-4 w-4" />
                                  Disattiva
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() => toggleActiveMutation.mutate({ id: client.id, active: true })}
                                >
                                  <UserCheck className="mr-2 h-4 w-4" />
                                  Riattiva
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => openDeleteDialog(client.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Elimina
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground/50" />
                <h2 className="mt-4 text-lg font-medium">Nessun cliente trovato</h2>
                <p className="text-muted-foreground">Usa il bottone in alto per aggiungere il tuo primo cliente.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Client Form Drawer */}
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetContent className="overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{editingClient ? "Modifica Cliente" : "Nuovo Cliente"}</SheetTitle>
              <SheetDescription>
                {editingClient ? "Modifica i dati del cliente." : "Inserisci i dati del nuovo cliente."}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-4 py-6">
              {/* Warnings */}
              {formWarnings.length > 0 && (
                <div className="rounded-lg border border-warning/50 bg-warning/10 p-3 space-y-1">
                  {formWarnings.map((w, i) => (
                    <p key={i} className="text-sm text-warning flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                      {w}
                    </p>
                  ))}
                </div>
              )}

              {/* Form Fields */}
              <div className="space-y-2">
                <Label htmlFor="display_name">Nome Visualizzato *</Label>
                <Input
                  id="display_name"
                  value={formData.display_name}
                  onChange={(e) => handleFieldChange("display_name", e.target.value)}
                  placeholder="Es. Mario Rossi / Acme Srl"
                />
                {formErrors.display_name && <p className="text-sm text-destructive">{formErrors.display_name}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="legal_name">Ragione Sociale</Label>
                <Input
                  id="legal_name"
                  value={formData.legal_name}
                  onChange={(e) => handleFieldChange("legal_name", e.target.value)}
                  placeholder="Es. Acme Italia S.r.l."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="vat_number">P.IVA</Label>
                  <Input
                    id="vat_number"
                    value={formData.vat_number}
                    onChange={(e) => handleFieldChange("vat_number", e.target.value)}
                    placeholder="12345678901"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tax_code">Codice Fiscale</Label>
                  <Input
                    id="tax_code"
                    value={formData.tax_code}
                    onChange={(e) => handleFieldChange("tax_code", e.target.value)}
                    placeholder="RSSMRA80A01H501Z"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleFieldChange("email", e.target.value)}
                  placeholder="cliente@email.com"
                />
                {formErrors.email && <p className="text-sm text-destructive">{formErrors.email}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Telefono</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => handleFieldChange("phone", e.target.value)}
                  placeholder="+39 123 456 7890"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address_text">Indirizzo</Label>
                <Textarea
                  id="address_text"
                  value={formData.address_text}
                  onChange={(e) => handleFieldChange("address_text", e.target.value)}
                  placeholder="Via Roma 1, 20100 Milano MI"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Note</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleFieldChange("notes", e.target.value)}
                  placeholder="Note interne..."
                  rows={3}
                />
              </div>

              {editingClient && (
                <div className="flex items-center gap-2 pt-2">
                  <Switch
                    id="active"
                    checked={formData.active}
                    onCheckedChange={(checked) => handleFieldChange("active", checked)}
                  />
                  <Label htmlFor="active" className="cursor-pointer">
                    Cliente attivo
                  </Label>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-4 border-t">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  clearDraft();
                  setDrawerOpen(false);
                }}
              >
                Annulla
              </Button>
              <Button className="flex-1" onClick={validateAndSave} disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salva
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        {/* Deactivate Confirmation */}
        <AlertDialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Disattivare il cliente?</AlertDialogTitle>
              <AlertDialogDescription>
                Il cliente non apparirà più nell'autocomplete degli incassi. I dati storici saranno conservati.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annulla</AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  deactivatingClientId && toggleActiveMutation.mutate({ id: deactivatingClientId, active: false })
                }
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {toggleActiveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Disattiva
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Confirmation */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminare il cliente?</AlertDialogTitle>
              <AlertDialogDescription>
                Questa azione non può essere annullata. Il cliente verrà eliminato permanentemente. Se il cliente ha
                incassi collegati, l'eliminazione fallirà.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annulla</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deletingClientId && deleteMutation.mutate(deletingClientId)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Elimina
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PageContainer>
    </AppLayout>
  );
}
