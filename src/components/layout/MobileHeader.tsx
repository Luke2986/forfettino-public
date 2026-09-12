import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMobileMenu } from "./MobileMenuContext";

interface MobileHeaderProps {
  title: string;
  showBackButton?: boolean;
  backPath?: string;
  rightAction?: ReactNode;
}

export function MobileHeader({
  title,
  showBackButton = false,
  backPath,
  rightAction,
}: MobileHeaderProps) {
  const navigate = useNavigate();
  const { openMenu } = useMobileMenu();

  const handleBack = () => {
    if (backPath) {
      navigate(backPath);
    } else {
      navigate(-1);
    }
  };

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-border bg-background px-4 md:hidden">
      {/* Left button: back or menu */}
      <Button
        variant="ghost"
        size="icon"
        onClick={showBackButton ? handleBack : openMenu}
        className="shrink-0 min-h-[44px] min-w-[44px]"
        aria-label={showBackButton ? "Torna indietro" : "Apri menu"}
      >
        {showBackButton ? (
          <ArrowLeft className="h-5 w-5" />
        ) : (
          <Menu className="h-5 w-5" />
        )}
      </Button>

      {/* Center: title */}
      <h1 className="flex-1 truncate text-center text-lg font-semibold">
        {title}
      </h1>

      {/* Right: optional action — min-w matches left button for title centering */}
      <div className="shrink-0 min-w-[44px] flex justify-end">
        {rightAction}
      </div>
    </header>
  );
}
