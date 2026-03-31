import { useState, useEffect } from "react";

const MOBILE_BREAKPOINT = 767;
const MEDIA_QUERY = `(max-width: ${MOBILE_BREAKPOINT}px)`;

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(MEDIA_QUERY).matches;
  });

  useEffect(() => {
    const mql = window.matchMedia(MEDIA_QUERY);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return isMobile;
}
