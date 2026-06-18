// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CAPABILITIES } from "../data/seed";
import { getProgramSummary, getRiskRegister } from "../data/selectors";
import { ProgramScreen } from "./ProgramScreen";

afterEach(cleanup);

const cards = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>(".trackspace-prog-card"));

const cells = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>(".trackspace-prog-cell"));

describe("ProgramScreen", () => {
  it("renders the program heading", () => {
    render(<ProgramScreen onOpen={() => {}} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Risk, Funding & Schedule",
    );
  });

  it("lists one register card per capability with a risk assessment", () => {
    const { container } = render(<ProgramScreen onOpen={() => {}} />);
    expect(cards(container).length).toBe(getRiskRegister().length);
  });

  it("renders register cards in non-increasing risk-score order", () => {
    // Read the scores straight from the rendered badges, not from the selector,
    // so an accidental reorder in the screen (a stray reverse/re-sort) fails.
    const { container } = render(<ProgramScreen onOpen={() => {}} />);
    const scores = cards(container).map((card) =>
      Number(card.querySelector(".trackspace-prog-score")?.textContent),
    );

    expect(scores.length).toBe(getRiskRegister().length);
    expect(scores[0]).toBe(getRiskRegister()[0].score);
    for (let i = 1; i < scores.length; i += 1) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
    }
  });

  it("summarizes how many capabilities carry program data", () => {
    render(<ProgramScreen onOpen={() => {}} />);
    const summary = getProgramSummary();

    expect(
      screen.getByText(`${summary.tracked} / ${CAPABILITIES.length}`),
    ).toBeTruthy();
  });

  it("filters the register to a matrix cell, then restores", () => {
    const { container } = render(<ProgramScreen onOpen={() => {}} />);
    const full = getRiskRegister().length;
    expect(cards(container).length).toBe(full);

    // Cells render high→low × low→high, so index 2 is high likelihood × high
    // severity — the most-exposed cluster.
    const highHigh = getRiskRegister().filter(
      (e) => e.risk.likelihood === "high" && e.risk.severity === "high",
    ).length;
    fireEvent.click(cells(container)[2]);
    expect(cards(container).length).toBe(highHigh);

    fireEvent.click(screen.getByRole("button", { name: /show all/i }));
    expect(cards(container).length).toBe(full);
  });

  it("opens the drawer for a clicked capability", () => {
    const onOpen = vi.fn();
    const { container } = render(<ProgramScreen onOpen={onOpen} />);
    const top = getRiskRegister()[0];

    fireEvent.click(cards(container)[0]);

    expect(onOpen).toHaveBeenCalledWith({
      type: "capability",
      id: top.capability.id,
    });
  });
});
