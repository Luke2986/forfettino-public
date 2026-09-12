import { createContext, useContext, useState, ReactNode } from "react";

interface MobileMenuContextType {
  menuOpen: boolean;
  openMenu: () => void;
  closeMenu: () => void;
  setMenuOpen: (open: boolean) => void;
}

export const MobileMenuContext = createContext<MobileMenuContextType | null>(null);

export function useMobileMenu() {
  const ctx = useContext(MobileMenuContext);
  if (!ctx) {
    throw new Error("useMobileMenu must be used within MobileMenuProvider");
  }
  return ctx;
}

interface MobileMenuProviderProps {
  children: ReactNode;
}

export function MobileMenuProvider({ children }: MobileMenuProviderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const openMenu = () => setMenuOpen(true);
  const closeMenu = () => setMenuOpen(false);

  return (
    <MobileMenuContext.Provider value={{ menuOpen, openMenu, closeMenu, setMenuOpen }}>
      {children}
    </MobileMenuContext.Provider>
  );
}
