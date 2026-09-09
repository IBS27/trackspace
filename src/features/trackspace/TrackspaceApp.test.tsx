// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TrackspaceApp } from "./TrackspaceApp";
import { CURATED } from "./data/selectors";
import type { Dataset } from "./data/types";

// The Command Center's three.js scene needs WebGL, which jsdom lacks.
vi.mock("./atlas/AtlasScene", () => ({
  AtlasScene: ({
    onLocationSelect, selectedLocationId, view, onReady, onError,
  }: {
    onLocationSelect: (id: string) => void;
    selectedLocationId: string | null;
    view: string;
    onReady: () => void;
    onError: (message: string) => void;
  }) => (
    <>
    <button type="button" data-location={selectedLocationId} data-view={view} onClick={() => onLocationSelect("ksc-lc39b")}>
      Mock scene marker
    </button>
    <button type="button" onClick={() => onError("Graphics context lost")}>Mock scene failure</button>
    <button type="button" onClick={onReady}>Mock scene recovery</button>
    </>
  ),
}));

afterEach(cleanup);

describe("TrackspaceApp", () => {
  it("renders the header with the gate, clock, and live status", () => {
    render(<TrackspaceApp />);

    const header = screen.getByRole("banner");
    expect(header.textContent).toContain("TRACKSPACE");
    expect(header.textContent).toContain("Next Gate");
    expect(header.textContent).toContain("UTC");
    expect(header.textContent).toContain("LIVE");
  });

  it("renders a tab for every view with the Command Center active", () => {
    render(<TrackspaceApp />);
    const nav = screen.getByRole("navigation", { name: "Trackspace views" });
    for (const name of [
      "Command Center",
      "Dependency Map",
      "Timeline",
      "Milestones",
      "Program",
    ]) {
      expect(nav.textContent).toContain(name);
    }
    expect(
      screen
        .getByRole("button", { name: "Command Center" })
        .getAttribute("aria-current"),
    ).toBe("page");
  });

  it("switches views when a tab is clicked", () => {
    render(<TrackspaceApp />);
    fireEvent.click(screen.getByRole("button", { name: "Dependency Map" }));
    expect(screen.getByText("All caps")).toBeTruthy();
  });

  it("activates the Program tab on click", () => {
    render(<TrackspaceApp />);
    const tab = screen.getByRole("button", { name: "Program" });

    fireEvent.click(tab);

    expect(screen.getByRole("heading", { name: "Program Health" })).toBeTruthy();
    expect(tab.getAttribute("aria-current")).toBe("page");
  });

  it("switches views with the number keys", () => {
    render(<TrackspaceApp />);

    fireEvent.keyDown(window, { key: "3" });
    expect(screen.getByText("Event Timeline")).toBeTruthy();

    fireEvent.keyDown(window, { key: "4" });
    expect(screen.getByText("Missions / Phases")).toBeTruthy();

    fireEvent.keyDown(window, { key: "5" });
    expect(screen.getByRole("heading", { name: "Program Health" })).toBeTruthy();

    fireEvent.keyDown(window, { key: "1" });
    expect(screen.getByText("Lunar-Base Readiness")).toBeTruthy();
  });

  it("ignores number keys with modifiers held", () => {
    render(<TrackspaceApp />);
    fireEvent.keyDown(window, { key: "3", metaKey: true });
    expect(screen.getByText("Lunar-Base Readiness")).toBeTruthy();
  });

  it("opens location evidence after selecting a scene marker", async () => {
    render(<TrackspaceApp />);
    fireEvent.click(await screen.findByRole("button", { name: "Mock scene marker" }));
    fireEvent.click(screen.getByRole("button", { name: "Open evidence" }));
    expect(
      screen.getByRole("dialog", { name: "Kennedy Space Center · LC-39B" }),
    ).toBeTruthy();
    expect(screen.getByText("Spatial anchor")).toBeTruthy();
  });

  it("focuses a site before opening its evidence and restores the overview", () => {
    render(<TrackspaceApp />);
    fireEvent.click(screen.getByRole("button", { name: "Kennedy Space Center · LC-39B" }));
    expect(screen.getByRole("button", { name: "Earth" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("dialog", { name: "Kennedy Space Center · LC-39B" })).toBeNull();
    expect(screen.getByRole("button", { name: "Open evidence" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear atlas selection" }));
    expect(screen.getByRole("button", { name: "Earth–Moon" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("button", { name: "Open evidence" })).toBeNull();
  });

  it("reveals conceptual surface systems only when their layer is enabled", () => {
    render(<TrackspaceApp />);
    fireEvent.click(screen.getByRole("button", { name: "South pole" }));
    expect(screen.queryByRole("button", { name: "Surface habitat concept" })).toBeNull();
    fireEvent.click(screen.getByRole("checkbox", { name: "Conceptual" }));
    fireEvent.click(screen.getByRole("button", { name: "Surface habitat concept" }));
    expect(screen.getByRole("heading", { name: "Surface habitat concept" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "South pole" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Open evidence" }));
    expect(screen.getByRole("dialog", { name: CURATED.capabilities.find((item) => item.id === "hab")?.name })).toBeTruthy();
  });

  it("frames infrastructure at its documented location", async () => {
    render(<TrackspaceApp />);
    const scene = await screen.findByRole("button", { name: "Mock scene marker" });
    fireEvent.click(screen.getByRole("button", { name: "South pole" }));
    fireEvent.click(screen.getByRole("button", { name: "Dust shield demonstration" }));
    expect(scene.getAttribute("data-view")).toBe("moon");
    expect(scene.getAttribute("data-location")).toBe("mare-crisium-blue-ghost");
    fireEvent.click(screen.getByRole("button", { name: "VIPER prospecting rover" }));
    expect(scene.getAttribute("data-view")).toBe("surface");
    expect(scene.getAttribute("data-location")).toBe("mons-mouton");
  });

  it("keeps the renderer mounted for context restoration and can retry initialization", async () => {
    render(<TrackspaceApp />);
    const originalScene = await screen.findByRole("button", { name: "Mock scene marker" });
    fireEvent.click(screen.getByRole("button", { name: "Mock scene failure" }));
    expect(screen.getByText("3D view unavailable")).toBeTruthy();
    expect(originalScene.isConnected).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Mock scene recovery" }));
    expect(screen.queryByText("3D view unavailable")).toBeNull();
    expect(originalScene.isConnected).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Mock scene failure" }));
    fireEvent.click(screen.getByRole("button", { name: "Retry 3D view" }));
    expect(originalScene.isConnected).toBe(false);
    expect(await screen.findByRole("button", { name: "Mock scene marker" })).toBeTruthy();
    expect(screen.queryByText("3D view unavailable")).toBeNull();
  });

  it.each(["javascript:alert(1)", "http://example.com/insecure"])(
    "does not render unsafe source URLs as links (%s)",
    async (url) => {
      const dataset: Dataset = {
        ...CURATED,
        locations: CURATED.locations.map((location) =>
          location.id === "ksc-lc39b"
            ? {
                ...location,
                sources: [
                  {
                    publisher: "Unsafe",
                    title: "Unsafe source",
                    tier: 4,
                    url,
                  },
                ],
              }
            : location,
        ),
      };

      render(<TrackspaceApp dataset={dataset} />);
      fireEvent.click(await screen.findByRole("button", { name: "Mock scene marker" }));
      fireEvent.click(screen.getByRole("button", { name: "Open evidence" }));

      const source = screen.getByText("Unsafe source").closest(".trackspace-source");
      expect(source?.tagName).toBe("SPAN");
      expect(source?.getAttribute("href")).toBeNull();
    },
  );
});
