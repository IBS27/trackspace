import { connection } from "next/server";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { TrackspaceApp } from "@/features/trackspace/TrackspaceApp";
import { CURATED } from "@/features/trackspace/data/selectors";
import type { Dataset } from "@/features/trackspace/data/types";
import { api } from "@/lib/convex";
import { getConvexHttpClient } from "@/lib/convex-server";
import "@/features/trackspace/styles/trackspace.css";

async function loadInitialDataset(): Promise<Dataset> {
  try {
    return (await getConvexHttpClient().query(api.trackspace.dataset)) ?? CURATED;
  } catch {
    return CURATED;
  }
}

export default async function Home() {
  await connection();
  const dataset = await loadInitialDataset();

  return (
    <ConvexClientProvider>
      <TrackspaceApp live dataset={dataset} />
    </ConvexClientProvider>
  );
}
