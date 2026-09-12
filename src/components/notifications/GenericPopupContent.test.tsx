import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { GenericPopupContent } from "./GenericPopupContent";
import type { Database } from "@/integrations/supabase/types";

type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

const baseNotification: NotificationRow = {
  id: "notif-1",
  user_id: "user-123",
  type: "admin_broadcast",
  category: "aggiornamenti",
  title: "Titolo notifica",
  body: "Corpo del messaggio di notifica",
  delivery_channel: "popup",
  dismissed_at: null,
  read_at: null,
  action_url: null,
  action_label: null,
  metadata: {},
  created_at: "2026-02-26T10:00:00Z",
  updated_at: "2026-02-26T10:00:00Z",
  email_sent_at: null,
  sms_sent_at: null,
};

/** Helper: wraps component in MemoryRouter for React Router Link support */
function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("GenericPopupContent", () => {
  it("renderizza il corpo della notifica", () => {
    const { getByText } = renderWithRouter(
      <GenericPopupContent notification={baseNotification} onDismiss={vi.fn()} />,
    );

    expect(getByText("Corpo del messaggio di notifica")).toBeInTheDocument();
  });

  it("renderizza il bottone 'Ho capito' e chiama onDismiss al click", () => {
    const onDismiss = vi.fn();
    const { getByRole } = renderWithRouter(
      <GenericPopupContent notification={baseNotification} onDismiss={onDismiss} />,
    );

    const button = getByRole("button", { name: /ho capito/i });
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("renderizza il bottone azione quando action_url e action_label sono presenti (link interno)", () => {
    const notification: NotificationRow = {
      ...baseNotification,
      action_url: "/impostazioni",
      action_label: "Vai alle impostazioni",
    };

    const { getByRole } = renderWithRouter(
      <GenericPopupContent notification={notification} onDismiss={vi.fn()} />,
    );

    const actionBtn = getByRole("link", { name: /vai alle impostazioni/i });
    expect(actionBtn).toBeInTheDocument();
    expect(actionBtn).toHaveAttribute("href", "/impostazioni");
    // Link interni: nessun target _blank (SPA navigation via React Router)
    expect(actionBtn).not.toHaveAttribute("target");
  });

  it("NON renderizza il bottone azione quando action_url è null", () => {
    const { queryByRole } = renderWithRouter(
      <GenericPopupContent notification={baseNotification} onDismiss={vi.fn()} />,
    );

    expect(queryByRole("link")).not.toBeInTheDocument();
  });

  it("renderizza il bottone azione con target _blank per URL esterni", () => {
    const notification: NotificationRow = {
      ...baseNotification,
      action_url: "https://example.com/page",
      action_label: "Apri link",
    };

    const { getByRole } = renderWithRouter(
      <GenericPopupContent notification={notification} onDismiss={vi.fn()} />,
    );

    const actionBtn = getByRole("link", { name: /apri link/i });
    expect(actionBtn).toHaveAttribute("target", "_blank");
    expect(actionBtn).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("NON usa target _blank per URL interni (percorsi relativi)", () => {
    const notification: NotificationRow = {
      ...baseNotification,
      action_url: "/messaggi",
      action_label: "Vai ai messaggi",
    };

    const { getByRole } = renderWithRouter(
      <GenericPopupContent notification={notification} onDismiss={vi.fn()} />,
    );

    const actionBtn = getByRole("link", { name: /vai ai messaggi/i });
    expect(actionBtn).not.toHaveAttribute("target");
  });
});
