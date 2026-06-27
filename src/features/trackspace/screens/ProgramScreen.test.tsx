// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CAPABILITIES } from "../data/seed";
import { getProgramRegister, getProgramSummary } from "../data/selectors";
import { ProgramScreen } from "./ProgramScreen";

afterEach(cleanup);

const rows = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>(".trackspace-prog-row"));

describe("ProgramScreen", () => {
  it("renders the program heading", () => {
    render(<ProgramScreen onOpen={() => {}} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Program Health",
    );
  });

  it("summarizes how many capabilities carry program data", () => {
    render(<ProgramScreen onOpen={() => {}} />);
    const summary = getProgramSummary();

    expect(
      screen.getByText(`${summary.tracked}/${CAPABILITIES.length} tracked`),
    ).toBeTruthy();
  });

  it("shows blockers and watch items by default", () => {
    const { container } = render(<ProgramScreen onOpen={() => {}} />);
    const attention = getProgramRegister().filter(
      (entry) => entry.status === "blocker" || entry.status === "watch",
    );

    expect(rows(container).length).toBe(attention.length);
  });

  it("switches to all tracked program records", () => {
    const { container } = render(<ProgramScreen onOpen={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: /All tracked/i }));

    expect(rows(container).length).toBe(getProgramRegister().length);
  });

  it("opens the drawer for a clicked capability", () => {
    const onOpen = vi.fn();
    const { container } = render(<ProgramScreen onOpen={onOpen} />);
    const top = getProgramRegister().find(
      (entry) => entry.status === "blocker" || entry.status === "watch",
    );

    fireEvent.click(rows(container)[0]);

    expect(onOpen).toHaveBeenCalledWith({
      type: "capability",
      id: top?.capability.id,
    });
  });
});
