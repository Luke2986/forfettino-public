import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, AlertTriangle, CheckCircle2, Users } from "lucide-react";
import { useAdminAwardContribution } from "@/hooks/useAdminAwardContribution";
import { useActiveUserCount } from "@/hooks/useActiveUserCount";
import { useValidateUserCode } from "@/hooks/useValidateUserCode";
import { useActionConfig } from "@/hooks/useActionConfig";
import { useToast } from "@/hooks/use-toast";

interface AdminAwardPointsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type TargetMode = "single" | "all";
type PointsMode = "config" | "manual";

export function AdminAwardPointsDialog({
  open,
  onOpenChange,
}: AdminAwardPointsDialogProps) {
  // Form state
  const [targetMode, setTargetMode] = useState<TargetMode>("single");
  const [userCode, setUserCode] = useState("");
  const [pointsMode, setPointsMode] = useState<PointsMode>("config");
  const [selectedAction, setSelectedAction] = useState("");
  const [manualPoints, setManualPoints] = useState("");
  const [reason, setReason] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  // Hooks
  const { data: configs } = useActionConfig();
  const { data: activeUserCount } = useActiveUserCount();
  const validateQuery = useValidateUserCode(targetMode === "single" ? userCode : "");
  const awardMutation = useAdminAwardContribution();
  const { toast } = useToast();

  // Derived
  const selectedConfig = configs?.find((c) => c.actionType === selectedAction);
  const resolvedPoints =
    pointsMode === "config"
      ? selectedConfig?.points ?? 0
      : parseInt(manualPoints, 10) || 0;
  const resolvedActionType =
    pointsMode === "config" ? selectedAction : "admin_manual";

  // Validation
  const isUserCodeValid =
    targetMode === "all" ||
    (validateQuery.data?.found === true && userCode.trim().length >= 3);
  const isPointsValid =
    pointsMode === "config"
      ? !!selectedAction && resolvedPoints > 0
      : resolvedPoints > 0 && resolvedPoints <= 9999;
  const isReasonValid =
    pointsMode === "config" || reason.trim().length > 0;
  const canProceed = isUserCodeValid && isPointsValid && isReasonValid;

  const resetForm = () => {
    setTargetMode("single");
    setUserCode("");
    setPointsMode("config");
    setSelectedAction("");
    setManualPoints("");
    setReason("");
    setShowConfirm(false);
  };

  const handleClose = (val: boolean) => {
    if (!val) resetForm();
    onOpenChange(val);
  };

  const handleConfirm = () => {
    awardMutation.mutate(
      {
        userCode: targetMode === "single" ? userCode.trim().toUpperCase() : undefined,
        actionType: resolvedActionType,
        points: pointsMode === "manual" ? resolvedPoints : undefined,
        reason: reason.trim() || undefined,
        allUsers: targetMode === "all",
      },
      {
        onSuccess: (count) => {
          toast({
            title: "Punti assegnati",
            description:
              targetMode === "all"
                ? `${resolvedPoints} punti assegnati a ${count} utenti.`
                : `${resolvedPoints} punti assegnati a ${validateQuery.data?.firstName ?? userCode}.`,
          });
          handleClose(false);
        },
        onError: (err: Error) => {
          toast({
            title: "Errore",
            description: err.message ?? "Impossibile assegnare punti",
            variant: "destructive",
          });
          setShowConfirm(false);
        },
      },
    );
  };

  // --- Confirmation Step ---
  if (showConfirm) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Conferma assegnazione
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-sm">
            <div className="rounded-md bg-slate-50 p-3 space-y-1.5">
              <p>
                <span className="text-muted-foreground">Destinatario:</span>{" "}
                <strong>
                  {targetMode === "all"
                    ? `Tutti gli utenti attivi (${activeUserCount ?? "…"})`
                    : `${validateQuery.data?.firstName ?? "—"} (${userCode.trim().toUpperCase()})`}
                </strong>
              </p>
              <p>
                <span className="text-muted-foreground">Tipo:</span>{" "}
                <strong>
                  {pointsMode === "config"
                    ? selectedConfig?.label ?? selectedAction
                    : "Punti manuali"}
                </strong>
              </p>
              <p>
                <span className="text-muted-foreground">Punti:</span>{" "}
                <strong>{resolvedPoints}</strong>
              </p>
              {reason.trim() && (
                <p>
                  <span className="text-muted-foreground">Motivo:</span>{" "}
                  {reason.trim()}
                </p>
              )}
            </div>

            {targetMode === "all" && (
              <p className="text-amber-600 text-xs flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                Questa azione assegnerà punti a tutti gli utenti attivi. Non reversibile.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirm(false)}
              disabled={awardMutation.isPending}
            >
              Indietro
            </Button>
            <Button onClick={handleConfirm} disabled={awardMutation.isPending}>
              {awardMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              )}
              Conferma
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // --- Main Form ---
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assegna Punti</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* --- Destinatario --- */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Destinatario
            </Label>
            <RadioGroup
              value={targetMode}
              onValueChange={(v) => setTargetMode(v as TargetMode)}
              className="flex gap-4"
            >
              <div className="flex items-center gap-2 min-h-[44px]">
                <RadioGroupItem value="single" id="target-single" />
                <Label htmlFor="target-single" className="cursor-pointer text-sm">
                  Singolo utente
                </Label>
              </div>
              <div className="flex items-center gap-2 min-h-[44px]">
                <RadioGroupItem value="all" id="target-all" />
                <Label htmlFor="target-all" className="cursor-pointer text-sm flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  Tutti ({activeUserCount ?? "…"})
                </Label>
              </div>
            </RadioGroup>

            {targetMode === "single" && (
              <div className="space-y-1.5">
                <Input
                  placeholder="Codice utente (es. AB26XYZ12)"
                  value={userCode}
                  onChange={(e) => setUserCode(e.target.value)}
                  className="font-mono uppercase"
                />
                {userCode.trim().length >= 3 && (
                  <div className="text-xs">
                    {validateQuery.isLoading ? (
                      <span className="text-muted-foreground">Verifica...</span>
                    ) : validateQuery.data?.found ? (
                      <span className="text-green-600 flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {validateQuery.data.firstName}
                      </span>
                    ) : (
                      <span className="text-red-500">Codice non trovato</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* --- Tipo Punti --- */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Tipo punti
            </Label>
            <RadioGroup
              value={pointsMode}
              onValueChange={(v) => {
                setPointsMode(v as PointsMode);
                setSelectedAction("");
                setManualPoints("");
              }}
              className="flex gap-4"
            >
              <div className="flex items-center gap-2 min-h-[44px]">
                <RadioGroupItem value="config" id="points-config" />
                <Label htmlFor="points-config" className="cursor-pointer text-sm">
                  Da configurazione
                </Label>
              </div>
              <div className="flex items-center gap-2 min-h-[44px]">
                <RadioGroupItem value="manual" id="points-manual" />
                <Label htmlFor="points-manual" className="cursor-pointer text-sm">
                  Manuale
                </Label>
              </div>
            </RadioGroup>

            {pointsMode === "config" ? (
              <div className="space-y-1.5">
                <Select value={selectedAction} onValueChange={setSelectedAction}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona azione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {configs
                      ?.filter((c) => c.actionType !== "admin_manual")
                      .map((c) => (
                        <SelectItem key={c.actionType} value={c.actionType}>
                          {c.label} ({c.points} pt)
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {selectedConfig && (
                  <p className="text-xs text-muted-foreground">
                    Frequenza: {selectedConfig.frequencyLabel}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Input
                  type="number"
                  min={1}
                  max={9999}
                  placeholder="Punti (1–9999)"
                  value={manualPoints}
                  onChange={(e) => setManualPoints(e.target.value)}
                />
                <Input
                  placeholder="Motivo (obbligatorio)"
                  value={reason}
                  onChange={(e) => setReason(e.target.value.slice(0, 200))}
                  maxLength={200}
                />
                <p className="text-xs text-muted-foreground">
                  {reason.length}/200 caratteri
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            Annulla
          </Button>
          <Button onClick={() => setShowConfirm(true)} disabled={!canProceed}>
            Avanti
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
