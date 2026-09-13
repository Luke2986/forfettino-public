# Contributing

Grazie per l'interesse. Prima di aprire una PR, tieni presente il contesto di questo repo.

## Cos'è questo repo

Uno snapshot pubblico del codice di Forfettino, rilasciato con licenza [PolyForm Noncommercial 1.0.0](LICENSE) a scopo di portfolio e community. **Non è sincronizzato** con il repository privato dove vive il prodotto live: le modifiche qui non arrivano automaticamente in produzione, e le modifiche in produzione non vengono automaticamente riportate qui.

Di conseguenza:
- Le PR sono benvenute (fix, miglioramenti, idee), ma **non c'è garanzia di merge** — la manutenzione di questo mirror è a discrezione del maintainer e potrebbe non essere costante.
- Non aspettarti una roadmap pubblica o un ciclo di review formale.
- Per bug/feature del prodotto live, questo repo non è il canale giusto.

## Come contribuire

1. Apri una issue per discutere il cambiamento prima di investire tempo in una PR grossa.
2. Fork + branch descrittivo (`fix/...`, `feat/...`).
3. Segui lo stile del codice esistente (TypeScript, componenti in `src/components`, funzioni fiscali pure in `src/lib`).
4. `npm test` deve passare prima di aprire la PR.
5. Descrivi nella PR cosa cambia e perché.

## Setup locale

Vedi [README.md](README.md) — sezione Configurazione e Sviluppo locale.
