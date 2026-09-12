import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/hooks/useProfile", () => ({
  useProfile: vi.fn(),
}));

import { useProfile } from "@/hooks/useProfile";
import { ReferralShareSection } from "./ReferralShareSection";

const mockUseProfile = useProfile as ReturnType<typeof vi.fn>;

describe("ReferralShareSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it("renders nothing when user_code is missing", () => {
    mockUseProfile.mockReturnValue({ data: null });
    const { container } = render(<ReferralShareSection referralPoints={30} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when profile has no user_code", () => {
    mockUseProfile.mockReturnValue({ data: { user_code: "" } });
    const { container } = render(<ReferralShareSection referralPoints={30} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders referral card when user_code is present", () => {
    mockUseProfile.mockReturnValue({ data: { user_code: "ABC123" } });
    render(<ReferralShareSection referralPoints={30} />);
    expect(screen.getByText("Invita un amico")).toBeInTheDocument();
  });

  it("displays referral link with forfettino.it domain", () => {
    mockUseProfile.mockReturnValue({ data: { user_code: "XYZ789" } });
    render(<ReferralShareSection referralPoints={30} />);
    const input = screen.getByDisplayValue("https://forfettino.it/referral/XYZ789");
    expect(input).toBeInTheDocument();
  });

  it("copies link to clipboard on button click", async () => {
    mockUseProfile.mockReturnValue({ data: { user_code: "COPY1" } });
    render(<ReferralShareSection referralPoints={30} />);

    const copyButton = screen.getByRole("button");
    fireEvent.click(copyButton);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining("/referral/COPY1"),
    );
  });

  it("shows check icon after copy", async () => {
    mockUseProfile.mockReturnValue({ data: { user_code: "CHK1" } });
    render(<ReferralShareSection referralPoints={30} />);

    const copyButton = screen.getByRole("button");
    fireEvent.click(copyButton);

    // Wait for clipboard promise to resolve
    await vi.waitFor(() => {
      // Check icon should be visible (emerald color = success)
      expect(screen.getByRole("button").querySelector(".text-emerald-500")).toBeInTheDocument();
    });
  });

  it("shows referralPoints in description", () => {
    mockUseProfile.mockReturnValue({ data: { user_code: "TEST1" } });
    render(<ReferralShareSection referralPoints={30} />);
    expect(screen.getByText(/30 punti/)).toBeInTheDocument();
  });

  it("shows custom referralPoints when provided", () => {
    mockUseProfile.mockReturnValue({ data: { user_code: "TEST2" } });
    render(<ReferralShareSection referralPoints={50} />);
    expect(screen.getByText(/50 punti/)).toBeInTheDocument();
  });

  it("shows cap reached message when monthlyReferralCount >= 10", () => {
    mockUseProfile.mockReturnValue({ data: { user_code: "CAP1" } });
    render(<ReferralShareSection referralPoints={30} monthlyReferralCount={10} />);
    expect(screen.getByText(/limite di 10 inviti/)).toBeInTheDocument();
    expect(screen.queryByText(/30 punti/)).not.toBeInTheDocument();
  });

  it("disables copy button when cap is reached", () => {
    mockUseProfile.mockReturnValue({ data: { user_code: "CAP2" } });
    render(<ReferralShareSection referralPoints={30} monthlyReferralCount={10} />);
    const copyButton = screen.getByRole("button");
    expect(copyButton).toBeDisabled();
  });

  it("does not copy when cap is reached", () => {
    mockUseProfile.mockReturnValue({ data: { user_code: "CAP3" } });
    render(<ReferralShareSection referralPoints={30} monthlyReferralCount={15} />);
    const copyButton = screen.getByRole("button");
    fireEvent.click(copyButton);
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  });

  it("shows monthly count when > 0 and under cap", () => {
    mockUseProfile.mockReturnValue({ data: { user_code: "CNT1" } });
    render(<ReferralShareSection referralPoints={30} monthlyReferralCount={3} />);
    expect(screen.getByText(/3\/10 questo mese/)).toBeInTheDocument();
  });

  it("allows copy at cap boundary (9/10) — last invite before cap", () => {
    mockUseProfile.mockReturnValue({ data: { user_code: "BND1" } });
    render(<ReferralShareSection referralPoints={30} monthlyReferralCount={9} />);
    const copyButton = screen.getByRole("button");
    expect(copyButton).not.toBeDisabled();
    expect(screen.getByText(/9\/10 questo mese/)).toBeInTheDocument();
    expect(screen.queryByText(/limite di 10 inviti/)).not.toBeInTheDocument();
  });
});
