import { useNavigate, useLocation } from "react-router-dom";
import { useMemo, useState } from "react";
import { LogOut, ChevronDown } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useUserRole } from "@/hooks/useUserRole";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useMobileMenu } from "./MobileMenuContext";
import {
  dashboardNavItem,
  gestioneNavItems,
  pianificazioneNavItems,
  messaggiNavItem,
  strumentiNavItems,
  impostazioniNavItem,
  supportoParentItem,
  adminNavItems,
  sectionIconColor,
  sectionActiveClass,
} from "./AppSidebar";
import { useNotificationCount } from "@/hooks/useNotificationCount";
import { useSubscription } from "@/hooks/useSubscription";
import { useNpsSidebarButton } from "@/hooks/useNpsSidebarButton";
import { UserCodeBlock } from "./UserCodeBlock";

interface MobileMenuSheetProps {
  onOpenNpsSurvey?: () => void;
}

export function MobileMenuSheet({ onOpenNpsSurvey }: MobileMenuSheetProps = {}) {
  const { menuOpen, setMenuOpen, closeMenu } = useMobileMenu();
  const { signOut, user } = useAuth();
  const { data: profile } = useProfile();
  const { data: userRole } = useUserRole();
  const isAdmin = userRole === "admin";
  const { data: unreadCount = 0 } = useNotificationCount();
  const { isPro } = useSubscription();
  const { isVisible: isNpsButtonVisible } = useNpsSidebarButton();
  const navigate = useNavigate();
  const location = useLocation();
  // Auto-open Supporto if a child route is active (M2 fix)
  const supportoChildUrls = useMemo(() => (supportoParentItem.children ?? []).map(c => c.url), []);
  const isSupportoChildActive = supportoChildUrls.some(url => location.pathname === url);
  const isSupportoParentActive = location.pathname === supportoParentItem.url;
  const [supportoOpen, setSupportoOpen] = useState(isSupportoChildActive || isSupportoParentActive);

  const userName = profile?.first_name
    ? `${profile.first_name} ${profile.last_name || ""}`.trim()
    : user?.email?.split("@")[0] || "Utente";

  const userEmail = user?.email || "";
  const userInitials = userName.substring(0, 2).toUpperCase();

  const handleNavigate = (url: string) => {
    // Pass current page as origin for feedback
    if (url === "/feedback") {
      navigate(url, { state: { from: location.pathname } });
    } else {
      navigate(url);
    }
    closeMenu();
  };

  const handleSignOut = () => {
    closeMenu();
    signOut();
  };

  const isActive = (url: string) => location.pathname === url;

  return (
    <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
      <SheetContent side="left" className="w-[min(320px,85vw)] p-0 flex flex-col">
        <SheetHeader className="shrink-0 px-6 pt-6 pb-4 border-b border-slate-100">
          <SheetTitle className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center squircle-md bg-primary text-primary-foreground font-bold text-lg shadow-sm">
              F
            </div>
            <span className="font-display font-bold text-xl tracking-tight text-slate-900">Forfettino</span>
          </SheetTitle>
          {/* Codice utente — subito sotto il logo come in Forfè */}
          <UserCodeBlock userCode={profile?.user_code} />
        </SheetHeader>

        <nav aria-label="Navigazione principale" className="flex-1 overflow-y-auto overflow-x-hidden p-4">
          {/* Dashboard */}
          <div className="space-y-1 mb-4">
            <Button
              variant="ghost"
              onClick={() => handleNavigate(dashboardNavItem.url)}
              aria-current={isActive(dashboardNavItem.url) ? "page" : undefined}
              className={cn(
                "w-full justify-start gap-3 h-11",
                isActive(dashboardNavItem.url) && sectionActiveClass[dashboardNavItem.section],
              )}
            >
              <dashboardNavItem.icon className={`h-5 w-5 shrink-0 ${sectionIconColor[dashboardNavItem.section]}`} />
              <span className="truncate">{dashboardNavItem.title}</span>
            </Button>
          </div>

          {/* Messaggi — standalone subito sotto Dashboard (AC4) */}
          <div className="space-y-1 mb-4">
            <Button
              variant="ghost"
              onClick={() => handleNavigate(messaggiNavItem.url)}
              aria-current={isActive(messaggiNavItem.url) ? "page" : undefined}
              className={cn(
                "w-full justify-start gap-3 h-11",
                isActive(messaggiNavItem.url) && sectionActiveClass[messaggiNavItem.section],
              )}
              aria-label={unreadCount > 0 ? `Messaggi, ${unreadCount} non letti` : "Messaggi"}
            >
              <messaggiNavItem.icon className={`h-5 w-5 shrink-0 ${sectionIconColor[messaggiNavItem.section]}`} />
              <span className="truncate">Messaggi</span>
              {unreadCount > 0 && (
                <span className="ml-auto flex items-center justify-center bg-destructive text-destructive-foreground h-5 min-w-[20px] px-1.5 text-xs font-bold rounded-full">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Button>
          </div>

          {/* Gestione */}
          <div className="mb-2 px-2 text-xs font-bold text-slate-600 uppercase tracking-[0.08em]">Gestione</div>
          <div className="space-y-1 mb-4">
            {gestioneNavItems.map((item) => {
              const visibleChildren = (item.children ?? []).filter(
                (child) => (!child.adminOnly || isAdmin) && (!child.proOnly || isPro || isAdmin)
              );
              return (
                <div key={item.title}>
                  <Button
                    variant="ghost"
                    onClick={() => handleNavigate(item.url)}
                    aria-current={isActive(item.url) ? "page" : undefined}
                    className={cn(
                      "w-full justify-start gap-3 h-11",
                      isActive(item.url) && sectionActiveClass[item.section],
                    )}
                  >
                    <item.icon className={`h-5 w-5 shrink-0 ${sectionIconColor[item.section]}`} />
                    <span className="truncate">{item.title}</span>
                  </Button>
                  {visibleChildren.map((child) => (
                    <Button
                      key={child.url}
                      variant="ghost"
                      onClick={() => handleNavigate(child.url)}
                      aria-current={isActive(child.url) ? "page" : undefined}
                      className={cn(
                        "w-full justify-start gap-3 h-11 pl-12",
                        isActive(child.url) && sectionActiveClass[item.section],
                      )}
                    >
                      <span className="truncate">{child.title}</span>
                    </Button>
                  ))}
                </div>
              );
            })}
          </div>

          {/* Pianificazione */}
          <div className="mb-2 px-2 text-xs font-bold text-slate-600 uppercase tracking-[0.08em]">Pianificazione</div>
          <div className="space-y-1 mb-4">
            {pianificazioneNavItems.filter((item) => (!item.adminOnly || isAdmin) && (!item.proOnly || isPro || isAdmin)).map((item) => (
              <Button
                key={item.title}
                variant="ghost"
                onClick={() => handleNavigate(item.url)}
                aria-current={isActive(item.url) ? "page" : undefined}
                className={cn(
                  "w-full justify-start gap-3 h-11",
                  isActive(item.url) && sectionActiveClass[item.section],
                )}
              >
                <item.icon className={`h-5 w-5 shrink-0 ${sectionIconColor[item.section]}`} />
                <span className="truncate">{item.title}</span>
              </Button>
            ))}
          </div>

          {/* Strumenti */}
          <div className="mb-2 px-2 text-xs font-bold text-slate-600 uppercase tracking-[0.08em]">Strumenti</div>
          <div className="space-y-1 mb-4">
            {strumentiNavItems.filter((item) => (!item.adminOnly || isAdmin) && (!item.proOnly || isPro || isAdmin)).map((item) => (
              <Button
                key={item.title}
                variant="ghost"
                onClick={() => handleNavigate(item.url)}
                aria-current={isActive(item.url) ? "page" : undefined}
                className={cn(
                  "w-full justify-start gap-3 h-11",
                  isActive(item.url) && sectionActiveClass[item.section],
                )}
              >
                <item.icon className={`h-5 w-5 shrink-0 ${sectionIconColor[item.section]}`} />
                <span className="truncate">{item.title}</span>
              </Button>
            ))}
          </div>

          {/* Divider + Impostazioni standalone */}
          <div className="mx-2 border-t border-slate-200/60 mb-2" />
          <div className="space-y-1 mb-4">
            <Button
              variant="ghost"
              onClick={() => handleNavigate(impostazioniNavItem.url)}
              aria-current={isActive(impostazioniNavItem.url) ? "page" : undefined}
              className={cn(
                "w-full justify-start gap-3 h-11",
                isActive(impostazioniNavItem.url) && sectionActiveClass[impostazioniNavItem.section],
              )}
            >
              <impostazioniNavItem.icon className={`h-5 w-5 shrink-0 ${sectionIconColor[impostazioniNavItem.section]}`} />
              <span className="truncate">{impostazioniNavItem.title}</span>
            </Button>
          </div>

          {/* Divider + Supporto collapsible */}
          <div className="mx-2 border-t border-slate-200/60 mb-2" />
          <div className="space-y-1 mb-4">
            <Button
              variant="ghost"
              onClick={() => setSupportoOpen(!supportoOpen)}
              className={cn(
                "w-full justify-start gap-3 h-11",
                (isSupportoParentActive || isSupportoChildActive) && sectionActiveClass.supporto,
              )}
            >
              <supportoParentItem.icon className={`h-5 w-5 shrink-0 ${sectionIconColor.supporto}`} />
              <span className="truncate">{supportoParentItem.title}</span>
              <ChevronDown className={cn("ml-auto h-4 w-4 text-slate-500 transition-transform duration-200", !supportoOpen && "-rotate-90")} />
            </Button>
            {supportoOpen && (supportoParentItem.children ?? [])
              .filter((child) => {
                // proOnly/adminOnly filter (AC7 — applies to ALL collapsible children)
                if (child.proOnly && !isPro && !isAdmin) return false;
                if (child.adminOnly && !isAdmin) return false;
                // Valuta Forfettino: visible only when NPS is active
                if (child.conditional && child.url === "/valuta") return isNpsButtonVisible && !!onOpenNpsSurvey;
                return true;
              })
              .map((child) =>
                child.external ? (
                  <Button
                    key={child.url}
                    variant="ghost"
                    asChild
                    className="w-full justify-start gap-3 h-11 pl-12"
                  >
                    <a
                      href={child.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={closeMenu}
                    >
                      <span className="truncate">{child.title}</span>
                    </a>
                  </Button>
                ) : (
                  <Button
                    key={child.url}
                    variant="ghost"
                    onClick={() => {
                      // NPS: open survey instead of navigating (H1 fix)
                      if (child.conditional && child.url === "/valuta") {
                        onOpenNpsSurvey?.();
                        closeMenu();
                        return;
                      }
                      handleNavigate(child.url);
                    }}
                    aria-current={isActive(child.url) ? "page" : undefined}
                    className={cn(
                      "w-full justify-start gap-3 h-11 pl-12",
                      isActive(child.url) && sectionActiveClass[child.section],
                    )}
                  >
                    <span className="truncate">{child.title}</span>
                  </Button>
                )
              )}
          </div>

          {/* Admin — solo per admin */}
          {isAdmin && (
            <>
              <div className="mb-2 px-2 text-xs font-bold text-slate-600 uppercase tracking-[0.08em]">Admin</div>
              <div className="space-y-1">
                {adminNavItems.map((item) => (
                  <Button
                    key={item.title}
                    variant="ghost"
                    onClick={() => handleNavigate(item.url)}
                    aria-current={isActive(item.url) ? "page" : undefined}
                    className={cn(
                      "w-full justify-start gap-3 h-11",
                      isActive(item.url) && sectionActiveClass[item.section],
                    )}
                  >
                    <item.icon className={`h-5 w-5 shrink-0 ${sectionIconColor[item.section]}`} />
                    <span className="truncate">{item.title}</span>
                  </Button>
                ))}
              </div>
            </>
          )}
        </nav>

        {/* Footer with User Info and Logout */}
        <div className="shrink-0 border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-muted/20">
          <div className="flex items-center gap-3 mb-4 px-2">
            <Avatar className="h-10 w-10 border border-slate-100">
              <AvatarFallback className="bg-teal-50 text-teal-700 font-semibold">{userInitials}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold truncate">{userName}</span>
              <span className="text-xs text-muted-foreground truncate">{userEmail}</span>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={handleSignOut}
            className="w-full justify-start gap-3 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50"
          >
            <LogOut className="h-4 w-4" />
            Esci
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
