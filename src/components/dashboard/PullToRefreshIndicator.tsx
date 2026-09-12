import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  pullProgress: number;
  isRefreshing: boolean;
  threshold?: number;
}

export function PullToRefreshIndicator({
  pullDistance,
  pullProgress,
  isRefreshing,
  threshold = 80,
}: PullToRefreshIndicatorProps) {
  if (pullDistance === 0 && !isRefreshing) return null;

  const rotation = pullProgress * 180; // Rotate based on pull progress
  const scale = 0.5 + pullProgress * 0.5; // Scale from 0.5 to 1
  const opacity = Math.min(pullProgress * 1.5, 1);

  return (
    <div
      className="flex items-center justify-center transition-all duration-150 ease-out overflow-hidden"
      style={{
        height: `${pullDistance}px`,
        marginTop: pullDistance > 0 ? "-8px" : 0,
        marginBottom: pullDistance > 0 ? "8px" : 0,
      }}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-full bg-primary/10 p-2",
          isRefreshing && "animate-spin"
        )}
        style={{
          opacity,
          transform: isRefreshing 
            ? "scale(1)" 
            : `rotate(${rotation}deg) scale(${scale})`,
          transition: isRefreshing ? "none" : "transform 0.1s ease-out",
        }}
      >
        <RefreshCw className="h-5 w-5 text-primary" />
      </div>
      {pullProgress >= 1 && !isRefreshing && (
        <span className="ml-2 text-xs text-muted-foreground animate-pulse">
          Rilascia per aggiornare
        </span>
      )}
    </div>
  );
}
