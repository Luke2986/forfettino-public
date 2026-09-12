/**
 * Schema.org canonical entities — single source of truth per @graph JSON-LD
 * condiviso tra BlogPost, Landing e (in futuro) pagine /chi-siamo, /faq, /glossario.
 *
 * Pattern E-E-A-T: Person come author (driver #6 Searchmetrics 2025 — Expert
 * Attribution, +2.8x citation rate per Walker Sands 2025). Organization come
 * publisher con @id stabile cross-page per dedupe schema.org.
 *
 * ZERO invenzione: ogni campo `sameAs` deve puntare a URL reali verificati.
 * Array vuoto e' preferibile a URL fake (Google sanziona schema spoofing).
 */

export const AUTHOR_PERSON_ID = "https://forfettino.it/#person-luca-versilia" as const;
export const PUBLISHER_ORGANIZATION_ID = "https://forfettino.it/#organization" as const;

export const AUTHOR_PERSON = {
  "@type": "Person",
  "@id": AUTHOR_PERSON_ID,
  name: "Luca Versilia",
  givenName: "Luca",
  familyName: "Versilia",
  url: "https://forfettino.it/",
  jobTitle: "Fondatore di Forfettino",
  description:
    "Fondatore di Forfettino, gestionale gratuito per freelancer in regime forfettario. Esperto di fisco italiano per P.IVA forfettarie.",
  knowsAbout: [
    "Regime forfettario",
    "Partita IVA",
    "Contributi INPS",
    "Imposta sostitutiva",
    "Fatturazione elettronica",
  ],
  sameAs: [] as string[],
} as const;

export const PUBLISHER_ORGANIZATION = {
  "@type": "Organization",
  "@id": PUBLISHER_ORGANIZATION_ID,
  name: "Forfettino",
  url: "https://forfettino.it",
  logo: {
    "@type": "ImageObject",
    url: "https://forfettino.it/logo-192.png",
    width: 192,
    height: 192,
  },
  description:
    "Gestionale online gratuito per professionisti in Regime Forfettario. Alternativa gratuita a Fiscozen, Finom e Fatture in Cloud.",
  foundingDate: "2026",
  founder: { "@id": AUTHOR_PERSON_ID },
  sameAs: [] as string[],
} as const;

/** Reference shorthand per nodi @graph che puntano ad author/publisher via @id. */
export const AUTHOR_PERSON_REF = { "@id": AUTHOR_PERSON_ID } as const;
export const PUBLISHER_ORGANIZATION_REF = { "@id": PUBLISHER_ORGANIZATION_ID } as const;
