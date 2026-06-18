"use client";

// Makes the active Dataset available to every screen without prop-drilling.
//
// The default is the curated baseline, so a screen rendered on its own (e.g. in
// a test) still has real data. The app wraps its tree in <DatasetProvider> with
// whichever Dataset the server loaded — the curated baseline, or a live SQLite
// snapshot — and the screens read it with useDataset().

import { createContext, useContext, type ReactNode } from "react";

import { CURATED } from "./selectors";
import type { Dataset } from "./types";

const DatasetContext = createContext<Dataset>(CURATED);

export function DatasetProvider({
  value,
  children,
}: {
  value: Dataset;
  children: ReactNode;
}) {
  return <DatasetContext.Provider value={value}>{children}</DatasetContext.Provider>;
}

export function useDataset(): Dataset {
  return useContext(DatasetContext);
}
