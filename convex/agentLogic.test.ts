import { describe, expect, it } from "vitest";

import {
  mergeUpdateSources,
  parseAgentDecision,
  validateAgentDecision,
  type AgentDecisionInput,
} from "./agentLogic";

const LEAD_URL = "https://www.nasa.gov/missions/artemis/test-update/";
const REPORT_URL = "https://spacenews.com/test-update-corroborated/";

function publishDecision(overrides: Record<string, unknown> = {}): AgentDecisionInput {
  return parseAgentDecision({
    decision: "publish_event",
    targetEventId: null,
    rationale: "The update changes a tracked program risk.",
    citations: [LEAD_URL],
    event: {
      date: "2026-07-20",
      title: "Artemis test update",
      status: "watch",
      conf: "confirmed",
      impact: "med",
      future: false,
      caps: ["hls"],
      what: "NASA reported a material test result.",
      confirmed: ["The test occurred."],
      unknown: ["Schedule effects remain unknown."],
      downstream: "May affect the landing-system schedule.",
      lastVerified: "2020-01-01",
      sources: [
        {
          publisher: "NASA",
          title: "Test update",
          url: LEAD_URL,
          tier: 1,
          date: "2026-07-20",
        },
      ],
    },
    ...overrides,
  });
}

function validate(
  decision: AgentDecisionInput,
  consultedUrls: string[] = decision.citations,
) {
  return validateAgentDecision(decision, {
    leadUrl: LEAD_URL,
    consultedUrls,
    agentEventIds: [],
    verifiedOn: "2026-07-21",
  });
}

describe("validateAgentDecision", () => {
  it("rejects capability ids outside the fixed Trackspace set", () => {
    const decision = publishDecision({
      event: {
        ...publishDecision().event,
        caps: ["not-a-capability"],
      },
    });
    expect(() => validate(decision)).toThrow("unknown capability id");
  });

  it("downgrades confirmed when sources do not span independent domains", () => {
    const decision = validate(publishDecision());
    expect(decision.event?.conf).toBe("reported");
    expect(decision.event?.lastVerified).toBe("2026-07-21");
  });

  it("downgrades confirmed when only unrelated citations add a second domain", () => {
    const decision = publishDecision({
      citations: [LEAD_URL, "https://example.com/unrelated/"],
    });
    expect(validate(decision).event?.conf).toBe("reported");
  });

  it("preserves confirmed with an official and independent source", () => {
    const decision = publishDecision({
      citations: [LEAD_URL, REPORT_URL],
      event: {
        ...publishDecision().event,
        sources: [
          ...publishDecision().event!.sources,
          {
            publisher: "SpaceNews",
            title: "Independent report",
            url: REPORT_URL,
            tier: 3,
            date: "2026-07-20",
          },
        ],
      },
    });
    expect(validate(decision).event?.conf).toBe("confirmed");
  });

  it("rejects sources not drawn from the decision citations", () => {
    const decision = publishDecision({
      event: {
        ...publishDecision().event,
        sources: [
          {
            publisher: "SpaceNews",
            title: "Uncited report",
            url: REPORT_URL,
            tier: 3,
            date: "2026-07-20",
          },
        ],
      },
    });
    expect(() => validate(decision, [LEAD_URL, REPORT_URL])).toThrow(
      "source was not cited",
    );
  });

  it("rejects model citations absent from the consulted-source metadata", () => {
    const decision = publishDecision({ citations: [LEAD_URL, REPORT_URL] });
    expect(() => validate(decision, [LEAD_URL])).toThrow("was not consulted");
  });

  it("allows updates only to an existing agent-origin event id", () => {
    const decision = publishDecision({
      decision: "update_event",
      targetEventId: "agent-existing",
    });
    expect(() => validate(decision)).toThrow("not an existing agent event");

    expect(
      validateAgentDecision(decision, {
        leadUrl: LEAD_URL,
        consultedUrls: decision.citations,
        agentEventIds: ["agent-existing"],
        verifiedOn: "2026-07-21",
      }).targetEventId,
    ).toBe("agent-existing");
  });

  it("carries forward prior sources an update omitted, deduped by URL", () => {
    const event = publishDecision().event!;
    const prior = [
      { ...event.sources[0] },
      {
        publisher: "SpaceNews",
        title: "Earlier report",
        url: REPORT_URL,
        tier: 3 as const,
        date: "2026-06-01",
      },
    ];
    const merged = mergeUpdateSources(event, prior);
    expect(merged.sources.map((source) => source.url)).toEqual([
      LEAD_URL,
      REPORT_URL,
    ]);
  });

  it("downgrades tier 1 assigned to a non-official domain", () => {
    const decision = publishDecision({
      citations: [LEAD_URL, REPORT_URL],
      event: {
        ...publishDecision().event,
        sources: [
          {
            publisher: "SpaceNews",
            title: "Independent report",
            url: REPORT_URL,
            tier: 1,
            date: "2026-07-20",
          },
        ],
      },
    });
    expect(validate(decision).event?.sources[0].tier).toBe(2);
  });
});
