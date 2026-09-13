"use client";

import dynamic from "next/dynamic";
import {
  Component,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { DrawerSelection } from "../components/DetailDrawer";
import { ArrowUpRightIcon, CloseIcon } from "../components/icons";
import { StatusChip } from "../components/StatusChip";
import type { Capability, Dataset } from "../data/types";
import {
  deriveAtlasContext,
  getAtlasInfrastructure,
  type AtlasSelection,
  type AtlasView,
  type InfrastructureStage,
} from "./model";
import "./atlas.css";
import { hasRegionalTerrain } from "./projection";

const AtlasScene = dynamic(
  () => import("./AtlasScene").then((module) => module.AtlasScene),
  { ssr: false },
);

class SceneBoundary extends Component<
  { children: ReactNode; onError: (message: string) => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError(
      "The interactive scene could not load. Site details and evidence are still available.",
    );
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

const VIEWS: {
  id: AtlasView;
  label: string;
  caption: string;
  title: string;
  description: string;
  scale: string;
}[] = [
  {
    id: "system",
    label: "Earth–Moon",
    caption: "Cislunar space",
    title: "Program sites, Earth to Moon",
    description:
      "Launch pads, test stands, and candidate landing regions tied to the lunar program. Select a site to see what depends on it.",
    scale: "Distances not to scale",
  },
  {
    id: "earth",
    label: "Earth",
    caption: "Earth sites",
    title: "Launch and test sites",
    description:
      "Where the hardware is built, tested, and launched. Select a site to see the capabilities and events it anchors.",
    scale: "Illustrative lighting",
  },
  {
    id: "moon",
    label: "Moon",
    caption: "Lunar globe",
    title: "Lunar sites",
    description:
      "Landing regions and demonstration sites across the Moon. Select a site to see its place in the program.",
    scale: "Illustrative lighting",
  },
  {
    id: "surface",
    label: "South pole",
    caption: "Lunar south pole",
    title: "South pole exploration",
    description:
      "Candidate regions and the systems a base needs to operate there. Symbols mark demonstrated, planned, and conceptual hardware.",
    scale: "LOLA regional terrain",
  },
];
const STAGES: InfrastructureStage[] = ["demonstrated", "planned", "conceptual"];

function evidenceSelection(
  dataset: Dataset,
  selection: AtlasSelection | null,
): DrawerSelection | null {
  if (!selection) return null;
  switch (selection.kind) {
    case "capability": {
      const capability = dataset.capabilities.find((item) => item.id === selection.id);
      return capability ? { type: "capability", id: capability.id } : null;
    }
    case "milestone": {
      const milestone = dataset.milestones.find((item) => item.id === selection.id);
      return milestone ? { type: "milestone", id: milestone.id } : null;
    }
    case "event":
      return { type: "event", id: selection.id };
    case "location":
      return { type: "location", id: selection.id };
  }
}

function LinkGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="atlas-linkgroup">
      <span className="trackspace-eyebrow">{label}</span>
      <div className="atlas-chips">{children}</div>
    </div>
  );
}

function CapabilityLinks({
  label,
  capabilities,
  onSelect,
}: {
  label: string;
  capabilities: readonly Capability[];
  onSelect: (selection: AtlasSelection) => void;
}) {
  if (!capabilities.length) return null;
  return (
    <LinkGroup label={label}>
      {capabilities.map((capability) => (
        <button
          key={capability.id}
          type="button"
          className="atlas-chip"
          data-status={capability.status}
          title={capability.name}
          onClick={() => onSelect({ kind: "capability", id: capability.id })}
        >
          <span className="atlas-chip-dot" aria-hidden="true" />
          {capability.name}
        </button>
      ))}
    </LinkGroup>
  );
}

export const MissionAtlas = memo(function MissionAtlas({
  dataset,
  selection,
  onSelectionChange,
  onOpen,
}: {
  dataset: Dataset;
  selection: AtlasSelection | null;
  onSelectionChange: (selection: AtlasSelection | null) => void;
  onOpen: (selection: DrawerSelection) => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!selection || window.innerWidth > 900) return;
    viewportRef.current
      ?.closest(".trackspace-cc")
      ?.scrollTo({ top: 0, behavior: "instant" });
  }, [selection]);
  const context = useMemo(() => deriveAtlasContext(dataset, selection), [dataset, selection]);
  const infrastructure = useMemo(() => getAtlasInfrastructure(dataset), [dataset]);
  const [viewOverride, setViewOverride] = useState<{
    selection: AtlasSelection | null;
    view: AtlasView;
  } | null>(null);
  const [infrastructureSelection, setInfrastructureSelection] = useState<{
    selection: AtlasSelection;
    id: string;
  } | null>(null);
  const [showConnections, setShowConnections] = useState(false);
  const [stages, setStages] = useState<InfrastructureStage[]>(["demonstrated", "planned"]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sceneGeneration, setSceneGeneration] = useState(0);
  const selectedInfrastructure =
    infrastructureSelection?.selection === selection
      ? infrastructure.find((item) => item.id === infrastructureSelection.id)
      : undefined;
  const primary = selectedInfrastructure
    ? dataset.locations.find(
        (location) => location.id === selectedInfrastructure.placement.anchorLocationId,
      )
    : context.locations.find((location) => location.id === context.primaryLocationId);
  const defaultView: AtlasView =
    primary?.body === "earth"
      ? "earth"
      : primary?.body === "moon"
        ? hasRegionalTerrain(primary)
          ? "surface"
          : "moon"
        : "system";
  const view = viewOverride?.selection === selection ? viewOverride.view : defaultView;
  const viewMeta = VIEWS.find((item) => item.id === view) ?? VIEWS[0];
  const focusedLocationId =
    primary &&
    (view === "system" ||
      (view === "earth" && primary.body === "earth") ||
      ((view === "moon" || view === "surface") && primary.body === "moon"))
      ? primary.id
      : null;
  const visibleInfrastructure = useMemo(
    () => infrastructure.filter((item) => stages.includes(item.stage)),
    [infrastructure, stages],
  );
  const evidence = evidenceSelection(dataset, context.selection);
  const selectedCapability =
    selection?.kind === "capability"
      ? dataset.capabilities.find((item) => item.id === selection.id)
      : undefined;
  const selectedEvent =
    selection?.kind === "event"
      ? dataset.events.find((item) => item.id === selection.id)
      : undefined;
  const selectedMilestone =
    selection?.kind === "milestone"
      ? dataset.milestones.find((item) => item.id === selection.id)
      : undefined;
  const selectedLocation =
    selection?.kind === "location"
      ? dataset.locations.find((item) => item.id === selection.id)
      : undefined;
  const selectedRecord =
    selectedCapability ?? selectedEvent ?? selectedMilestone ?? selectedLocation;
  const relatedCapabilities = useMemo(() => {
    const ids =
      selectedEvent?.caps ??
      selectedMilestone?.caps ??
      selectedLocation?.relatedCapabilities ??
      [];
    return dataset.capabilities.filter((capability) => ids.includes(capability.id));
  }, [dataset.capabilities, selectedEvent, selectedMilestone, selectedLocation]);
  const affectedMilestones = useMemo(() => {
    const ids = selectedCapability ? [selectedCapability.id] : (selectedEvent?.caps ?? []);
    return dataset.milestones.filter((milestone) =>
      milestone.caps.some((id) => ids.includes(id)),
    );
  }, [dataset.milestones, selectedCapability, selectedEvent]);
  const siteLocations =
    view === "system"
      ? context.locations
      : context.locations.filter(
          (location) =>
            location.body === (view === "earth" ? "earth" : "moon") &&
            (view !== "surface" || hasRegionalTerrain(location)),
        );
  const handleReady = useCallback(() => {
    setReady(true);
    setError(null);
  }, []);
  const retryScene = useCallback(() => {
    setError(null);
    setReady(false);
    setSceneGeneration((generation) => generation + 1);
  }, []);
  const handleError = useCallback((message: string) => setError(message), []);
  const selectLocation = useCallback(
    (id: string) => onSelectionChange({ kind: "location", id }),
    [onSelectionChange],
  );
  const selectInfrastructure = useCallback(
    (id: string) => {
      const item = infrastructure.find((candidate) => candidate.id === id);
      if (!item) return;
      const next: AtlasSelection = { kind: "capability", id: item.capabilityId };
      setInfrastructureSelection({ selection: next, id });
      const location = dataset.locations.find(
        (candidate) => candidate.id === item.placement.anchorLocationId,
      );
      const nextView: AtlasView =
        location?.body === "earth"
          ? "earth"
          : location && hasRegionalTerrain(location)
            ? "surface"
            : "moon";
      setViewOverride({ selection: next, view: nextView });
      onSelectionChange(next);
    },
    [dataset.locations, infrastructure, onSelectionChange],
  );
  const clearSelection = () => {
    setViewOverride(null);
    onSelectionChange(null);
  };

  const kicker = selectedInfrastructure
    ? `${selectedInfrastructure.stage} infrastructure`
    : context.selection
      ? selectedEvent
        ? `Update · ${selectedEvent.date}`
        : context.selection.kind
      : "Overview";
  const title =
    selectedInfrastructure?.name ?? (context.selection ? context.title : viewMeta.title);
  const description =
    selectedInfrastructure?.description ??
    (context.selection ? context.subtitle : viewMeta.description);
  const siteCount = siteLocations.length;
  const showSystems = (view === "surface" || view === "moon") && visibleInfrastructure.length > 0;

  return (
    <section className="trackspace-atlas" aria-label="Interactive mission atlas">
      <div className="atlas-header">
        <h2>Mission atlas</h2>
        <div className="trackspace-segmented" role="group" aria-label="Atlas viewpoint">
          {VIEWS.map((item) => (
            <button
              type="button"
              key={item.id}
              aria-pressed={view === item.id}
              onClick={() => setViewOverride({ selection, view: item.id })}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="atlas-viewport" ref={viewportRef}>
        <SceneBoundary key={sceneGeneration} onError={handleError}>
          <AtlasScene
            locations={context.locations}
            selectedLocationId={focusedLocationId}
            view={view}
            infrastructure={visibleInfrastructure}
            selectedInfrastructureId={selectedInfrastructure?.id ?? null}
            showConnections={showConnections && context.selection !== null}
            onLocationSelect={selectLocation}
            onInfrastructureSelect={selectInfrastructure}
            onReady={handleReady}
            onError={handleError}
          />
        </SceneBoundary>
        {/* Rendered in every scene state: the fallback site list below relies on these filters. */}
        <div className="atlas-layers" role="group" aria-label="Atlas layers">
          <label className="atlas-layer">
            <input
              type="checkbox"
              checked={showConnections}
              onChange={(event) => setShowConnections(event.target.checked)}
            />
            <span>Connections</span>
          </label>
          <span className="atlas-layer-divider" aria-hidden="true" />
          {STAGES.map((stage) => (
            <label className="atlas-layer" key={stage} data-stage={stage}>
              <input
                type="checkbox"
                checked={stages.includes(stage)}
                onChange={() =>
                  setStages((current) =>
                    current.includes(stage)
                      ? current.filter((item) => item !== stage)
                      : [...current, stage],
                  )
                }
              />
              <span>{stage[0].toUpperCase() + stage.slice(1)}</span>
            </label>
          ))}
        </div>
        {!ready && !error && (
          <div className="atlas-loading" role="status">
            <span className="atlas-loading-orbit" aria-hidden="true" />
            Loading the atlas
          </div>
        )}
        {error && (
          <div className="atlas-error" role="status">
            <strong>3D view unavailable</strong>
            <p>{error}</p>
            <button type="button" className="trackspace-btn" onClick={retryScene}>
              Retry 3D view
            </button>
          </div>
        )}
        {ready && !error && (
          <>
            <div className="atlas-caption">
              <strong>{viewMeta.caption}</strong>
              <span>
                {view === "surface"
                  ? "90° S"
                  : `${siteCount} mapped ${siteCount === 1 ? "site" : "sites"}`}
                {" · "}
                {viewMeta.scale}
              </span>
            </div>
            <span className="atlas-gesture-hint">Drag to orbit · Scroll to zoom</span>
          </>
        )}
      </div>

      <section className="atlas-context" aria-label="Atlas details">
        <div className="atlas-context-head">
          <div className="atlas-context-title">
            <span className="trackspace-eyebrow">{kicker}</span>
            <h3>{title}</h3>
          </div>
          <div className="atlas-context-actions">
            {selectedRecord && <StatusChip status={selectedRecord.status} />}
            {evidence && (
              <button type="button" className="trackspace-btn" onClick={() => onOpen(evidence)}>
                Open evidence
                <ArrowUpRightIcon size={13} />
              </button>
            )}
            {context.selection && (
              <button
                type="button"
                className="trackspace-iconbtn"
                aria-label="Clear atlas selection"
                onClick={clearSelection}
              >
                <CloseIcon size={14} />
              </button>
            )}
          </div>
        </div>
        <div
          className="atlas-context-body"
          key={`${selection?.kind ?? "overview"}:${selection?.id ?? view}:${selectedInfrastructure?.id ?? ""}`}
        >
          <div className="atlas-summary">
            <p className="atlas-description">{description}</p>
            {selectedEvent && (
              <div className="atlas-impact">
                <span className="trackspace-eyebrow">Program impact</span>
                <p className="atlas-description">{selectedEvent.downstream}</p>
              </div>
            )}
            {view === "surface" && (
              <p className="atlas-note">
                Symbols and base layout are illustrative. Planned and conceptual systems have
                not been deployed.
              </p>
            )}
            {showConnections && (
              <p className="atlas-note">
                {context.selection
                  ? "Connections show program relationships, not flight paths."
                  : "Select a capability, milestone, or update to show its connections."}
              </p>
            )}
          </div>
          <div className="atlas-context-links">
            <LinkGroup label={context.selection ? "Related sites" : "Sites in view"}>
              {siteLocations.map((location) => (
                <button
                  type="button"
                  key={location.id}
                  className="atlas-chip"
                  data-status={location.status}
                  aria-pressed={selection?.kind === "location" && selection.id === location.id}
                  onClick={() => selectLocation(location.id)}
                >
                  <span className="atlas-chip-dot" aria-hidden="true" />
                  {location.name}
                </button>
              ))}
              {siteLocations.length === 0 && (
                <p className="atlas-empty">
                  No mapped sites in this view.
                  {context.locations.length > 0
                    ? " Switch to Earth–Moon to see related locations."
                    : " Open the evidence for the documented program relationships."}
                </p>
              )}
            </LinkGroup>
            {showSystems && (
              <LinkGroup label="Lunar systems">
                {visibleInfrastructure.map((item) => (
                  <button
                    className="atlas-chip"
                    type="button"
                    key={item.id}
                    aria-pressed={selectedInfrastructure?.id === item.id}
                    onClick={() => selectInfrastructure(item.id)}
                  >
                    {item.name}
                  </button>
                ))}
              </LinkGroup>
            )}
            {context.selection && (
              <>
                <CapabilityLinks
                  label="Affected capabilities"
                  capabilities={relatedCapabilities}
                  onSelect={onSelectionChange}
                />
                <CapabilityLinks
                  label="Requires"
                  capabilities={context.upstream}
                  onSelect={onSelectionChange}
                />
                <CapabilityLinks
                  label="Enables"
                  capabilities={context.downstream}
                  onSelect={onSelectionChange}
                />
                {affectedMilestones.length > 0 && (
                  <LinkGroup label={selectedEvent ? "Affected milestones" : "Required for"}>
                    {affectedMilestones.map((milestone) => (
                      <button
                        key={milestone.id}
                        type="button"
                        className="atlas-chip"
                        title={milestone.name}
                        onClick={() => onSelectionChange({ kind: "milestone", id: milestone.id })}
                      >
                        {milestone.code}
                      </button>
                    ))}
                  </LinkGroup>
                )}
              </>
            )}
          </div>
        </div>
      </section>
    </section>
  );
});
