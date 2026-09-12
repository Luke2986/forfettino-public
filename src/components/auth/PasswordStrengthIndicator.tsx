import { Check, X } from "lucide-react";
import {
  getPasswordStrength,
  PASSWORD_REQUIREMENTS,
} from "@/lib/password-validation";

interface PasswordStrengthIndicatorProps {
  password: string;
  show: boolean;
}

const LEVEL_CONFIG = {
  weak: { label: "Debole", color: "bg-destructive", textColor: "text-destructive" },
  medium: { label: "Media", color: "bg-warning", textColor: "text-warning" },
  strong: { label: "Forte", color: "bg-success", textColor: "text-success" },
} as const;

export function PasswordStrengthIndicator({
  password,
  show,
}: PasswordStrengthIndicatorProps) {
  if (!show || password.length === 0) return null;

  const { score, level, checks } = getPasswordStrength(password);
  const config = LEVEL_CONFIG[level];
  const progressValue = (score / 5) * 100;

  return (
    <div role="status" aria-live="polite" className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Forza password</span>
        <span className={`font-medium ${config.textColor}`}>
          {config.label}
        </span>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={`h-full transition-all duration-300 ${config.color}`}
          style={{ width: `${progressValue}%` }}
        />
      </div>
      <ul className="space-y-1 text-xs">
        {PASSWORD_REQUIREMENTS.map((req) => {
          const met = checks[req.key];
          return (
            <li key={req.key} className="flex items-center gap-1.5">
              {met ? (
                <Check className="h-3 w-3 text-success shrink-0" />
              ) : (
                <X className="h-3 w-3 text-muted-foreground shrink-0" />
              )}
              <span className={met ? "text-success" : "text-muted-foreground"}>
                {req.label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
