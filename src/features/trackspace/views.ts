import type { ComponentType } from "react";

import {
  CommandIcon,
  DependencyIcon,
  MilestoneIcon,
  ProgramIcon,
  TimelineIcon,
} from "./components/icons";

type ViewDefinition = {
  id: string;
  name: string;
  /** One-line description shown in the mission briefing. */
  note: string;
  icon: ComponentType<{ size?: number }>;
};

/** The app's top-level views, in tab and keyboard-shortcut (1–5) order. */
export const VIEWS = [
  {
    id: "command",
    name: "Command Center",
    note: "Earth–Moon atlas, top blockers, and the latest changes",
    icon: CommandIcon,
  },
  {
    id: "dependency",
    name: "Dependency Map",
    note: "What has to work before what",
    icon: DependencyIcon,
  },
  {
    id: "timeline",
    name: "Timeline",
    note: "Logged events and what is projected next",
    icon: TimelineIcon,
  },
  {
    id: "milestones",
    name: "Milestones",
    note: "Program gates, mission by mission",
    icon: MilestoneIcon,
  },
  {
    id: "program",
    name: "Program",
    note: "Funding, schedule, and provider signals",
    icon: ProgramIcon,
  },
] as const satisfies readonly ViewDefinition[];

export type TrackspaceView = (typeof VIEWS)[number]["id"];

export function isTrackspaceView(view: string): view is TrackspaceView {
  return VIEWS.some((item) => item.id === view);
}
