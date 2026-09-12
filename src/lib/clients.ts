/**
 * clients — Risoluzione cliente per nome (find-or-create)
 *
 * Condiviso tra inserimento incasso (NuovoIncasso), modifica incasso (Incassi)
 * e import fatture (useImportFatture).
 *
 * Story 86-1. Prima di questa story la logica viveva inline nel solo submit di
 * NuovoIncasso: ogni altro percorso scriveva client_name senza client_id,
 * lasciando gli incassi invisibili al report clienti (GROUP BY r.client_id).
 */
import { supabase } from "@/integrations/supabase/client";

/**
 * Risolve un nome cliente nel corrispondente client_id, creandolo se assente.
 *
 * Il match e' case-insensitive e ignora gli spazi ai bordi.
 *
 * Cerca su TUTTI i clienti dell'utente, inclusi i disattivati (D7): il lookup
 * limitato ai soli `active` era il generatore deterministico di duplicati —
 * un cliente disattivato con lo stesso nome non veniva trovato e ne nasceva
 * una copia. Il dropdown continua a mostrare solo gli attivi.
 *
 * Omonimi: il prodotto li permette di proposito (Clienti.tsx avvisa ma non
 * blocca — due entita' legali possono condividere il display name), quindi
 * non esiste un vincolo di unicita' a livello DB. A parita' di nome vince il
 * piu' vecchio, per rendere la risoluzione deterministica.
 *
 * @param userId utente proprietario del catalogo
 * @param name nome cliente digitato o selezionato
 * @returns client_id, oppure null se il nome e' vuoto
 */
export async function resolveClientId(
  userId: string,
  name: string,
): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  // ilike senza wildcard = uguaglianza case-insensitive
  const { data: existing, error: lookupError } = await supabase
    .from("clients")
    .select("id")
    .eq("user_id", userId)
    .ilike("display_name", trimmed)
    .order("created_at", { ascending: true })
    .limit(1);

  if (lookupError) throw lookupError;
  if (existing && existing.length > 0) return existing[0].id;

  // `name` e' legacy ma NOT NULL: va valorizzato insieme a display_name
  const { data: created, error: insertError } = await supabase
    .from("clients")
    .insert({
      user_id: userId,
      name: trimmed,
      display_name: trimmed,
      active: true,
    })
    .select("id")
    .single();

  if (insertError) throw insertError;
  return created.id;
}
