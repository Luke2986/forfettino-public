/** Trigger key → human-readable label mapping for NPS admin UI */
export const TRIGGER_LABELS: Record<string, string> = {
  third_receipt: "3\u00B0 incasso registrato",
  wizard_plus_receipt: "Completamento wizard + primo incasso",
  "30days_active": "30 giorni di attivit\u00E0",
  calendar_2nd_visit: "2a visita al calendario",
  milestone_reached: "Raggiungimento milestone/traguardo",
  post_deadline: "Post-scadenza fiscale",
};

export const REPEAT_OPTIONS = [
  { value: "never", label: "Mai (una tantum)" },
  { value: "3m", label: "Ogni 3 mesi" },
  { value: "6m", label: "Ogni 6 mesi" },
  { value: "12m", label: "Ogni 12 mesi" },
] as const;
