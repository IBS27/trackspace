"use client";

import { memo, useEffect, useRef } from "react";
import type { Location } from "../data/types";
import type { AtlasInfrastructure, AtlasView } from "./model";
import { createAtlasRenderer, type AtlasRenderer } from "./renderer";

export type AtlasSceneProps = {
  locations: readonly Location[];
  selectedLocationId: string | null;
  selectedInfrastructureId?: string | null;
  view: AtlasView;
  infrastructure: readonly AtlasInfrastructure[];
  showConnections: boolean;
  onLocationSelect: (id: string) => void;
  onInfrastructureSelect: (id: string) => void;
  onReady: () => void;
  onError: (message: string) => void;
};

export const AtlasScene = memo(function AtlasScene(props: AtlasSceneProps) {
  const container = useRef<HTMLDivElement>(null);
  const renderer = useRef<AtlasRenderer | null>(null);
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });
  useEffect(() => {
    if (!container.current) return;
    let scene: AtlasRenderer | null = null;
    const setup = () => {
      scene?.dispose();
      try {
        scene = createAtlasRenderer(container.current!, {
          onLocationSelect: (id) => latest.current.onLocationSelect(id),
          onInfrastructureSelect: (id) =>
            latest.current.onInfrastructureSelect(id),
          onReady: () => latest.current.onReady(),
          onError: (message) => latest.current.onError(message),
        });
        renderer.current = scene;
        scene.update(latest.current);
      } catch {
        latest.current.onError(
          "The 3D view could not start. You can still explore sites and evidence below.",
        );
      }
    };
    setup();
    return () => {
      renderer.current = null;
      scene?.dispose();
    };
  }, []);
  useEffect(() => {
    renderer.current?.update(props);
  }, [props]);
  return (
    <div
      ref={container}
      className="atlas-renderer"
      style={{ position: "absolute", inset: 0, overflow: "hidden" }}
    />
  );
});
