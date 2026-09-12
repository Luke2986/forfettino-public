import { lazy, ComponentType } from "react";

/**
 * Wrapper attorno a React.lazy che ritenta il caricamento del chunk
 * in caso di errore (es. network hiccup, CDN propagation delay).
 *
 * Dopo il numero massimo di tentativi, ricarica la pagina intera
 * (una sola volta) per ottenere l'HTML aggiornato con i nuovi hash dei chunk.
 */
export function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
  retries = 2,
): ReturnType<typeof lazy<T>> {
  return lazy<T>(() => retryImport(factory, retries));
}

async function retryImport<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
  retries: number,
): Promise<{ default: T }> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await factory();
    } catch (error) {
      // Last retry failed — try a full page reload (once per session)
      if (attempt === retries) {
        const reloadKey = "forfettino:chunk-reload";
        if (!sessionStorage.getItem(reloadKey)) {
          sessionStorage.setItem(reloadKey, "1");
          window.location.reload();
          // Return a never-resolving promise while the page reloads
          return new Promise(() => {});
        }
        // Already tried reloading once — throw the original error
        throw error;
      }
      // Wait briefly before retrying (100ms, 200ms)
      await new Promise((r) => setTimeout(r, (attempt + 1) * 100));
    }
  }
  // Unreachable, but TS needs it
  throw new Error("Failed to load module");
}
