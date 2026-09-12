/**
 * Test per AppSidebar nav items export
 * Copertura:
 * - struttura array per sezione (gestione, pianificazione, strumenti, supporto)
 * - children collapsible (Clienti con Report Fatturato)
 * - proOnly/adminOnly filtering logic
 * - impostazioniNavItem standalone
 * - ordine voci per sezione
 */

import { describe, it, expect } from "vitest";
import {
  gestioneNavItems,
  pianificazioneNavItems,
  strumentiNavItems,
  supportoNavItems,
  supportoParentItem,
  impostazioniNavItem,
  dashboardNavItem,
  messaggiNavItem,
} from "./AppSidebar";

describe("AppSidebar nav items", () => {
  // ── GESTIONE ──
  describe("gestioneNavItems", () => {
    it("contiene Incassi, Clienti, Costi (senza Scadenziario — spostato in pianificazione)", () => {
      const titles = gestioneNavItems.map((item) => item.title);
      expect(titles).toEqual(["Incassi", "Clienti", "Costi"]);
    });

    it("Clienti ha 2 children: I miei Clienti e Report Fatturato (proOnly)", () => {
      const clienti = gestioneNavItems.find((item) => item.title === "Clienti");
      expect(clienti).toBeDefined();
      expect(clienti!.children).toBeDefined();
      expect(clienti!.children).toHaveLength(2);
      expect(clienti!.children![0].title).toBe("I miei Clienti");
      expect(clienti!.children![0].url).toBe("/clienti");
      expect(clienti!.children![1].title).toBe("Report Fatturato");
      expect(clienti!.children![1].proOnly).toBe(true);
    });

    it("Incassi e Costi NON hanno children", () => {
      const incassi = gestioneNavItems.find((item) => item.title === "Incassi");
      const costi = gestioneNavItems.find((item) => item.title === "Costi");
      expect(incassi!.children).toBeUndefined();
      expect(costi!.children).toBeUndefined();
    });

    it("tutte le voci hanno section 'gestione'", () => {
      gestioneNavItems.forEach((item) => {
        expect(item.section).toBe("gestione");
      });
    });
  });

  // ── PIANIFICAZIONE ──
  describe("pianificazioneNavItems", () => {
    it("contiene Scadenziario, Calendario e Task", () => {
      const titles = pianificazioneNavItems.map((item) => item.title);
      expect(titles).toEqual(["Scadenziario", "Calendario", "Task"]);
    });

    it("tutte le voci hanno section 'pianificazione'", () => {
      pianificazioneNavItems.forEach((item) => {
        expect(item.section).toBe("pianificazione");
      });
    });

    it("Scadenziario punta a /scadenziario", () => {
      const scad = pianificazioneNavItems.find((item) => item.title === "Scadenziario");
      expect(scad!.url).toBe("/scadenziario");
    });

    it("Calendario punta a /calendario", () => {
      const cal = pianificazioneNavItems.find((item) => item.title === "Calendario");
      expect(cal!.url).toBe("/calendario");
    });

    it("Task punta a /task con proOnly=true", () => {
      const task = pianificazioneNavItems.find((item) => item.title === "Task");
      expect(task).toBeDefined();
      expect(task!.url).toBe("/task");
      expect(task!.proOnly).toBe(true);
    });

    it("filtro proOnly nasconde Task per utente free non-admin", () => {
      const isAdmin = false;
      const isPro = false;
      const filtered = pianificazioneNavItems.filter((item) => (!item.adminOnly || isAdmin) && (!item.proOnly || isPro || isAdmin));
      const titles = filtered.map((item) => item.title);
      expect(titles).toEqual(["Scadenziario", "Calendario"]);
      expect(titles).not.toContain("Task");
    });

    it("filtro proOnly mostra Task per utente Pro", () => {
      const isAdmin = false;
      const isPro = true;
      const filtered = pianificazioneNavItems.filter((item) => (!item.adminOnly || isAdmin) && (!item.proOnly || isPro || isAdmin));
      const titles = filtered.map((item) => item.title);
      expect(titles).toContain("Task");
    });

    it("filtro proOnly mostra Task per admin anche se non Pro", () => {
      const isAdmin = true;
      const isPro = false;
      const filtered = pianificazioneNavItems.filter((item) => (!item.adminOnly || isAdmin) && (!item.proOnly || isPro || isAdmin));
      const titles = filtered.map((item) => item.title);
      expect(titles).toContain("Task");
    });
  });

  // ── STRUMENTI ──
  describe("strumentiNavItems", () => {
    it("NON contiene Calendario, Impostazioni, Report Fatturato (spostati)", () => {
      const titles = strumentiNavItems.map((item) => item.title);
      expect(titles).not.toContain("Calendario");
      expect(titles).not.toContain("Impostazioni");
      expect(titles).not.toContain("Report Fatturato");
    });

    it("contiene Il tuo contributo, Comparatore, Allocazione, Guide per te", () => {
      const titles = strumentiNavItems.map((item) => item.title);
      expect(titles).toEqual(["Il tuo contributo", "Comparatore", "Allocazione", "Guide per te"]);
    });

    it("Comparatore e Allocazione hanno proOnly=true", () => {
      const comparatore = strumentiNavItems.find((item) => item.title === "Comparatore");
      const allocazione = strumentiNavItems.find((item) => item.title === "Allocazione");
      expect(comparatore!.proOnly).toBe(true);
      expect(allocazione!.proOnly).toBe(true);
    });

    it("filtro proOnly nasconde Comparatore e Allocazione per utente free non-admin", () => {
      const isAdmin = false;
      const isPro = false;
      const filtered = strumentiNavItems.filter((item) => (!item.adminOnly || isAdmin) && (!item.proOnly || isPro || isAdmin));
      const titles = filtered.map((item) => item.title);
      expect(titles).toContain("Il tuo contributo");
      expect(titles).not.toContain("Comparatore");
      expect(titles).not.toContain("Allocazione");
    });

    it("filtro mostra tutti gli item per admin", () => {
      const isAdmin = true;
      const isPro = false;
      const filtered = strumentiNavItems.filter((item) => (!item.adminOnly || isAdmin) && (!item.proOnly || isPro || isAdmin));
      const titles = filtered.map((item) => item.title);
      expect(titles).toEqual(["Il tuo contributo", "Comparatore", "Allocazione", "Guide per te"]);
    });

    it("filtro mostra proOnly per utente Pro", () => {
      const isAdmin = false;
      const isPro = true;
      const filtered = strumentiNavItems.filter((item) => (!item.adminOnly || isAdmin) && (!item.proOnly || isPro || isAdmin));
      const titles = filtered.map((item) => item.title);
      expect(titles).toContain("Comparatore");
      expect(titles).toContain("Allocazione");
    });
  });

  // ── IMPOSTAZIONI standalone ──
  describe("impostazioniNavItem", () => {
    it("esiste come NavItem standalone", () => {
      expect(impostazioniNavItem).toBeDefined();
      expect(impostazioniNavItem.title).toBe("Impostazioni");
      expect(impostazioniNavItem.url).toBe("/impostazioni");
    });
  });

  // ── SUPPORTO ──
  describe("supportoNavItems", () => {
    it("contiene Scrivi feedback e Centro Assistenza", () => {
      const titles = supportoNavItems.map((item) => item.title);
      expect(titles).toEqual(["Scrivi feedback", "Centro Assistenza"]);
    });

    it("tutte le voci hanno section 'supporto'", () => {
      supportoNavItems.forEach((item) => {
        expect(item.section).toBe("supporto");
      });
    });
  });

  // ── STANDALONE items ──
  describe("standalone items", () => {
    it("dashboardNavItem ha section 'dashboard'", () => {
      expect(dashboardNavItem.section).toBe("dashboard");
      expect(dashboardNavItem.url).toBe("/dashboard");
    });

    it("messaggiNavItem ha section 'messaggi'", () => {
      expect(messaggiNavItem.section).toBe("messaggi");
      expect(messaggiNavItem.url).toBe("/messaggi");
    });
  });

  // ── children proOnly filtering ──
  describe("children filtering", () => {
    it("filtro proOnly sui children di Clienti mostra solo I miei Clienti per free user", () => {
      const clienti = gestioneNavItems.find((item) => item.title === "Clienti")!;
      const isAdmin = false;
      const isPro = false;
      const visibleChildren = clienti.children!.filter((child) => (!child.adminOnly || isAdmin) && (!child.proOnly || isPro || isAdmin));
      expect(visibleChildren).toHaveLength(1);
      expect(visibleChildren[0].title).toBe("I miei Clienti");
    });

    it("filtro proOnly sui children di Clienti mostra tutti per Pro user", () => {
      const clienti = gestioneNavItems.find((item) => item.title === "Clienti")!;
      const isAdmin = false;
      const isPro = true;
      const visibleChildren = clienti.children!.filter((child) => (!child.adminOnly || isAdmin) && (!child.proOnly || isPro || isAdmin));
      expect(visibleChildren).toHaveLength(2);
      expect(visibleChildren.map((c) => c.title)).toEqual(["I miei Clienti", "Report Fatturato"]);
    });
  });

  // ── SUPPORTO PARENT (collapsible, story 57.2) ──
  describe("supportoParentItem", () => {
    it("ha section 'supporto' e url '/supporto'", () => {
      expect(supportoParentItem.section).toBe("supporto");
      expect(supportoParentItem.url).toBe("/supporto");
    });

    it("ha 4 children: Scrivi feedback, Centro Assistenza, Call, Valuta Forfettino", () => {
      expect(supportoParentItem.children).toBeDefined();
      const titles = supportoParentItem.children!.map((c) => c.title);
      expect(titles).toEqual(["Scrivi feedback", "Centro Assistenza", "Call", "Valuta Forfettino"]);
    });

    it("Call ha external=true", () => {
      const call = supportoParentItem.children!.find((c) => c.title === "Call");
      expect(call).toBeDefined();
      expect(call!.external).toBe(true);
      expect(call!.url).toContain("calendly.com");
    });

    it("Valuta Forfettino ha conditional=true", () => {
      const valuta = supportoParentItem.children!.find((c) => c.title === "Valuta Forfettino");
      expect(valuta).toBeDefined();
      expect(valuta!.conditional).toBe(true);
    });

    it("filtro conditional nasconde Valuta Forfettino quando NPS non attivo", () => {
      const isNpsVisible = false;
      const visibleChildren = supportoParentItem.children!.filter((child) => {
        if (child.conditional && child.url === "/valuta") return isNpsVisible;
        return true;
      });
      const titles = visibleChildren.map((c) => c.title);
      expect(titles).not.toContain("Valuta Forfettino");
      expect(titles).toContain("Call");
      expect(titles).toContain("Scrivi feedback");
    });

    it("filtro conditional mostra Valuta Forfettino quando NPS attivo", () => {
      const isNpsVisible = true;
      const visibleChildren = supportoParentItem.children!.filter((child) => {
        if (child.conditional && child.url === "/valuta") return isNpsVisible;
        return true;
      });
      const titles = visibleChildren.map((c) => c.title);
      expect(titles).toContain("Valuta Forfettino");
    });

    it("tutti i children hanno section 'supporto'", () => {
      supportoParentItem.children!.forEach((child) => {
        expect(child.section).toBe("supporto");
      });
    });
  });

  // ── IMPOSTAZIONI standalone (story 57.2 — zona bassa) ──
  describe("impostazioniNavItem standalone", () => {
    it("NON è presente in strumentiNavItems", () => {
      const titles = strumentiNavItems.map((item) => item.title);
      expect(titles).not.toContain("Impostazioni");
    });

    it("ha section 'strumenti' (stesso colore)", () => {
      expect(impostazioniNavItem.section).toBe("strumenti");
    });
  });
});
