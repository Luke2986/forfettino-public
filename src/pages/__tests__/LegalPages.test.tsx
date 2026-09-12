import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { CURRENT_PRIVACY_VERSION, CURRENT_TOS_VERSION } from "@/lib/legal-versions";

// Mock navigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

// Import pages
import PrivacyPolicy from "../PrivacyPolicy";
import CookiePolicy from "../CookiePolicy";
import TermsOfService from "../TermsOfService";

function renderWithRouter(ui: React.ReactElement, route = "/") {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[route]}>
        {ui}
      </MemoryRouter>
    </HelmetProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PrivacyPolicy page", () => {
  it("renders the Privacy Policy heading", () => {
    renderWithRouter(<PrivacyPolicy />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Privacy Policy");
  });

  it("shows the version identifier", () => {
    renderWithRouter(<PrivacyPolicy />);
    expect(screen.getByText(new RegExp(CURRENT_PRIVACY_VERSION))).toBeTruthy();
  });

  it("renders all 11 main sections", () => {
    renderWithRouter(<PrivacyPolicy />);
    const sectionTitles = [
      "Titolare del Trattamento",
      "Dati Raccolti",
      "Finalità e Base Giuridica",
      "Canali di Comunicazione",
      "Conservazione dei Dati",
      "Sub-processori",
      "Cookie e Tracciamento",
      "Sicurezza",
      "Diritti dell'Utente",
      "Utenti Minorenni",
      "Modifiche alla Privacy Policy",
    ];
    for (const title of sectionTitles) {
      expect(screen.getByText(new RegExp(title))).toBeTruthy();
    }
  });

  it("contains privacy@forfettino.it contact email", () => {
    renderWithRouter(<PrivacyPolicy />);
    const emailLinks = screen.getAllByRole("link", { name: /privacy@forfettino\.it/i });
    expect(emailLinks.length).toBeGreaterThanOrEqual(1);
  });

  it("renders the back button", () => {
    renderWithRouter(<PrivacyPolicy />);
    expect(screen.getByRole("button", { name: /torna indietro/i })).toBeTruthy();
  });

  it("renders the validation disclaimer", () => {
    renderWithRouter(<PrivacyPolicy />);
    expect(screen.getByText(/validato da consulente legale/i)).toBeTruthy();
  });

  it("lists sub-processors including Supabase, Cloudflare, PostHog", () => {
    renderWithRouter(<PrivacyPolicy />);
    expect(screen.getByText("Supabase")).toBeTruthy();
    expect(screen.getByText("Cloudflare")).toBeTruthy();
    expect(screen.getByText("PostHog")).toBeTruthy();
  });

  it("has a link to cookie policy page", () => {
    renderWithRouter(<PrivacyPolicy />);
    const cookieLink = screen.getByRole("link", { name: /cookie policy/i });
    expect(cookieLink).toHaveAttribute("href", "/cookie-policy");
  });

  it("back button navigates on click", () => {
    renderWithRouter(<PrivacyPolicy />);
    const backBtn = screen.getByRole("button", { name: /torna indietro/i });
    fireEvent.click(backBtn);
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it("sets document.title", async () => {
    renderWithRouter(<PrivacyPolicy />);
    await waitFor(() => {
      expect(document.title).toBe("Privacy Policy — Forfettino");
    });
  });
});

describe("CookiePolicy page", () => {
  it("renders the Cookie Policy heading", () => {
    renderWithRouter(<CookiePolicy />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Cookie Policy");
  });

  it("renders the back button", () => {
    renderWithRouter(<CookiePolicy />);
    expect(screen.getByRole("button", { name: /torna indietro/i })).toBeTruthy();
  });

  it("describes Supabase auth token cookie", () => {
    renderWithRouter(<CookiePolicy />);
    expect(screen.getByText(/sb-\*-auth-token/)).toBeTruthy();
  });

  it("describes PostHog analytics cookie", () => {
    renderWithRouter(<CookiePolicy />);
    // Citato sia nel testo della sezione 3 sia nella tabella dei cookie.
    expect(screen.getAllByText(/ph_\*/).length).toBeGreaterThan(0);
  });

  it("distinguishes the pseudonymous identifier from consent-gated profiling", () => {
    renderWithRouter(<CookiePolicy />);
    expect(screen.getAllByText(/legittimo interesse/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/consenso\s+esplicito/i).length).toBeGreaterThan(0);
  });

  it("has a manage cookies button", () => {
    renderWithRouter(<CookiePolicy />);
    expect(screen.getByRole("button", { name: /gestisci preferenze cookie/i })).toBeTruthy();
  });

  it("mentions localStorage usage", () => {
    renderWithRouter(<CookiePolicy />);
    const matches = screen.getAllByText(/localStorage/);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("renders the validation disclaimer", () => {
    renderWithRouter(<CookiePolicy />);
    expect(screen.getByText(/validato da consulente legale/i)).toBeTruthy();
  });

  it("back button navigates on click", () => {
    renderWithRouter(<CookiePolicy />);
    const backBtn = screen.getByRole("button", { name: /torna indietro/i });
    fireEvent.click(backBtn);
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it("sets document.title", async () => {
    renderWithRouter(<CookiePolicy />);
    await waitFor(() => {
      expect(document.title).toBe("Cookie Policy — Forfettino");
    });
  });

  it("shows fallback message when Cookiebot is unavailable", () => {
    renderWithRouter(<CookiePolicy />);
    const manageBtn = screen.getByRole("button", { name: /gestisci preferenze cookie/i });
    fireEvent.click(manageBtn);
    expect(screen.getByText(/gestore cookie non è attualmente disponibile/i)).toBeTruthy();
  });
});

describe("TermsOfService page", () => {
  it("renders the Termini di Servizio heading", () => {
    renderWithRouter(<TermsOfService />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Termini di Servizio");
  });

  it("shows the version identifier", () => {
    renderWithRouter(<TermsOfService />);
    expect(screen.getByText(new RegExp(CURRENT_TOS_VERSION))).toBeTruthy();
  });

  it("renders the back button", () => {
    renderWithRouter(<TermsOfService />);
    expect(screen.getByRole("button", { name: /torna indietro/i })).toBeTruthy();
  });

  it("contains the disclaimer about not being a commercialista", () => {
    renderWithRouter(<TermsOfService />);
    expect(screen.getByText(/NON è un commercialista/i)).toBeTruthy();
  });

  it("specifies age requirement (maggiorenni)", () => {
    renderWithRouter(<TermsOfService />);
    expect(screen.getByText(/maggiorenni/i)).toBeTruthy();
  });

  it("specifies P.IVA requirement", () => {
    renderWithRouter(<TermsOfService />);
    expect(screen.getByText(/Partita IVA in regime forfettario/i)).toBeTruthy();
  });

  it("mentions Italian law (legge italiana)", () => {
    renderWithRouter(<TermsOfService />);
    expect(screen.getByText(/legge italiana/i)).toBeTruthy();
  });

  it("renders the validation disclaimer", () => {
    renderWithRouter(<TermsOfService />);
    expect(screen.getByText(/validato da consulente legale/i)).toBeTruthy();
  });

  it("back button navigates on click", () => {
    renderWithRouter(<TermsOfService />);
    const backBtn = screen.getByRole("button", { name: /torna indietro/i });
    fireEvent.click(backBtn);
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it("sets document.title", async () => {
    renderWithRouter(<TermsOfService />);
    await waitFor(() => {
      expect(document.title).toBe("Termini di Servizio — Forfettino");
    });
  });
});
