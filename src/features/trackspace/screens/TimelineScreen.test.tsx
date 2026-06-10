// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EVENTS, STATUS } from "../data/seed";
import { getSortedEvents } from "../data/selectors";
import { TimelineScreen } from "./TimelineScreen";

afterEach(cleanup);

function eventCard(title: string): HTMLElement {
  return screen.getByRole("button", { name: new RegExp(title) });
}

function rowOf(card: HTMLElement): HTMLElement {
  return card.closest(".trackspace-tlrow") as HTMLElement;
}

describe("TimelineScreen", () => {
  it("renders a card for every event in chronological order", () => {
    const { container } = render(<TimelineScreen onOpen={() => {}} />);
    const titles = Array.from(
      container.querySelectorAll(".trackspace-tlcard-title"),
    ).map((el) => el.textContent);
    expect(titles).toEqual(getSortedEvents().map((e) => e.title));
  });

  it("places the now divider before the first projected event", () => {
    const { container } = render(<TimelineScreen onOpen={() => {}} />);
    const wrap = container.querySelector(".trackspace-tlwrap")!;
    const items = Array.from(
      wrap.querySelectorAll(".trackspace-tlrow, .trackspace-tlnow"),
    );
    const dividerIndex = items.findIndex((el) =>
      el.className.includes("trackspace-tlnow"),
    );
    const pastCount = EVENTS.filter((e) => !e.future).length;
    expect(dividerIndex).toBe(pastCount);
  });

  it("marks projected events with a hollow node", () => {
    const { container } = render(<TimelineScreen onOpen={() => {}} />);
    const futureNodes = container.querySelectorAll(".trackspace-tlnode.is-fut");
    expect(futureNodes.length).toBe(EVENTS.filter((e) => e.future).length);
  });

  it("opens the drawer with the clicked event", () => {
    const onOpen = vi.fn();
    render(<TimelineScreen onOpen={onOpen} />);
    const event = getSortedEvents()[0];
    fireEvent.click(eventCard(event.title));
    expect(onOpen).toHaveBeenCalledWith({ type: "event", id: event.id });
  });

  it("fades rows outside the active status filter without removing them", () => {
    render(<TimelineScreen onOpen={() => {}} />);
    const blocker = EVENTS.find((e) => e.status === "blocker")!;
    const ready = EVENTS.find((e) => e.status === "ready")!;

    const filters = screen.getByRole("group", { name: "Status filters" });
    const blockerChip = Array.from(filters.querySelectorAll("button")).find(
      (b) => b.textContent === STATUS.blocker.label,
    )!;
    fireEvent.click(blockerChip);

    expect(rowOf(eventCard(blocker.title)).style.opacity).toBe("1");
    expect(rowOf(eventCard(ready.title)).style.opacity).toBe("0.18");
  });

  it("restores all rows with the All chip", () => {
    render(<TimelineScreen onOpen={() => {}} />);
    const ready = EVENTS.find((e) => e.status === "ready")!;

    const filters = screen.getByRole("group", { name: "Status filters" });
    const blockerChip = Array.from(filters.querySelectorAll("button")).find(
      (b) => b.textContent === STATUS.blocker.label,
    )!;
    fireEvent.click(blockerChip);
    expect(rowOf(eventCard(ready.title)).style.opacity).toBe("0.18");

    fireEvent.click(screen.getByRole("button", { name: "All" }));
    expect(rowOf(eventCard(ready.title)).style.opacity).toBe("1");
  });
});
