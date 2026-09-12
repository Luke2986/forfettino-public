/**
 * Test Story 81-5 — Squircle utility su overlay primitives.
 * Verifica che `squircle-md` / `sm:squircle-2xl` sostituisca `rounded-md` / `sm:rounded-lg` su:
 *  - Dialog (DialogContent) → sm:squircle-2xl
 *  - AlertDialog (AlertDialogContent + Action/Cancel inheritance da Story 81-4) → sm:squircle-2xl + squircle-md
 *  - BlockingModal → sm:squircle-2xl + icon container squircle-md, X button mantiene rounded-sm
 *  - Popover (PopoverContent) → squircle-md
 *  - Tooltip (TooltipContent) → squircle-md
 *  - DropdownMenu (Content + SubContent) → squircle-md, Item mantiene rounded-sm
 *  - Toast (toastVariants + ToastAction) → squircle-md, ToastClose mantiene rounded-md
 *  - Sonner classNames.toast → squircle-md (verifica via mock runtime prop)
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Bell } from "lucide-react";

import { Dialog, DialogContent } from "../dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
} from "../alert-dialog";
import { Popover, PopoverContent } from "../popover";
import { Tooltip, TooltipContent, TooltipProvider } from "../tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
} from "../dropdown-menu";
import {
  Toast,
  ToastAction,
  ToastClose,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "../toast";
import { BlockingModal } from "@/components/notifications/BlockingModal";

// Mock sonner runtime prima di importare Toaster wrapper (verifica reale runtime classNames prop)
const sonnerToasterMock = vi.fn((..._args: unknown[]) => null);
vi.mock("sonner", () => ({
  Toaster: (props: unknown) => sonnerToasterMock(props),
  toast: vi.fn(),
}));
vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light" }),
}));

// Regex: matcha esattamente classi rounded-* Tailwind (sm/md/lg/xl/2xl/3xl/full)
// con word-boundary, esclude squircle-md/sm:squircle-2xl ecc.
const TAILWIND_ROUNDED_REGEX = /(?:^|\s)rounded-(sm|md|lg|xl|2xl|3xl|full)(?:\s|$)/;
const SM_ROUNDED_LG_REGEX = /(?:^|\s)sm:rounded-lg(?:\s|$)/;

describe("Story 81-5 — Dialog squircle (AC #1)", () => {
  it("DialogContent ha sm:squircle-2xl, NON sm:rounded-lg", () => {
    render(
      <Dialog open>
        <DialogContent>contenuto</DialogContent>
      </Dialog>,
    );
    const content = screen.getByRole("dialog");
    expect(content.className).toContain("sm:squircle-2xl");
    expect(content.className).not.toMatch(SM_ROUNDED_LG_REGEX);
  });

  it("DialogPrimitive.Close X button mantiene rounded-sm + tap target 44x44", () => {
    render(
      <Dialog open>
        <DialogContent>contenuto</DialogContent>
      </Dialog>,
    );
    const closeBtn = screen.getByRole("button", { name: /chiudi/i });
    expect(closeBtn.className).toContain("rounded-sm");
    expect(closeBtn.className).toContain("min-h-[44px]");
    expect(closeBtn.className).toContain("min-w-[44px]");
  });
});

describe("Story 81-5 — AlertDialog squircle (AC #2)", () => {
  it("AlertDialogContent ha sm:squircle-2xl, NON sm:rounded-lg", () => {
    render(
      <AlertDialog open>
        <AlertDialogContent>contenuto</AlertDialogContent>
      </AlertDialog>,
    );
    const content = screen.getByRole("alertdialog");
    expect(content.className).toContain("sm:squircle-2xl");
    expect(content.className).not.toMatch(SM_ROUNDED_LG_REGEX);
  });

  it("AlertDialogAction/Cancel ereditano squircle-md da buttonVariants() (Story 81-4)", () => {
    render(
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction>Conferma</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>,
    );
    const cancelBtn = screen.getByRole("button", { name: /annulla/i });
    const actionBtn = screen.getByRole("button", { name: /conferma/i });
    expect(cancelBtn.className).toContain("squircle-md");
    expect(actionBtn.className).toContain("squircle-md");
  });
});

describe("Story 81-5 — BlockingModal squircle (AC #3)", () => {
  it("outer modal ha sm:squircle-2xl + icon container scoped ha squircle-md", () => {
    render(
      <BlockingModal open icon={Bell} title="Test" onDismiss={() => {}}>
        body
      </BlockingModal>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toContain("sm:squircle-2xl");
    expect(dialog.className).not.toMatch(SM_ROUNDED_LG_REGEX);

    // Scope alla content del Dialog: icon container = parent del Bell svg
    const bellIcon = dialog.querySelector("svg.lucide-bell");
    expect(bellIcon).not.toBeNull();
    const iconContainer = bellIcon?.parentElement;
    expect(iconContainer).not.toBeNull();
    expect(iconContainer?.className).toContain("squircle-md");
  });

  it("X close button mantiene rounded-sm (decisione utility-only stretta)", () => {
    render(
      <BlockingModal open icon={Bell} title="Test" onDismiss={() => {}}>
        body
      </BlockingModal>,
    );
    const closeBtn = screen.getByRole("button", { name: /chiudi/i });
    expect(closeBtn.className).toContain("rounded-sm");
    expect(closeBtn.className).toContain("min-h-[44px]");
  });
});

describe("Story 81-5 — Popover squircle (AC #4)", () => {
  it("PopoverContent ha squircle-md, NON rounded-md", () => {
    render(
      <Popover open>
        <PopoverContent>contenuto popover</PopoverContent>
      </Popover>,
    );
    const content = document.body.querySelector('[role="dialog"]');
    expect(content).not.toBeNull();
    const cls = (content as HTMLElement).className;
    expect(cls).toContain("squircle-md");
    expect(cls).not.toMatch(TAILWIND_ROUNDED_REGEX);
  });
});

describe("Story 81-5 — Tooltip squircle (AC #5)", () => {
  it("TooltipContent ha squircle-md, NON rounded-md", () => {
    render(
      <TooltipProvider>
        <Tooltip open>
          <TooltipContent>tip</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
    // Radix Tooltip jsdom: cerca elemento Content tramite combinazione attributi che
    // garantisce di prendere il TooltipContent (con className) e non il wrapper trigger.
    // Filtra per className non vuoto + presenza squircle-md per stabilita' cross-version.
    const candidates = Array.from(
      document.body.querySelectorAll<HTMLElement>(
        '[data-state="delayed-open"], [data-state="instant-open"], [role="tooltip"]',
      ),
    );
    const content = candidates.find((el) => el.className.length > 0);
    expect(content).toBeDefined();
    const cls = content!.className;
    expect(cls).toContain("squircle-md");
    expect(cls).not.toMatch(TAILWIND_ROUNDED_REGEX);
  });
});

describe("Story 81-5 — DropdownMenu squircle (AC #6)", () => {
  it("DropdownMenuContent ha squircle-md, item mantiene rounded-sm", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuContent>
          <DropdownMenuItem>azione</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    const content = document.body.querySelector('[role="menu"]');
    expect(content).not.toBeNull();
    const cls = (content as HTMLElement).className;
    expect(cls).toContain("squircle-md");
    expect(cls).not.toMatch(TAILWIND_ROUNDED_REGEX);

    const item = screen.getByRole("menuitem");
    expect(item.className).toContain("rounded-sm");
  });
});

describe("Story 81-5 — Toast squircle (AC #7)", () => {
  it("Toast container ha squircle-md, ToastAction squircle-md, ToastClose mantiene rounded-md", () => {
    render(
      <ToastProvider>
        <Toast open>
          <ToastTitle>Test toast</ToastTitle>
          <ToastAction altText="undo">Annulla</ToastAction>
          <ToastClose />
        </Toast>
        <ToastViewport />
      </ToastProvider>,
    );
    const toast = document.body.querySelector('[role="status"]');
    expect(toast).not.toBeNull();
    expect((toast as HTMLElement).className).toContain("squircle-md");

    const action = screen.getByRole("button", { name: /annulla/i });
    expect(action.className).toContain("squircle-md");

    // ToastClose: ricerca via attributo toast-close (radix), assenza name accessibile garantito
    const closeBtn = document.body.querySelector('[toast-close=""]');
    expect(closeBtn).not.toBeNull();
    expect((closeBtn as HTMLElement).className).toContain("rounded-md");
  });
});

describe("Story 81-5 — Sonner classNames runtime (AC #8)", () => {
  it("Toaster wrapper passa classNames.toast con 'squircle-md' al sonner Toaster", async () => {
    sonnerToasterMock.mockClear();
    // Import dinamico DOPO mock setup
    const { Toaster } = await import("../sonner");
    render(<Toaster />);
    expect(sonnerToasterMock).toHaveBeenCalled();
    const props = sonnerToasterMock.mock.calls[0][0] as {
      toastOptions?: { classNames?: { toast?: string } };
    };
    const toastClassName = props.toastOptions?.classNames?.toast ?? "";
    expect(toastClassName).toContain("squircle-md");
  });
});
