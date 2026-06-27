// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TrackspaceApp } from "./TrackspaceApp";

// The Command Center's three.js scene needs WebGL, which jsdom lacks.
vi.mock("./scene/EarthMoonScene", () => ({
  EarthMoonScene: () => null,
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
});
