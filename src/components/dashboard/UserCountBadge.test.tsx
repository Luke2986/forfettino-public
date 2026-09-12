import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { readFileSync } from "fs";
import { resolve } from "path";

vi.mock("@/hooks/usePublicUserCount", () => ({
  usePublicUserCount: vi.fn(),
}));

import { usePublicUserCount } from "@/hooks/usePublicUserCount";
import { UserCountBadge } from "./UserCountBadge";

const mockUsePublicUserCount = usePublicUserCount as ReturnType<typeof vi.fn>;

describe("UserCountBadge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock matchMedia to return prefers-reduced-motion:reduce,
    // so the counter skips the setInterval animation and paints the final value synchronously.
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;
  });

  // ── 1. Renderizza badge con count > 0 ──
  it("renders badge with user count when count > 0", () => {
    mockUsePublicUserCount.mockReturnValue({ count: 142, isLoading: false });

    render(<UserCountBadge />);

    expect(screen.getByText(/142 utenti/)).toBeInTheDocument();
  });

  // ── 2. Nascosto se count = 0 ──
  it("renders nothing when count is 0", () => {
    mockUsePublicUserCount.mockReturnValue({ count: 0, isLoading: false });

    const { container } = render(<UserCountBadge />);

    expect(container.firstChild).toBeNull();
  });

  // ── 3. Nascosto se count = null (errore RPC) ──
  it("renders nothing when count is null (RPC error)", () => {
    mockUsePublicUserCount.mockReturnValue({ count: null, isLoading: false });

    const { container } = render(<UserCountBadge />);

    expect(container.firstChild).toBeNull();
  });

  // ── 4. Ha classe hidden sm:inline-flex (responsive) ──
  it("has hidden sm:inline-flex class for responsive visibility", () => {
    mockUsePublicUserCount.mockReturnValue({ count: 50, isLoading: false });

    // The DashboardHeader passes "hidden sm:inline-flex" via the className prop
    // to hide the badge on mobile. This test verifies the prop is applied correctly.
    render(<UserCountBadge className="hidden sm:inline-flex" />);

    const badge = screen.getByText(/50 utenti/).closest("span");
    expect(badge).toHaveClass("hidden");
    expect(badge).toHaveClass("sm:inline-flex");
  });

  // ── 5. Nascosto durante loading senza dati ──
  it("renders nothing while loading with no data", () => {
    mockUsePublicUserCount.mockReturnValue({ count: null, isLoading: true });

    const { container } = render(<UserCountBadge />);

    expect(container.firstChild).toBeNull();
  });
});

// ── 6. DashboardHeader NON contiene piu' "Nuovo cliente" ──
describe("DashboardHeader — CTA removal", () => {
  it("source code does not contain 'Nuovo cliente' CTA", () => {
    const headerSource = readFileSync(
      resolve(__dirname, "DashboardHeader.tsx"),
      "utf-8",
    );
    expect(headerSource).not.toContain("Nuovo cliente");
    expect(headerSource).toContain("UserCountBadge");
  });
});
