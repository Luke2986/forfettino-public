import { Card, CardContent } from "@/components/ui/card";
import { Heart } from "lucide-react";

export function MissionStatementCard() {
  return (
    <Card className="bg-gradient-to-br from-teal-50/80 to-white rounded-2xl border border-teal-100/60 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <div className="shrink-0 p-2 rounded-lg bg-teal-100/60">
            <Heart className="h-5 w-5 text-teal-600" />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-800">
              Una lettera da Luca
            </p>
            <div className="text-sm text-slate-600 leading-relaxed space-y-2">
              <p>
                Ciao! Forfettino nasce da un'idea semplice: le tasse non dovrebbero
                essere un incubo per chi lavora in proprio. Ogni giorno lavoro per
                rendere questo strumento più chiaro, più preciso, più utile per te.
              </p>
              <p>
                Ma non posso farlo da solo. Ogni tuo feedback, ogni segnalazione,
                ogni amico che inviti rende Forfettino migliore — non solo per te,
                ma per tutti i freelancer che come te cercano serenità fiscale.
              </p>
              <p>
                Qui sotto trovi i punti che hai guadagnato contribuendo. Non è una
                gara: è il mio modo di dirti{" "}
                <span className="font-medium text-teal-700">grazie</span>.
              </p>
            </div>
            <p className="text-xs text-slate-500 pt-1">
              — Luca, fondatore di Forfettino
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
