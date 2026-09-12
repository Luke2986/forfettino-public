/* eslint-disable react-refresh/only-export-components */
import { useLocation, useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  Receipt,
  Calendar,
  CalendarDays,
  ListTodo,
  Settings,
  Wrench,
  Headphones,
  MessageSquare,
  Sparkles,
  ShieldCheck,
  FileText,
  Bell,
  Heart,
  Phone,
  PieChart,
  BarChart3,
  Star,
  TrendingUp,
  Lock,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import { useNotificationCount } from "@/hooks/useNotificationCount";
import { useProfile } from "@/hooks/useProfile";
import { useUserRole } from "@/hooks/useUserRole";
import { isGuideLive } from "@/lib/feature-gates";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { UserCodeBlock } from "./UserCodeBlock";
import { CollapsibleNavGroup } from "./CollapsibleNavGroup";
import { Badge } from "@/components/ui/badge";
import { useSubscription } from "@/hooks/useSubscription";
import { UsageCounter } from "@/components/subscription/UsageCounter";
import { useNpsSidebarButton } from "@/hooks/useNpsSidebarButton";
import { useOverdueTaskCount } from "@/hooks/useOverdueTaskCount";

// ── Section color types ──
export type NavSection = "dashboard" | "gestione" | "pianificazione" | "messaggi" | "strumenti" | "supporto" | "admin";
export interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  section: NavSection;
  adminOnly?: boolean;
  proOnly?: boolean;
  children?: NavItem[];
  /** If true, renders as <a> with target="_blank" instead of <Link> */
  external?: boolean;
  /** If true, item is only shown when its visibility condition is met (e.g. NPS) */
  conditional?: boolean;
}

// Nav item standalone (top)
export const dashboardNavItem: NavItem = { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, section: "dashboard" };

// Gruppo GESTIONE — operazioni core business
export const gestioneNavItems: NavItem[] = [
  { title: "Incassi", url: "/incassi", icon: Receipt, section: "gestione" },
  {
    title: "Clienti", url: "/clienti", icon: Users, section: "gestione",
    children: [
      { title: "I miei Clienti", url: "/clienti", icon: Users, section: "gestione" },
      { title: "Report Fatturato", url: "/report", icon: TrendingUp, section: "gestione", proOnly: true },
    ],
  },
  { title: "Costi", url: "/tool", icon: Wrench, section: "gestione" },
];

// Gruppo PIANIFICAZIONE — scadenze e calendario
export const pianificazioneNavItems: NavItem[] = [
  { title: "Scadenziario", url: "/scadenziario", icon: Calendar, section: "pianificazione" },
  { title: "Calendario", url: "/calendario", icon: CalendarDays, section: "pianificazione" },
  { title: "Task", url: "/task", icon: ListTodo, section: "pianificazione", proOnly: true },
];

// Gruppo STRUMENTI
export const strumentiNavItems: NavItem[] = [
  { title: "Il tuo contributo", url: "/classifica", icon: Sparkles, section: "strumenti" },
  { title: "Comparatore", url: "/benchmark", icon: BarChart3, section: "strumenti", proOnly: true },
  { title: "Allocazione", url: "/budget", icon: PieChart, section: "strumenti", proOnly: true },
  { title: "Guide per te", url: "/guide-per-te", icon: Heart, section: "strumenti", adminOnly: !isGuideLive() },
];

// Voce standalone IMPOSTAZIONI (zona bassa in 57.2)
export const impostazioniNavItem: NavItem = { title: "Impostazioni", url: "/impostazioni", icon: Settings, section: "strumenti" };

// Gruppo SUPPORTO — parent collapsible con children
export const supportoNavItems: NavItem[] = [
  { title: "Scrivi feedback", url: "/feedback", icon: MessageSquare, section: "supporto" },
  { title: "Centro Assistenza", url: "/supporto", icon: Headphones, section: "supporto" },
];

// Parent Supporto per CollapsibleNavGroup (children include Call e Valuta Forfettino)
export const supportoParentItem: NavItem = {
  title: "Supporto",
  url: "/supporto",
  icon: Headphones,
  section: "supporto",
  children: [
    { title: "Scrivi feedback", url: "/feedback", icon: MessageSquare, section: "supporto" },
    { title: "Centro Assistenza", url: "/supporto", icon: Headphones, section: "supporto" },
    { title: "Call", url: "https://calendly.com/luca-versilia78/new-meeting-1", icon: Phone, section: "supporto", external: true },
    { title: "Valuta Forfettino", url: "/valuta", icon: Star, section: "supporto", conditional: true },
  ],
};

// Gruppo ADMIN
export const adminNavItems: NavItem[] = [
  { title: "Pannello Admin", url: "/admin", icon: ShieldCheck, section: "admin" },
  { title: "Parametri INPS", url: "/admin/parametri", icon: FileText, section: "admin" },
];

// Voce standalone MESSAGGI (tra Gestione e Strumenti, non in nessun gruppo)
export const messaggiNavItem: NavItem = { title: "Messaggi", url: "/messaggi", icon: Bell, section: "messaggi" };

// ── Section color lookup maps (full strings for Tailwind JIT) ──
export const sectionIconColor: Record<NavSection, string> = {
  dashboard: "text-nav-dashboard",
  gestione: "text-nav-gestione",
  pianificazione: "text-nav-pianificazione",
  messaggi: "text-nav-messaggi",
  strumenti: "text-nav-strumenti",
  supporto: "text-nav-supporto",
  admin: "text-nav-admin",
};
export const sectionActiveClass: Record<NavSection, string> = {
  dashboard: "bg-nav-dashboard-bg text-nav-dashboard font-semibold squircle-md",
  gestione: "bg-nav-gestione-bg text-nav-gestione font-semibold squircle-md",
  pianificazione: "bg-nav-pianificazione-bg text-nav-pianificazione font-semibold squircle-md",
  messaggi: "bg-nav-messaggi-bg text-nav-messaggi font-semibold squircle-md",
  strumenti: "bg-nav-strumenti-bg text-nav-strumenti font-semibold squircle-md",
  supporto: "bg-nav-supporto-bg text-nav-supporto font-semibold squircle-md",
  admin: "bg-nav-admin-bg text-nav-admin font-semibold squircle-md",
};

// Stili condivisi per nav items (esportati per CollapsibleNavGroup e altri consumer)
export const navLinkClass = "flex items-center gap-3 py-2.5 px-4 text-[14px] font-medium text-slate-600 hover:bg-slate-50 squircle-md transition-colors";
export const navIconClass = "h-[18px] w-[18px] shrink-0";
const sectionLabelClass = "px-4 py-1 text-xs font-bold text-slate-600 uppercase tracking-[0.08em] mt-1";

/** Inline PRO badge shown next to proOnly nav items for Free users */
function ProBadge() {
  return (
    <span className="ml-auto inline-flex items-center gap-0.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
      <Lock className="h-2.5 w-2.5" />
      Pro
    </span>
  );
}

interface AppSidebarProps {
  onOpenNpsSurvey?: () => void;
}

export function AppSidebar({ onOpenNpsSurvey }: AppSidebarProps = {}) {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { isPro, isLoading: subLoading } = useSubscription();
  const { data: userRole } = useUserRole();
  const { data: unreadCount = 0 } = useNotificationCount();
  const isAdmin = userRole === "admin";
  const location = useLocation();
  const navigate = useNavigate();

  const { isVisible: isNpsButtonVisible } = useNpsSidebarButton();
  const { overdueCount } = useOverdueTaskCount(isAdmin);

  return (
    <Sidebar collapsible="none" className="border-r border-slate-200 bg-white shadow-none" data-app-sidebar="true">
      <SidebarHeader className="px-4 pt-5 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center squircle-md bg-primary text-primary-foreground font-bold text-lg shadow-sm shrink-0">
            F
          </div>
          <span className="font-display font-bold text-xl tracking-tight text-slate-900">
            Forfettino
          </span>
          {!subLoading && (
            isAdmin ? (
              <Badge variant="destructive" className="text-xs px-1.5 py-0 h-5 gap-0.5">
                <ShieldCheck className="h-3 w-3" />
                Admin
              </Badge>
            ) : isPro ? (
              <Badge variant="default" className="text-xs px-1.5 py-0 h-5 gap-0.5">
                <Sparkles className="h-3 w-3" />
                Pro
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-xs px-1.5 py-0 h-5 cursor-pointer hover:bg-accent"
                onClick={() => navigate("/impostazioni?tab=abbonamento")}
              >
                Free
              </Badge>
            )
          )}
        </div>
        {/* Codice utente — subito sotto il logo come in Forfè */}
        <UserCodeBlock userCode={profile?.user_code} />
      </SidebarHeader>

      <SidebarContent>
        {/* nav landmark — WCAG 1.3.1 (Story 32-4, A-02) */}
        <nav aria-label="Navigazione principale">
        {/* DASHBOARD — standalone top item */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip={dashboardNavItem.title}>
                  <NavLink
                    to={dashboardNavItem.url}
                    className={navLinkClass}
                    activeClassName={sectionActiveClass[dashboardNavItem.section]}
                  >
                    <dashboardNavItem.icon className={`${navIconClass} ${sectionIconColor[dashboardNavItem.section]}`} />
                    <span>{dashboardNavItem.title}</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* MESSAGGI — standalone subito sotto Dashboard, no group label (AC3) */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip={messaggiNavItem.title}>
                  <NavLink
                    to={messaggiNavItem.url}
                    className={navLinkClass}
                    activeClassName={sectionActiveClass[messaggiNavItem.section]}
                    aria-label={unreadCount > 0 ? `Messaggi, ${unreadCount} non letti` : "Messaggi"}
                  >
                    <messaggiNavItem.icon className={`${navIconClass} ${sectionIconColor[messaggiNavItem.section]}`} />
                    <span>Messaggi</span>
                    {unreadCount > 0 && (
                      <span className="ml-auto flex items-center justify-center bg-destructive text-destructive-foreground h-5 min-w-[20px] px-1.5 text-xs font-bold rounded-full">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* GESTIONE */}
        <SidebarGroup>
          <SidebarGroupLabel id="gestione-nav" className={sectionLabelClass}>Gestione</SidebarGroupLabel>
          <SidebarGroupContent aria-labelledby="gestione-nav">
            <SidebarMenu>
              {gestioneNavItems.map((item) =>
                item.children ? (
                  <CollapsibleNavGroup
                    key={item.title}
                    item={item}
                    section={item.section}
                    filterChildren={(child) => !child.adminOnly || isAdmin}
                    renderSuffix={(child) => child.proOnly && !isPro && !isAdmin ? <ProBadge /> : null}
                  />
                ) : (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild tooltip={item.title}>
                      <NavLink
                        to={item.url}
                        className={navLinkClass}
                        activeClassName={sectionActiveClass[item.section]}
                      >
                        <item.icon className={`${navIconClass} ${sectionIconColor[item.section]}`} />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* PIANIFICAZIONE */}
        <SidebarGroup>
          <SidebarGroupLabel id="pianificazione-nav" className={sectionLabelClass}>Pianificazione</SidebarGroupLabel>
          <SidebarGroupContent aria-labelledby="pianificazione-nav">
            <SidebarMenu>
              {pianificazioneNavItems.filter((item) => !item.adminOnly || isAdmin).map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      className={navLinkClass}
                      activeClassName={sectionActiveClass[item.section]}
                      {...(item.url === "/task" && overdueCount > 0 && {
                        "aria-label": `Task, ${overdueCount} scaduti`,
                      })}
                    >
                      <item.icon className={`${navIconClass} ${sectionIconColor[item.section]}`} />
                      <span>{item.title}</span>
                      {item.proOnly && !isPro && !isAdmin ? (
                        <ProBadge />
                      ) : item.url === "/task" && overdueCount > 0 ? (
                        <span className="ml-auto bg-red-100 text-red-700 text-xs font-semibold rounded-full px-2 py-0.5 min-w-[20px] text-center">
                          {overdueCount}
                        </span>
                      ) : null}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* STRUMENTI */}
        <SidebarGroup>
          <SidebarGroupLabel id="strumenti-nav" className={sectionLabelClass}>Strumenti</SidebarGroupLabel>
          <SidebarGroupContent aria-labelledby="strumenti-nav">
            <SidebarMenu>
              {strumentiNavItems.filter((item) => !item.adminOnly || isAdmin).map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      className={navLinkClass}
                      activeClassName={sectionActiveClass[item.section]}
                    >
                      <item.icon className={`${navIconClass} ${sectionIconColor[item.section]}`} />
                      <span>{item.title}</span>
                      {item.proOnly && !isPro && !isAdmin && <ProBadge />}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* IMPOSTAZIONI — zona bassa standalone con divider */}
        <div className="mx-4 border-t border-slate-200/60" />
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip={impostazioniNavItem.title}>
                  <NavLink
                    to={impostazioniNavItem.url}
                    className={navLinkClass}
                    activeClassName={sectionActiveClass[impostazioniNavItem.section]}
                  >
                    <impostazioniNavItem.icon className={`${navIconClass} ${sectionIconColor[impostazioniNavItem.section]}`} />
                    <span>{impostazioniNavItem.title}</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Divider + SUPPORTO collapsible */}
        <div className="mx-4 border-t border-slate-200/60" />
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <CollapsibleNavGroup
                item={supportoParentItem}
                section="supporto"
                filterChildren={(child) => {
                  // proOnly/adminOnly filter (AC7 — applies to ALL collapsible children)
                  if (child.proOnly && !isPro && !isAdmin) return false;
                  if (child.adminOnly && !isAdmin) return false;
                  // Valuta Forfettino: visible only when NPS is active
                  if (child.conditional && child.url === "/valuta") {
                    return isNpsButtonVisible && !!onOpenNpsSurvey;
                  }
                  return true;
                }}
                onChildClick={(e, child) => {
                  // Feedback: pass origin page
                  if (child.url === "/feedback") {
                    e.preventDefault();
                    navigate("/feedback", { state: { from: location.pathname } });
                  }
                  // NPS: open survey instead of navigating
                  if (child.conditional && child.url === "/valuta") {
                    e.preventDefault();
                    onOpenNpsSurvey?.();
                  }
                }}
              />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ADMIN — only visible for admins */}
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel id="admin-nav" className={sectionLabelClass}>Admin</SidebarGroupLabel>
            <SidebarGroupContent aria-labelledby="admin-nav">
              <SidebarMenu>
                {adminNavItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild tooltip={item.title}>
                      <NavLink
                        to={item.url}
                        className={navLinkClass}
                        activeClassName={sectionActiveClass[item.section]}
                      >
                        <item.icon className={`${navIconClass} ${sectionIconColor[item.section]}`} />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        </nav>
      </SidebarContent>

      {/* Piano Free — usage counters in sidebar footer (Epic 13 Story D-bis) */}
      {!subLoading && !isPro && (
        <SidebarFooter className="border-t border-slate-100 px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-3.5 w-3.5 text-slate-600 shrink-0" />
            <span className="text-xs font-medium text-slate-700">Piano Free</span>
          </div>
          <UsageCounter compact className="text-xs" />
        </SidebarFooter>
      )}

      {/* Micro-footer legale — visibile per tutti gli utenti (Epic 35, Story 35-1) */}
      <div className="border-t border-slate-100 px-4 py-2 text-center">
        <nav aria-label="Link legali" className="text-xs text-muted-foreground">
          <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Privacy</a>
          <span className="mx-1">&middot;</span>
          <a href="/cookie-policy" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Cookie</a>
          <span className="mx-1">&middot;</span>
          <a href="/terms" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Termini</a>
        </nav>
      </div>
    </Sidebar>
  );
}
