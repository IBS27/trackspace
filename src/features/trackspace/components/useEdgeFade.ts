import { useEffect, useRef, type RefObject } from "react";

/**
 * Marks a scroller with `data-fade` (horizontal) or `data-fade-y` (vertical):
 * "start" | "end" | "both" | "none", so CSS fades only the edges that still
 * have content past them.
 */
export function useEdgeFade<T extends HTMLElement>(
  existing?: RefObject<T | null>,
  axis: "x" | "y" = "x",
  /** Re-attach when this changes, e.g. when the scroller mounts later. */
  key?: unknown,
) {
  const own = useRef<T>(null);
  const ref = existing ?? own;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const position = axis === "x" ? el.scrollLeft : el.scrollTop;
      const max =
        axis === "x" ? el.scrollWidth - el.clientWidth : el.scrollHeight - el.clientHeight;
      const start = position > 2;
      const end = position < max - 2;
      const value = start && end ? "both" : start ? "start" : end ? "end" : "none";
      // Write only on change so the mutation observer below cannot loop.
      if (axis === "x" && el.dataset.fade !== value) el.dataset.fade = value;
      if (axis === "y" && el.dataset.fadeY !== value) el.dataset.fadeY = value;
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(el);
    // Content can grow without the scroller resizing (e.g. a fold opening).
    const mutations =
      typeof MutationObserver === "undefined" ? null : new MutationObserver(update);
    mutations?.observe(el, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["open"],
    });
    return () => {
      el.removeEventListener("scroll", update);
      observer?.disconnect();
      mutations?.disconnect();
    };
  }, [ref, axis, key]);

  return ref;
}
