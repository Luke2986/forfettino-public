import { PricingCards } from "@/components/shared/PricingCards";

export function PricingSection() {
  return (
    <section id="prezzi" className="border-t border-white/10 py-20">
      <div className="mx-auto max-w-7xl px-4">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-foreground md:text-4xl">
            Quanto costa Forfettino e cosa include il piano gratuito per i forfettari italiani?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Forfettino è gratis per sempre: dashboard fiscale, registrazione incassi, scadenziario F24, netto spendibile giornaliero, zero carta di credito.
          </p>
        </div>

        <div className="mt-12">
          <PricingCards variant="landing" />
        </div>
      </div>
    </section>
  );
}
