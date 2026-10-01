// @vitest-environment jsdom

// Run explicitly with the adjacent config; not part of the regular test suite.
import { writeFileSync } from "node:fs";
import { Profiler, type ComponentProps, type ProfilerOnRenderCallback } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { TrackspaceApp } from "../../src/features/trackspace/TrackspaceApp";
import { CURATED } from "../../src/features/trackspace/data/selectors";

const metrics = vi.hoisted(() => ({
  mainCommits: 0,
  drawerCommits: 0,
}));

// Keep the real shell and screens. Observe main/drawer commits without changing
// their component identities or memoization. WebGL is outside this CPU measure.
vi.mock("../../src/features/trackspace/components/AppShell", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/features/trackspace/components/AppShell")>();
  const { Profiler } = await import("react");
  return {
    ...original,
    AppShell: (props: ComponentProps<typeof original.AppShell>) => (
      <original.AppShell
        {...props}
        drawer={props.drawer && (
          <Profiler id="drawer" onRender={() => metrics.drawerCommits++}>
            {props.drawer}
          </Profiler>
        )}
      >
        <Profiler id="main" onRender={() => metrics.mainCommits++}>
          {props.children}
        </Profiler>
      </original.AppShell>
    ),
  };
});
vi.mock("../../src/features/trackspace/atlas/AtlasScene", () => ({
  AtlasScene: () => null,
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  localStorage.clear();
});

const scenarios = ["command", "dependency", "timeline", "milestones", "program", "dependency-drawer"];
const results: object[] = [];
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

it.each(scenarios)("measures idle UTC updates: %s", async (scenario) => {
  // Fake only the clock. React's performance.now() remains a real CPU timer.
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
  vi.setSystemTime(new Date("2026-09-30T23:58:00Z"));
  localStorage.setItem("trackspace:intro-dismissed", "1");
  const durations: number[] = [];
  const onRender: ProfilerOnRenderCallback = (_id, phase, duration) => {
    if (phase === "update") durations.push(duration);
  };
  const { container, unmount } = render(
    <Profiler id="app" onRender={onRender}><TrackspaceApp /></Profiler>,
  );
  // Let next/dynamic settle before measuring any clock updates.
  await act(async () => { await import("../../src/features/trackspace/atlas/AtlasScene"); });
  const key = scenario === "dependency-drawer" ? "2" : String(scenarios.indexOf(scenario) + 1);
  fireEvent.keyDown(window, { key });
  if (scenario === "dependency-drawer") {
    fireEvent.click(container.querySelector<HTMLButtonElement>(".trackspace-gnode")!);
    expect(screen.getByRole("dialog")).toBeTruthy();
  }
  const tick = () => act(() => { vi.advanceTimersByTime(1000); });
  for (let i = 0; i < 20; i++) tick();
  durations.length = 0;
  metrics.mainCommits = 0;
  metrics.drawerCommits = 0;
  const mainBefore = screen.getByRole("main").innerHTML;
  const drawerBefore = screen.queryByRole("dialog")?.innerHTML;
  for (let i = 0; i < 120; i++) tick();
  expect(durations).toHaveLength(120);
  expect(screen.getByRole("main").innerHTML).toBe(mainBefore);
  expect(screen.queryByRole("dialog")?.innerHTML).toBe(drawerBefore);
  expect(screen.getByRole("banner").textContent).toContain("00:00:20");
  const sorted = [...durations].sort((a, b) => a - b);
  results.push({
    scenario,
    ticks: durations.length,
    mainCommits: metrics.mainCommits,
    drawerCommits: metrics.drawerCommits,
    totalRenderMs: durations.reduce((sum, ms) => sum + ms, 0),
    medianRenderMs: median(durations),
    p95RenderMs: sorted[Math.ceil(sorted.length * 0.95) - 1],
  });
  unmount();
  expect(vi.getTimerCount()).toBe(0);
  if (results.length === scenarios.length) {
    const report = {
      environment: "React development Profiler, jsdom; fake Date/intervals, real performance.now; WebGL stubbed",
      datasetCounts: Object.fromEntries(Object.entries(CURATED).map(([key, value]) => [key, value.length])),
      warmupTicks: 20,
      results,
    };
    const json = JSON.stringify(report, null, 2);
    console.log(json);
    if (process.env.TRACKSPACE_BENCH_OUTPUT) writeFileSync(process.env.TRACKSPACE_BENCH_OUTPUT, json + "\n");
  }
});
