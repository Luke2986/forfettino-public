import { percorsoInfortuniSlides, faqInfortuni } from "@/data/protezione-content";
import { PercorsoLayout } from "./PercorsoLayout";

interface PercorsoInfortuniProps {
  onBack: () => void;
  onNavigateToChecklist?: () => void;
}

export function PercorsoInfortuni({ onBack, onNavigateToChecklist }: PercorsoInfortuniProps) {
  return (
    <PercorsoLayout
      title="Non poter lavorare per settimane"
      subtitle="Cosa succede al tuo reddito e come proteggerti"
      slides={percorsoInfortuniSlides}
      faqs={faqInfortuni}
      onBack={onBack}
      onNavigateToChecklist={onNavigateToChecklist}
    />
  );
}
