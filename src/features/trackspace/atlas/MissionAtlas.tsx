"use client";

import dynamic from "next/dynamic";
import { Component, memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import type { DrawerSelection } from "../components/DetailDrawer";
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

class SceneBoundary extends Component<{ children: ReactNode; onError: (message: string) => void }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  componentDidCatch() {
    this.props.onError("The interactive scene could not load. Site details and evidence are still available.");
  }

  render() { return this.state.failed ? null : this.props.children; }
}

const VIEWS: { id: AtlasView; label: string; caption: string }[] = [
  { id: "system", label: "Earth–Moon", caption: "Cislunar space" },
  { id: "earth", label: "Earth", caption: "Earth sites" },
  { id: "moon", label: "Moon", caption: "Lunar globe" },
  { id: "surface", label: "South pole", caption: "Lunar south pole" },
];
const STAGES: InfrastructureStage[] = ["demonstrated", "planned", "conceptual"];

function evidenceSelection(dataset: Dataset, selection: AtlasSelection | null): DrawerSelection | null {
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
    case "event": return { type: "event", id: selection.id };
    case "location": return { type: "location", id: selection.id };
  }
}

function CapabilityLinks({ label, capabilities, onSelect }: {
  label: string;
  capabilities: readonly Capability[];
  onSelect: (selection: AtlasSelection) => void;
}) {
  if (!capabilities.length) return null;
  return (
    <div className="atlas-dependency-row">
      <span className="atlas-section-label">{label}</span>
      <div className="atlas-capabilities">
        {capabilities.map((capability) => (
          <button key={capability.id} type="button" className="atlas-capability" data-status={capability.status}
            title={capability.name} onClick={() => onSelect({ kind: "capability", id: capability.id })}>
            {capability.short}
          </button>
        ))}
      </div>
    </div>
  );
}

export const MissionAtlas = memo(function MissionAtlas({ dataset, selection, onSelectionChange, onOpen }: {
  dataset: Dataset;
  selection: AtlasSelection | null;
  onSelectionChange: (selection: AtlasSelection | null) => void;
  onOpen: (selection: DrawerSelection) => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!selection || window.innerWidth > 900) return;
    viewportRef.current?.closest(".trackspace-cc")?.scrollTo({ top: 0, behavior: "instant" });
  }, [selection]);
  const context = useMemo(() => deriveAtlasContext(dataset, selection), [dataset, selection]);
  const infrastructure = useMemo(() => getAtlasInfrastructure(dataset), [dataset]);
  const [viewOverride, setViewOverride] = useState<{ selection: AtlasSelection | null; view: AtlasView } | null>(null);
  const [infrastructureSelection, setInfrastructureSelection] = useState<{ selection: AtlasSelection; id: string } | null>(null);
  const [showConnections, setShowConnections] = useState(false);
  const [stages, setStages] = useState<InfrastructureStage[]>(["demonstrated", "planned"]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sceneGeneration, setSceneGeneration] = useState(0);
  const selectedInfrastructure = infrastructureSelection?.selection === selection
    ? infrastructure.find((item) => item.id === infrastructureSelection.id) : undefined;
  const primary = selectedInfrastructure
    ? dataset.locations.find((location) => location.id === selectedInfrastructure.placement.anchorLocationId)
    : context.locations.find((location) => location.id === context.primaryLocationId);
  const defaultView: AtlasView = primary?.body === "earth" ? "earth" : primary?.body === "moon" ? (hasRegionalTerrain(primary) ? "surface" : "moon") : "system";
  const view = viewOverride?.selection === selection ? viewOverride.view : defaultView;
  const viewMeta = VIEWS.find((item) => item.id === view) ?? VIEWS[0];
  const focusedLocationId = primary && (
    view === "system" || (view === "earth" && primary.body === "earth") ||
    ((view === "moon" || view === "surface") && primary.body === "moon")
  ) ? primary.id : null;
  const visibleInfrastructure = useMemo(
    () => infrastructure.filter((item) => stages.includes(item.stage)),
    [infrastructure, stages],
  );
  const evidence = evidenceSelection(dataset, context.selection);
  const selectedCapability = selection?.kind === "capability"
    ? dataset.capabilities.find((item) => item.id === selection.id) : undefined;
  const selectedEvent = selection?.kind === "event"
    ? dataset.events.find((item) => item.id === selection.id) : undefined;
  const selectedMilestone = selection?.kind === "milestone"
    ? dataset.milestones.find((item) => item.id === selection.id) : undefined;
  const selectedLocation = selection?.kind === "location"
    ? dataset.locations.find((item) => item.id === selection.id) : undefined;
  const selectedRecord = selectedCapability ?? selectedEvent ?? selectedMilestone ?? selectedLocation;
  const relatedCapabilities = useMemo(() => {
    const ids = selectedEvent?.caps ?? selectedMilestone?.caps ?? selectedLocation?.relatedCapabilities ?? [];
    return dataset.capabilities.filter((capability) => ids.includes(capability.id));
  }, [dataset.capabilities, selectedEvent, selectedMilestone, selectedLocation]);
  const affectedMilestones = useMemo(() => {
    const ids = selectedCapability ? [selectedCapability.id] : selectedEvent?.caps ?? [];
    return dataset.milestones.filter((milestone) => milestone.caps.some((id) => ids.includes(id)));
  }, [dataset.milestones, selectedCapability, selectedEvent]);
  const siteLocations = view === "system" ? context.locations : context.locations.filter((location) =>
    location.body === (view === "earth" ? "earth" : "moon") &&
      (view !== "surface" || (hasRegionalTerrain(location))),
  );
  const handleReady = useCallback(() => { setReady(true); setError(null); }, []);
  const retryScene = useCallback(() => {
    setError(null);
    setReady(false);
    setSceneGeneration((generation) => generation + 1);
  }, []);
  const handleError = useCallback((message: string) => setError(message), []);
  const selectLocation = useCallback((id: string) => onSelectionChange({ kind: "location", id }), [onSelectionChange]);
  const selectInfrastructure = useCallback((id: string) => {
    const item = infrastructure.find((candidate) => candidate.id === id);
    if (!item) return;
    const next: AtlasSelection = { kind: "capability", id: item.capabilityId };
    setInfrastructureSelection({ selection: next, id });
    const location = dataset.locations.find((candidate) => candidate.id === item.placement.anchorLocationId);
    const nextView: AtlasView = location?.body === "earth" ? "earth" : location && hasRegionalTerrain(location) ? "surface" : "moon";
    setViewOverride({ selection: next, view: nextView });
    onSelectionChange(next);
  }, [dataset.locations, infrastructure, onSelectionChange]);

  return (
    <section className="trackspace-atlas" aria-label="Interactive mission atlas">
      <div className="atlas-header">
        <div className="atlas-identity">
          <span className="atlas-eyebrow">Spatial context</span>
          <h2>Mission atlas</h2>
        </div>
        <div className="atlas-views" role="group" aria-label="Atlas viewpoint">
          {VIEWS.map((item) => (
            <button type="button" key={item.id} aria-pressed={view === item.id}
              onClick={() => setViewOverride({ selection, view: item.id })}>{item.label}</button>
          ))}
        </div>
      </div>
      <div className="atlas-viewport" ref={viewportRef}>
        <SceneBoundary key={sceneGeneration} onError={handleError}><AtlasScene locations={context.locations} selectedLocationId={focusedLocationId} view={view}
          infrastructure={visibleInfrastructure} selectedInfrastructureId={selectedInfrastructure?.id ?? null} showConnections={showConnections && context.selection !== null}
          onLocationSelect={selectLocation} onInfrastructureSelect={selectInfrastructure}
          onReady={handleReady} onError={handleError} /></SceneBoundary>
        {!ready && !error && <div className="atlas-loading" role="status"><span className="atlas-loading-orbit" aria-hidden="true" />Preparing the atlas<span className="atlas-note">Loading planetary imagery</span></div>}
        {error && <div className="atlas-error" role="status"><strong>3D view unavailable</strong><p>{error}</p><p>Explore the sites and their evidence below.</p><button type="button" className="atlas-evidence" onClick={retryScene}>Retry 3D view</button></div>}
        {ready && !error && <>
          <div className="atlas-viewport-caption"><strong>{viewMeta.caption}</strong><span>{view === "surface" ? "90° S · Regional terrain" : `${siteLocations.length} mapped ${siteLocations.length === 1 ? "site" : "sites"}`}</span></div>
          <div className="atlas-viewport-footer"><span>{view === "surface" ? "LOLA terrain · illustrative lighting" : view === "system" ? "Distance compressed · geographic context" : "Geographic context · illustrative lighting"}</span><span className="atlas-gesture-hint">Drag to orbit · scroll to zoom</span></div>
        </>}
      </div>
      <div className="atlas-context">
        <div className="atlas-layerbar" role="group" aria-label="Atlas layers">
          <span className="atlas-layer-label">Layers</span>
          <label className="atlas-toggle"><input type="checkbox" checked={showConnections} onChange={(event) => setShowConnections(event.target.checked)} /><span>Connections</span></label>
          <span className="atlas-layer-divider" aria-hidden="true" />
          {STAGES.map((stage) => <label className="atlas-toggle" key={stage}><input type="checkbox" checked={stages.includes(stage)} onChange={() => setStages((current) => current.includes(stage) ? current.filter((item) => item !== stage) : [...current, stage])} /><span>{stage[0].toUpperCase() + stage.slice(1)}</span></label>)}
        </div>
        <div className="atlas-context-body">
          <div>
            <div className="atlas-context-heading">
              <div>
                <span className="atlas-section-label">{selectedInfrastructure ? `${selectedInfrastructure.stage} infrastructure` : context.selection ? selectedEvent ? `What changed · ${selectedEvent.date}` : context.selection.kind : view === "surface" ? "Lunar infrastructure" : "Program geography"}</span>
                <h3>{selectedInfrastructure?.name ?? (context.selection ? context.title : view === "surface" ? "South pole exploration" : "Earth–Moon infrastructure")}</h3>
              </div>
              {context.selection && <button type="button" className="atlas-clear" aria-label="Clear atlas selection" onClick={() => { setViewOverride({ selection: null, view: "system" }); onSelectionChange(null); }}>×</button>}
            </div>
            <p className="atlas-description">{selectedInfrastructure?.description ?? (context.selection ? context.subtitle : view === "surface" ? "Explore candidate regions and the systems needed to live and work on the Moon. Select a symbol to inspect its capability." : "Select a site, blocker, milestone, or recent update to explore its place in the lunar program.")}</p>
            {selectedEvent && <p className="atlas-description">{selectedEvent.downstream}</p>}
            <div className="atlas-context-meta">
              {selectedRecord && <StatusChip status={selectedRecord.status} />}
              {evidence && <button type="button" className="atlas-evidence" onClick={() => onOpen(evidence)}>Open evidence <span aria-hidden="true">↗</span></button>}
            </div>
            {view === "surface" && <p className="atlas-note">Symbols and base layout are illustrative. Planned and conceptual systems have not been deployed.</p>}
            {showConnections && <p className="atlas-note">{context.selection ? "Connections show program relationships, not flight paths." : "Select a capability, milestone, or update to show its connections."}</p>}
          </div>
          <div className="atlas-context-links">
            <span className="atlas-section-label">{context.selection ? "Related sites" : "Explore sites"}</span>
            <div className="atlas-sites">
              {siteLocations.map((location) => <button type="button" key={location.id} className="atlas-site" aria-pressed={selection?.kind === "location" && selection.id === location.id}
                onClick={() => selectLocation(location.id)}><span className="atlas-site-dot" aria-hidden="true" />{location.name}</button>)}
              {siteLocations.length === 0 && <p className="atlas-empty">No mapped sites in this view.{context.locations.length > 0 ? " Switch to Earth–Moon to see related locations." : " Open the evidence for the documented program relationships."}</p>}
            </div>
            {(view === "surface" || view === "moon") && visibleInfrastructure.length > 0 && <div className="atlas-dependencies"><span className="atlas-section-label">Lunar systems</span><div className="atlas-infrastructure-list">{visibleInfrastructure.map((item) => <button className="atlas-capability" type="button" key={item.id} onClick={() => selectInfrastructure(item.id)}>{item.name}</button>)}</div></div>}
            {context.selection && <div className="atlas-dependencies">
              <CapabilityLinks label="Affected capabilities" capabilities={relatedCapabilities} onSelect={onSelectionChange} />
              <CapabilityLinks label="Requires" capabilities={context.upstream} onSelect={onSelectionChange} />
              <CapabilityLinks label="Enables" capabilities={context.downstream} onSelect={onSelectionChange} />
              {affectedMilestones.length > 0 && <div className="atlas-dependency-row"><span className="atlas-section-label">{selectedEvent ? "Affected milestones" : "Required for"}</span><div className="atlas-capabilities">{affectedMilestones.map((milestone) => <button key={milestone.id} type="button" className="atlas-capability" onClick={() => onSelectionChange({ kind: "milestone", id: milestone.id })}>{milestone.code}</button>)}</div></div>}
            </div>}
          </div>
        </div>
      </div>
    </section>
  );
});
