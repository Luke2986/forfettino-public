import { useState } from "react";
import { Info, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface UserCodeBlockProps {
  userCode: string | undefined;
}

export function UserCodeBlock({ userCode }: UserCodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  if (!userCode) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(userCode);
      setCopied(true);
      toast({ title: "Codice copiato!" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Impossibile copiare", variant: "destructive" });
    }
  };

  return (
    <div className="mt-3 rounded-lg bg-teal-50/40 border border-teal-100/60 px-3 py-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3.5 w-3.5 text-teal-600/70 shrink-0" />
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Il tuo codice identificativo univoco</p>
            </TooltipContent>
          </Tooltip>
          <span className="text-xs text-teal-600/70">
            Il tuo codice
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 p-0"
          onClick={handleCopy}
          aria-label="Copia codice"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-green-600" />
          ) : (
            <Copy className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </Button>
      </div>
      <p className="font-mono font-bold text-sm text-primary tracking-wider mt-0.5">
        {userCode}
      </p>
    </div>
  );
}
