import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 16, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    />
  );
}

/** Crosshair: the Command Center's atlas view. */
export function CommandIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="8" cy="8" r="5.25" />
      <path d="M8 1.5v2.5M8 12v2.5M1.5 8H4M12 8h2.5" />
      <circle cx="8" cy="8" r="1" fill="currentColor" stroke="none" />
    </Icon>
  );
}

/** Three linked nodes: the Dependency Map. */
export function DependencyIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="3.5" cy="4" r="1.75" />
      <circle cx="3.5" cy="12" r="1.75" />
      <circle cx="12.5" cy="8" r="1.75" />
      <path d="M5.1 4.7 10.9 7.3M5.1 11.3l5.8-2.6" />
    </Icon>
  );
}

/** A dated list: the Timeline. */
export function TimelineIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="3.5" cy="3.5" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="3.5" cy="8" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="3.5" cy="12.5" r="1.25" fill="currentColor" stroke="none" />
      <path d="M7 3.5h6.5M7 8h6.5M7 12.5h6.5" />
    </Icon>
  );
}

/** A flag: Milestones. */
export function MilestoneIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 14.5V2.5" />
      <path d="M4 3h8.5l-2.25 3 2.25 3H4" />
    </Icon>
  );
}

/** Bars: the Program health view. */
export function ProgramIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 13.5V9M8 13.5V5M13 13.5V2.5" strokeWidth="2" />
    </Icon>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </Icon>
  );
}

export function ChevronIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 3.5 10.5 8 6 12.5" />
    </Icon>
  );
}

export function ArrowUpRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.5 11.5l7-7M5.5 4.5h6v6" />
    </Icon>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 7.25v4" />
      <circle cx="8" cy="5" r="0.75" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 8.5l3.25 3L13 5" />
    </Icon>
  );
}
