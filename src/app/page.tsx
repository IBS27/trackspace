import { TrackspaceApp } from "@/features/trackspace/TrackspaceApp";
import "@/features/trackspace/styles/trackspace.css";
import { loadDataset } from "@/ingest/load-dataset";

// Read the live snapshot from SQLite on each request (the ingestion pipeline
// keeps it current). Falls back to the curated baseline if the database is
// empty or unavailable, so the page always renders the true status.
export const dynamic = "force-dynamic";

export default function Home() {
  const dataset = loadDataset();
  return <TrackspaceApp dataset={dataset} />;
}
