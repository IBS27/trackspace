import { useEffect, useRef, type RefObject } from "react";

/**
 * Marks a horizontal scroller with `data-fade="start" | "end" | "both" | "none"`
 * so CSS can fade only the edges that still have content past them.
 */
export function useEdgeFade<T extends HTMLElement>(existing?: RefObject<T | null>) {
  const own = useRef<T>(null);
  const ref = existing ?? own;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      const start = el.scrollLeft > 2;
      const end = el.scrollLeft < max - 2;
      el.dataset.fade = start && end ? "both" : start ? "start" : end ? "end" : "none";
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      observer?.disconnect();
    };
  }, [ref]);

  return ref;
}
