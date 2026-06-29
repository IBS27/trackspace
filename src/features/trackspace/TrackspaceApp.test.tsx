// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TrackspaceApp } from "./TrackspaceApp";
import { CURATED } from "./data/selectors";
import type { Dataset } from "./data/types";

// The Command Center's three.js scene needs WebGL, which jsdom lacks.
vi.mock("./scene/EarthMoonScene", () => ({
  EarthMoonScene: ({
    onLocationOpen,
  }: {
    onLocationOpen: (id: string) => void;
  }) => (
    <button type="button" onClick={() => onLocationOpen("ksc-lc39b")}>
      Mock scene marker
    </button>
  ),
}));

afterEach(cleanup);

describe("TrackspaceApp", () => {
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

  it("opens a location drawer from a scene marker", () => {
    render(<TrackspaceApp />);
    fireEvent.click(screen.getByRole("button", { name: "Mock scene marker" }));
    expect(
      screen.getByRole("dialog", { name: "Kennedy Space Center · LC-39B" }),
    ).toBeTruthy();
    expect(screen.getByText("Spatial anchor")).toBeTruthy();
  });

  it("does not render unsafe source URLs as links", () => {
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
                  url: "javascript:alert(1)",
                },
              ],
            }
          : location,
      ),
    };

    render(<TrackspaceApp dataset={dataset} />);
    fireEvent.click(screen.getByRole("button", { name: "Mock scene marker" }));

    const source = screen.getByText("Unsafe source").closest(".trackspace-source");
    expect(source?.tagName).toBe("SPAN");
    expect(source?.getAttribute("href")).toBeNull();
  });
});
