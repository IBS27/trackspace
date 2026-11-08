import { useEffect, useRef } from "react";

import { useEdgeFade } from "./useEdgeFade";

/**
 * Keeps the active item of a horizontally scrolling rail in view.
 * Returns a ref for the rail; `selector` matches its active item.
 */
export function useActiveIntoView<T extends HTMLElement>(selector: string, key: unknown) {
  const ref = useRef<T>(null);
  useEdgeFade(ref);

  useEffect(() => {
    const rail = ref.current;
    const active = rail?.querySelector<HTMLElement>(selector);
    if (!rail || !active || rail.scrollWidth <= rail.clientWidth) return;
    // Scroll only the rail, never the page.
    const left =
      active.getBoundingClientRect().left - rail.getBoundingClientRect().left + rail.scrollLeft;
    const target = left - (rail.clientWidth - active.offsetWidth) / 2;
    rail.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [selector, key]);

  return ref;
}
