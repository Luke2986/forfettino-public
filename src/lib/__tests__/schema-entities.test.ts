import { describe, it, expect } from "vitest";
import {
  AUTHOR_PERSON,
  AUTHOR_PERSON_ID,
  AUTHOR_PERSON_REF,
  PUBLISHER_ORGANIZATION,
  PUBLISHER_ORGANIZATION_ID,
  PUBLISHER_ORGANIZATION_REF,
} from "@/lib/schema-entities";

describe("AUTHOR_PERSON", () => {
  it("ha @type Person e @id canonical", () => {
    expect(AUTHOR_PERSON["@type"]).toBe("Person");
    expect(AUTHOR_PERSON["@id"]).toBe(AUTHOR_PERSON_ID);
    expect(AUTHOR_PERSON_ID.startsWith("https://")).toBe(true);
  });

  it("ha name esatto Luca Versilia", () => {
    expect(AUTHOR_PERSON.name).toBe("Luca Versilia");
    expect(AUTHOR_PERSON.givenName).toBe("Luca");
    expect(AUTHOR_PERSON.familyName).toBe("Versilia");
  });

  it("ha jobTitle e description non vuoti", () => {
    expect(AUTHOR_PERSON.jobTitle).toBeTruthy();
    expect(AUTHOR_PERSON.description.length).toBeGreaterThan(20);
  });

  it("knowsAbout contiene almeno 3 topic fiscali", () => {
    expect(AUTHOR_PERSON.knowsAbout.length).toBeGreaterThanOrEqual(3);
    expect(AUTHOR_PERSON.knowsAbout).toContain("Regime forfettario");
  });

  it("url e' https e non 404-prone", () => {
    expect(AUTHOR_PERSON.url.startsWith("https://forfettino.it")).toBe(true);
  });

  it("sameAs e' array (puo' essere vuoto)", () => {
    expect(Array.isArray(AUTHOR_PERSON.sameAs)).toBe(true);
    AUTHOR_PERSON.sameAs.forEach((url) => {
      expect(url.startsWith("https://")).toBe(true);
    });
  });
});

describe("PUBLISHER_ORGANIZATION", () => {
  it("ha @type Organization e @id canonical", () => {
    expect(PUBLISHER_ORGANIZATION["@type"]).toBe("Organization");
    expect(PUBLISHER_ORGANIZATION["@id"]).toBe(PUBLISHER_ORGANIZATION_ID);
  });

  it("logo e' ImageObject con url https e dimensioni numeriche", () => {
    expect(PUBLISHER_ORGANIZATION.logo["@type"]).toBe("ImageObject");
    expect(PUBLISHER_ORGANIZATION.logo.url.startsWith("https://")).toBe(true);
    expect(typeof PUBLISHER_ORGANIZATION.logo.width).toBe("number");
    expect(typeof PUBLISHER_ORGANIZATION.logo.height).toBe("number");
    expect(PUBLISHER_ORGANIZATION.logo.width).toBeGreaterThanOrEqual(112);
  });

  it("foundingDate e' un anno valido", () => {
    expect(PUBLISHER_ORGANIZATION.foundingDate).toMatch(/^\d{4}$/);
  });

  it("founder e' riferimento circolare a Person via @id", () => {
    expect(PUBLISHER_ORGANIZATION.founder["@id"]).toBe(AUTHOR_PERSON_ID);
  });

  it("description non vuota", () => {
    expect(PUBLISHER_ORGANIZATION.description.length).toBeGreaterThan(20);
  });
});

describe("REF helpers", () => {
  it("AUTHOR_PERSON_REF punta allo stesso @id di AUTHOR_PERSON", () => {
    expect(AUTHOR_PERSON_REF["@id"]).toBe(AUTHOR_PERSON["@id"]);
  });

  it("PUBLISHER_ORGANIZATION_REF punta allo stesso @id di PUBLISHER_ORGANIZATION", () => {
    expect(PUBLISHER_ORGANIZATION_REF["@id"]).toBe(PUBLISHER_ORGANIZATION["@id"]);
  });
});
