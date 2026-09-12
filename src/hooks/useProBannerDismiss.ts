import { useState, useCallback } from "react";

const STORAGE_PREFIX = "pro-banner-dismissed-";

function readDismissed(triggerId: string): boolean {
  try {
    return sessionStorage.getItem(`${STORAGE_PREFIX}${triggerId}`) === "true";
  } catch {
    return false;
  }
}

export function useProBannerDismiss(triggerId: string) {
  const [isDismissed, setIsDismissed] = useState(() => readDismissed(triggerId));

  const dismiss = useCallback(() => {
    try {
      sessionStorage.setItem(`${STORAGE_PREFIX}${triggerId}`, "true");
    } catch {
      // SSR or incognito — state-only dismiss
    }
    setIsDismissed(true);
  }, [triggerId]);

  return { isDismissed, dismiss };
}
