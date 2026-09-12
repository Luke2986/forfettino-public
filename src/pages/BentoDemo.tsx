import {
  Calculator,
  CalendarClock,
  PiggyBank,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { BentoCard, BentoGrid } from "@/components/ui/bento-grid";

const features = [
  {
    Icon: Calculator,
    name: "Netto Spendibile",
    description:
      "Sai sempre quanto puoi davvero spendere. Aggiornato in tempo reale ad ogni incasso.",
    href: "/dashboard",
    cta: "Vai alla Dashboard",
    background: (
      <div className="absolute inset-0 bg-gradient-to-br from-teal-50 to-teal-100/50 opacity-60" />
    ),
    className: "lg:row-start-1 lg:row-end-4 lg:col-start-2 lg:col-end-3",
  },
  {
    Icon: PiggyBank,
    name: "Accantonamenti",
    description:
      "Calcolo automatico di tasse e contributi INPS da mettere da parte.",
    href: "/dashboard",
    cta: "Scopri di più",
    background: (
      <div className="absolute inset-0 bg-gradient-to-br from-amber-50 to-orange-50/50 opacity-60" />
    ),
    className: "lg:col-start-1 lg:col-end-2 lg:row-start-1 lg:row-end-3",
  },
  {
    Icon: ShieldCheck,
    name: "Soglia 85k",
    description:
      "Monitoraggio in tempo reale per restare nel regime forfettario.",
    href: "/dashboard",
    cta: "Controlla",
    background: (
      <div className="absolute inset-0 bg-gradient-to-br from-sky-50 to-blue-50/50 opacity-60" />
    ),
    className: "lg:col-start-1 lg:col-end-2 lg:row-start-3 lg:row-end-4",
  },
  {
    Icon: CalendarClock,
    name: "Scadenze Fiscali",
    description: "Notifiche puntuali per non dimenticare mai un F24.",
    href: "/scadenziario",
    cta: "Vedi scadenze",
    background: (
      <div className="absolute inset-0 bg-gradient-to-br from-violet-50 to-purple-50/50 opacity-60" />
    ),
    className: "lg:col-start-3 lg:col-end-3 lg:row-start-1 lg:row-end-2",
  },
  {
    Icon: TrendingUp,
    name: "Proiezione Annuale",
    description:
      "Stima di quanto incasserai e quanto dovrai pagare a fine anno, basata sui tuoi dati reali.",
    href: "/dashboard",
    cta: "Vai ai dati",
    background: (
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 to-green-50/50 opacity-60" />
    ),
    className: "lg:col-start-3 lg:col-end-3 lg:row-start-2 lg:row-end-4",
  },
];

export default function BentoDemo() {
  return (
    <div className="min-h-screen bg-slate-50 p-6 sm:p-10">
      <div className="mx-auto max-w-5xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">
            Bento Grid — Demo
          </h1>
          <p className="text-slate-500 text-sm">
            Componente riutilizzabile da <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">src/components/ui/bento-grid.tsx</code>
          </p>
        </div>

        {/* Bento Grid */}
        <BentoGrid className="lg:grid-rows-3">
          {features.map((feature) => (
            <BentoCard key={feature.name} {...feature} />
          ))}
        </BentoGrid>
      </div>
    </div>
  );
}
