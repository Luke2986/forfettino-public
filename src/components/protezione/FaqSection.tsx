import type { FaqItem } from "@/data/protezione-content";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface FaqSectionProps {
  title?: string;
  faqs: FaqItem[];
}

/**
 * Sezione FAQ collassabili con Accordion shadcn.
 * Riutilizzabile per ogni percorso (Infortuni, RC, ecc.).
 */
export function FaqSection({ title = "Domande frequenti", faqs }: FaqSectionProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
      <Accordion type="single" collapsible className="w-full">
        {faqs.map((faq) => (
          <AccordionItem key={faq.question} value={faq.question}>
            <AccordionTrigger className="text-left text-sm font-medium text-slate-700">
              {faq.question}
            </AccordionTrigger>
            <AccordionContent className="text-sm text-slate-600 leading-relaxed">
              {faq.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
