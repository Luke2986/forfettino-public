import { percorsoRcSlides, faqRc } from "@/data/protezione-content";
import { PercorsoLayout } from "./PercorsoLayout";

interface PercorsoRcProfessionaleProps {
  onBack: () => void;
  onNavigateToChecklist?: () => void;
}

export function PercorsoRcProfessionale({ onBack, onNavigateToChecklist }: PercorsoRcProfessionaleProps) {
  return (
    <PercorsoLayout
      title="Un cliente che mi fa causa"
      subtitle="Cos'è la RC Professionale e quando serve davvero"
      slides={percorsoRcSlides}
      faqs={faqRc}
      onBack={onBack}
      onNavigateToChecklist={onNavigateToChecklist}
    />
  );
}
