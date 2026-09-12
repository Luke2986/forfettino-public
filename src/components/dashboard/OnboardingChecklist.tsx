import { useOnboardingChecklist } from "@/hooks/useOnboardingChecklist";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle } from "lucide-react";
import { trackAnonymous, ANALYTICS_EVENTS } from "@/lib/analytics";

export function OnboardingChecklist() {
  const { items, percentage, isComplete, isDismissed, isLoading, dismiss } =
    useOnboardingChecklist();

  // Non renderizzare in stati non visibili
  if (isLoading || isDismissed || items.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">
            Il tuo progresso
          </CardTitle>
          <span className="text-sm font-medium text-muted-foreground">
            {percentage}%
          </span>
        </div>
        <Progress
          value={percentage}
          className="mt-2"
          aria-label={`Progresso onboarding: ${percentage}%`}
        />
      </CardHeader>
      <CardContent className="pt-0">
        <ul role="list" className="space-y-2">
          {items.map((item) => (
            <li key={item.id} role="listitem" data-testid={`checklist-${item.id}`} className="flex items-center gap-2 text-sm">
              {item.completed ? (
                <CheckCircle2
                  className="h-4 w-4 text-emerald-600 shrink-0"
                  aria-hidden="true"
                />
              ) : (
                <Circle
                  className="h-4 w-4 text-muted-foreground shrink-0"
                  aria-hidden="true"
                />
              )}
              <span
                className={
                  item.completed
                    ? "text-foreground"
                    : "text-muted-foreground"
                }
              >
                {item.label}
              </span>
            </li>
          ))}
        </ul>

        {isComplete && (
          <div className="mt-4 flex items-center justify-between border-t pt-3">
            <span className="text-sm font-medium text-emerald-600">
              🎉 Tutto pronto!
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                trackAnonymous(ANALYTICS_EVENTS.CHECKLIST_DISMISSED);
                dismiss();
              }}
              className="min-h-[44px] min-w-[44px]"
            >
              Chiudi
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
