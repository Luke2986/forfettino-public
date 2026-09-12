/* eslint-disable react-refresh/only-export-components */
import { useLocation } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import type { NavItem, NavSection } from "./AppSidebar";
import { sectionActiveClass, sectionIconColor, navLinkClass, navIconClass } from "./AppSidebar";
export const childLinkClass = "flex items-center py-2 pl-10 pr-4 text-[14px] font-medium text-slate-600 hover:bg-slate-50 squircle-md transition-colors";

interface CollapsibleNavGroupProps {
  item: NavItem;
  section: NavSection;
  /** Filter function for children (e.g. adminOnly) */
  filterChildren?: (child: NavItem) => boolean;
  /** Render a suffix element (e.g. PRO badge) after a child's title */
  renderSuffix?: (child: NavItem) => React.ReactNode;
  onNavigate?: () => void;
  /** Custom click handler for specific children (e.g. feedback origin tracking) */
  onChildClick?: (e: React.MouseEvent, child: NavItem) => void;
}

export function CollapsibleNavGroup({
  item,
  section,
  filterChildren,
  renderSuffix,
  onNavigate,
  onChildClick,
}: CollapsibleNavGroupProps) {
  const location = useLocation();
  const children = item.children ?? [];
  const visibleChildren = filterChildren ? children.filter(filterChildren) : children;

  // Auto-open if parent or any child route is active
  const isParentActive = location.pathname === item.url;
  const isChildActive = visibleChildren.some((child) => location.pathname === child.url);
  const defaultOpen = isParentActive || isChildActive;

  const hasChildren = visibleChildren.length > 0;

  // No visible children → render as a plain nav link (e.g. "Clienti" for Free users)
  if (!hasChildren) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton asChild tooltip={item.title}>
          <NavLink
            to={item.url}
            className={navLinkClass}
            activeClassName={sectionActiveClass[section]}
            onClick={onNavigate}
          >
            <item.icon className={`${navIconClass} ${sectionIconColor[section]}`} />
            <span>{item.title}</span>
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  // Has children → parent is toggle-only, NEVER a link (children own the navigation)
  return (
    <Collapsible defaultOpen={defaultOpen} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={item.title} className={`${navLinkClass} w-full`}>
            <item.icon className={`${navIconClass} ${sectionIconColor[section]}`} />
            <span className="flex-1">{item.title}</span>
            <ChevronDown className="h-4 w-4 text-slate-500 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-0 group-data-[state=closed]/collapsible:-rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
      </SidebarMenuItem>

      <CollapsibleContent>
        <SidebarMenu>
          {visibleChildren.map((child) => (
            <SidebarMenuItem key={child.url}>
              <SidebarMenuButton asChild tooltip={child.title}>
                {child.external ? (
                  <a
                    href={child.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={childLinkClass}
                    onClick={onNavigate}
                  >
                    <span>{child.title}</span>
                  </a>
                ) : (
                  <NavLink
                    to={child.url}
                    className={childLinkClass}
                    activeClassName={sectionActiveClass[section]}
                    onClick={(e) => {
                      onChildClick?.(e, child);
                      onNavigate?.();
                    }}
                  >
                    <span>{child.title}</span>
                    {renderSuffix?.(child)}
                  </NavLink>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </CollapsibleContent>
    </Collapsible>
  );
}
