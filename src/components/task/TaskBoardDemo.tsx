/**
 * TaskBoardDemo — Layout Kanban statico per utenti Free.
 * Mostra 3 colonne con card placeholder, senza hook, query DB, o @dnd-kit.
 * Usato sotto ProGateOverlay per dare un'anteprima visiva della feature.
 */

const DEMO_COLUMNS = [
  {
    title: "Da fare",
    emoji: "⚫",
    cards: [
      { title: "Inviare fattura Q1", priority: "alta" as const, labels: [{ name: "fatture", color: "#3b82f6" }] },
      { title: "Aggiornare portfolio", priority: "media" as const, labels: [{ name: "marketing", color: "#a855f7" }] },
    ],
  },
  {
    title: "In corso",
    emoji: "🚀",
    cards: [
      { title: "Revisione contratto", priority: "alta" as const, labels: [{ name: "clienti", color: "#f59e0b" }] },
    ],
  },
  {
    title: "Completato",
    emoji: "🌟",
    cards: [
      { title: "Dichiarazione redditi", priority: "media" as const, labels: [{ name: "fiscale", color: "#10b981" }] },
    ],
  },
];

const PRIORITY_DOT: Record<string, string> = {
  alta: "bg-red-500",
  media: "bg-amber-400",
  bassa: "bg-slate-300",
};

export function TaskBoardDemo() {
  return (
    <div
      className="min-h-[400px] w-full bg-cover bg-center"
      style={{ backgroundImage: `url('/images/sky-bg.png')` }}
    >
      <div className="flex gap-4 overflow-x-auto p-4 h-full">
        {DEMO_COLUMNS.map((col) => (
          <div
            key={col.title}
            className="glass-panel rounded-2xl min-w-[260px] flex-1 flex flex-col"
          >
            {/* Column header */}
            <div className="p-3 pb-2">
              <h3 className="font-bold text-sm text-foreground uppercase tracking-wide px-1">
                {col.emoji} {col.title}{" "}
                <span className="text-muted-foreground font-normal">
                  ({col.cards.length})
                </span>
              </h3>
            </div>

            {/* Cards */}
            <div className="flex-1 px-3 py-1 space-y-3">
              {col.cards.map((card) => (
                <div
                  key={card.title}
                  className="bg-white rounded-xl p-3 shadow-sm border border-black/[0.05]"
                >
                  {/* Label strip */}
                  <div className="flex flex-wrap gap-1 mb-2">
                    {card.labels.map((label) => (
                      <span
                        key={label.name}
                        className="h-2 w-10 rounded-full"
                        style={{ backgroundColor: label.color }}
                      />
                    ))}
                  </div>

                  {/* Title */}
                  <p className="text-sm font-medium text-slate-800 leading-snug mb-2">
                    {card.title}
                  </p>

                  {/* Priority dot */}
                  <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
                    <span
                      className={`h-2 w-2 rounded-full ${PRIORITY_DOT[card.priority]}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
