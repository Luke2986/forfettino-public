import { ReactNode } from "react";
import { X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Dialog, DialogPortal, DialogOverlay } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface BlockingModalProps {
  open: boolean;
  onDismiss: () => void;
  icon: LucideIcon;
  iconBg?: string;
  title: string;
  children: ReactNode;
  hideCloseButton?: boolean;
}

/**
 * Pop-up modale bloccante riusabile (Story 25.2).
 *
 * - Overlay bg-black/60, impedisce click su elementi sotto
 * - onInteractOutside bloccato (non si chiude cliccando fuori)
 * - Escape → onDismiss (chiudibile da tastiera)
 * - Focus trap built-in (Radix Dialog)
 * - Mobile responsive: max-w-[calc(100%-32px)]
 */
export function BlockingModal({
  open,
  onDismiss,
  icon: Icon,
  iconBg = "bg-teal-50",
  title,
  children,
  hideCloseButton = false,
}: BlockingModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onDismiss(); }}>
      <DialogPortal>
        <DialogOverlay className="bg-black/60" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-50 grid w-full max-w-md translate-x-[-50%] translate-y-[-50%]",
            "max-w-[calc(100%-32px)] sm:max-w-md",
            "gap-4 border bg-background p-6 shadow-lg sm:squircle-2xl",
            "duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
            "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
          )}
          onInteractOutside={(e) => e.preventDefault()}
          aria-modal="true"
          aria-describedby="blocking-modal-body"
        >
          {/* Header: icona + titolo */}
          <div className="flex flex-col items-center gap-3">
            <div className={cn("flex h-12 w-12 items-center justify-center squircle-md", iconBg)}>
              <Icon className="h-6 w-6 text-teal-600" />
            </div>
            <DialogPrimitive.Title className="text-lg font-semibold leading-none tracking-tight text-center">
              {title}
            </DialogPrimitive.Title>
          </div>

          {/* Body (children) */}
          <div id="blocking-modal-body">
            {children}
          </div>

          {/* X button condizionale */}
          {!hideCloseButton && (
            <DialogPrimitive.Close
              className="absolute right-4 top-4 rounded-sm min-h-[44px] min-w-[44px] p-2 flex items-center justify-center opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:opacity-100 disabled:pointer-events-none"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Chiudi</span>
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
