import { AppLayout } from "@/components/layout/AppLayout";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

const SUPPORT_EMAIL = "info@forfettino.it";

export default function SupportoPage() {
  const isMobile = useIsMobile();

  return (
    <AppLayout>
      {isMobile && <MobileHeader title="Supporto" />}
      <div className="p-6 space-y-6">
        {/* Header - desktop only */}
        <div className="hidden md:block">
          <h1 className="text-2xl font-bold text-foreground">Supporto</h1>
          <p className="text-muted-foreground">
            Contattaci per qualsiasi domanda o problema
          </p>
        </div>

        {/* Intro text */}
        <p className="text-muted-foreground">
          Hai bisogno di aiuto o vuoi segnalarci qualcosa? 
          Scrivici e ti risponderemo il prima possibile.
        </p>

        {/* Email Card */}
        <Card>
          <CardContent className="p-6 flex flex-col items-center gap-4 text-center">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            
            <p className="text-sm text-muted-foreground">
              Clicca sull'indirizzo per aprire il tuo client email
            </p>
            
            <a 
              href={`mailto:${SUPPORT_EMAIL}`}
              className="text-lg font-medium text-primary hover:underline"
            >
              {SUPPORT_EMAIL}
            </a>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
