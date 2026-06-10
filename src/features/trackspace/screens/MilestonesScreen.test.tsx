// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MILESTONES } from "../data/seed";
import {
  CAPABILITY_BY_ID,
  MILESTONE_BY_ID,
  getEventsForMilestone,
  getMilestoneBlockers,
  getMilestoneReadyCount,
} from "../data/selectors";
import { MilestonesScreen } from "./MilestonesScreen";

afterEach(cleanup);

function rail(): HTMLElement {
  return screen.getByRole("navigation", { name: "Missions and phases" });
}

function railItem(name: string): HTMLElement {
  return Array.from(rail().querySelectorAll("button")).find((b) =>
    b.textContent?.includes(name),
  ) as HTMLElement;
}

describe("MilestonesScreen", () => {
  it("lists every milestone in the rail", () => {
    render(<MilestonesScreen onOpen={() => {}} />);
    for (const milestone of MILESTONES) {
      expect(railItem(milestone.name)).toBeTruthy();
    }
  });

  it("shows A3 by default with its required capabilities and ready count", () => {
    render(<MilestonesScreen onOpen={() => {}} />);
    const a3 = MILESTONE_BY_ID.a3;

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      a3.name,
    );
    expect(
      screen.getByText(
        `${getMilestoneReadyCount("a3")}/${a3.caps.length} caps ready`,
      ),
    ).toBeTruthy();
    expect(railItem(a3.name).getAttribute("aria-current")).toBe("true");
  });

  it("switches the detail page when another milestone is selected", () => {
    render(<MilestonesScreen onOpen={() => {}} />);
    const base = MILESTONE_BY_ID.base;

    fireEvent.click(railItem(base.name));

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      base.name,
    );
    expect(railItem(base.name).getAttribute("aria-current")).toBe("true");
  });

  it("lists the milestone's open blockers", () => {
    const { container } = render(<MilestonesScreen onOpen={() => {}} />);
    const flagged = container.querySelectorAll(".trackspace-caprow-flag");
    expect(flagged.length).toBe(getMilestoneBlockers("a3").length);
  });

  it("opens the drawer for a clicked required capability", () => {
    const onOpen = vi.fn();
    render(<MilestonesScreen onOpen={onOpen} />);
    const capId = MILESTONE_BY_ID.a3.caps[0];

    const page = screen.getByRole("heading", { level: 1 })
      .closest(".trackspace-mspage") as HTMLElement;
    const capRow = within(page)
      .getAllByRole("button")
      .find(
        (b) =>
          b.className.includes("trackspace-caprow") &&
          b.textContent?.includes(CAPABILITY_BY_ID[capId].name),
      )!;
    fireEvent.click(capRow);

    expect(onOpen).toHaveBeenCalledWith({ type: "capability", id: capId });
  });

  it("opens the drawer for a clicked related event", () => {
    const onOpen = vi.fn();
    render(<MilestonesScreen onOpen={onOpen} />);
    const event = getEventsForMilestone("a3")[0];

    fireEvent.click(
      screen.getByRole("button", { name: new RegExp(event.title) }),
    );

    expect(onOpen).toHaveBeenCalledWith({ type: "event", id: event.id });
  });
});
