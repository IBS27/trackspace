"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { useState, type ReactNode } from "react";

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const [convex] = useState(() => {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) {
      throw new Error(
        "NEXT_PUBLIC_CONVEX_URL is not set. Run `bunx --bun convex dev` before starting Next.js.",
      );
    }
    return new ConvexReactClient(url);
  });

  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
