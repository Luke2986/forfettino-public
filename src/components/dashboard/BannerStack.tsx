import { useState, Children, isValidElement, type ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";

interface BannerStackProps {
  children: ReactNode;
  /** Max banners visible on mobile before collapsing. Default: 2 */
  mobileLimit?: number;
}

export function BannerStack({ children, mobileLimit = 2 }: BannerStackProps) {
  const isMobile = useIsMobile();
  const [isExpanded, setIsExpanded] = useState(false);

  // Filter out null/undefined/false children (conditional renders)
  const validChildren = Children.toArray(children).filter(isValidElement);

  // Desktop: show all banners, no stacking limit
  if (!isMobile || validChildren.length <= mobileLimit) {
    return <>{validChildren}</>;
  }

  // Mobile with overflow: show first N, hide rest behind toggle
  const visibleBanners = validChildren.slice(0, mobileLimit);
  const hiddenBanners = validChildren.slice(mobileLimit);
  const hiddenCount = hiddenBanners.length;

  return (
    <div role="region" aria-label="Avvisi" aria-live="polite">
      {visibleBanners}
      {!isExpanded ? (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setIsExpanded(true)}
          aria-expanded={false}
          aria-controls="banner-hidden-content"
          aria-label={`Mostra ${hiddenCount} ${hiddenCount === 1 ? "altro avviso" : "altri avvisi"}`}
        >
          <ChevronDown className="h-3 w-3 mr-1" />
          {hiddenCount === 1 ? "1 altro avviso" : `${hiddenCount} altri avvisi`}
        </Button>
      ) : (
        <>
          <div id="banner-hidden-content">
            {hiddenBanners}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setIsExpanded(false)}
            aria-expanded={true}
            aria-controls="banner-hidden-content"
            aria-label="Nascondi avvisi"
          >
            <ChevronUp className="h-3 w-3 mr-1" />
            Nascondi avvisi
          </Button>
        </>
      )}
    </div>
  );
}
