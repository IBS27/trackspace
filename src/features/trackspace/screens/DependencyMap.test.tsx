// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CAPABILITIES } from "../data/seed";
import { getDependencyEdges } from "../data/selectors";
import { DependencyMap } from "./DependencyMap";

afterEach(cleanup);

function nodeButton(name: string): HTMLElement {
  return screen.getByRole("button", { name: new RegExp(name) });
}

describe("DependencyMap", () => {
  it("renders a node card for every capability", () => {
    render(<DependencyMap onOpen={() => {}} />);
    for (const capability of CAPABILITIES) {
      expect(nodeButton(capability.name)).toBeTruthy();
    }
  });

  it("renders one edge per dependency", () => {
    const { container } = render(<DependencyMap onOpen={() => {}} />);
    const edges = container.querySelectorAll(".trackspace-edges > path");
    expect(edges.length).toBe(getDependencyEdges().length);
  });

  it("opens the drawer with the clicked capability", () => {
    const onOpen = vi.fn();
    render(<DependencyMap onOpen={onOpen} />);
    const capability = CAPABILITIES[0];
    fireEvent.click(nodeButton(capability.name));
    expect(onOpen).toHaveBeenCalledWith({
      type: "capability",
      id: capability.id,
    });
  });

  it("dims nodes outside the active group filter", () => {
    render(<DependencyMap onOpen={() => {}} />);
    const inGroup = CAPABILITIES.find((c) => c.group === "launch")!;
    const outOfGroup = CAPABILITIES.find((c) => c.group !== "launch")!;

    fireEvent.click(screen.getByRole("button", { name: "launch" }));

    expect(nodeButton(inGroup.name).className).not.toContain("is-dim");
    expect(nodeButton(outOfGroup.name).className).toContain("is-dim");
  });

  it("clears group filters with the All caps chip", () => {
    render(<DependencyMap onOpen={() => {}} />);
    const outOfGroup = CAPABILITIES.find((c) => c.group !== "launch")!;

    fireEvent.click(screen.getByRole("button", { name: "launch" }));
    expect(nodeButton(outOfGroup.name).className).toContain("is-dim");

    fireEvent.click(screen.getByRole("button", { name: "All caps" }));
    expect(nodeButton(outOfGroup.name).className).not.toContain("is-dim");
  });

  it("combines status filters with group filters", () => {
    render(<DependencyMap onOpen={() => {}} />);
    const blocker = CAPABILITIES.find((c) => c.status === "blocker")!;
    const ready = CAPABILITIES.find((c) => c.status === "ready")!;

    const legend = screen.getByRole("group", { name: "Status filters" });
    const blockerToggle = Array.from(
      legend.querySelectorAll("button"),
    ).find((b) => b.textContent?.includes("Blocker"))!;
    fireEvent.click(blockerToggle);

    expect(nodeButton(blocker.name).className).not.toContain("is-dim");
    expect(nodeButton(ready.name).className).toContain("is-dim");
  });
});
