import type { ReactNode } from "react";

export type TrackspaceNavItem = {
  id: string;
  icon: string;
  name: string;
};

type AppShellProps = {
  activeView: string;
  drawer: ReactNode;
  navItems: TrackspaceNavItem[];
  onNavChange: (view: string) => void;
  onOpenBriefing: () => void;
  utcTime: string;
  nextGate: string;
  overlay?: ReactNode;
  children: ReactNode;
};

export function AppShell({
  activeView,
  children,
  drawer,
  navItems,
  nextGate,
  onNavChange,
  onOpenBriefing,
  overlay,
  utcTime,
}: AppShellProps) {
  return (
    <div className="trackspace-app">
      <Header
        nextGate={nextGate}
        onOpenBriefing={onOpenBriefing}
        utcTime={utcTime}
      />
      <TabBar
        activeView={activeView}
        navItems={navItems}
        onNavChange={onNavChange}
      />
      <div className="trackspace-body">
        <main className="trackspace-screen">{children}</main>
      </div>
      <div className="trackspace-drawer-mount">{drawer}</div>
      <div className="trackspace-drawer-mount">{overlay}</div>
    </div>
  );
}

function Header({
  nextGate,
  onOpenBriefing,
  utcTime,
}: {
  nextGate: string;
  onOpenBriefing: () => void;
  utcTime: string;
}) {
  return (
    <header className="trackspace-header">
      <div className="trackspace-brand" aria-label="Trackspace">
        <TrackspaceLogoMark />
        <span className="trackspace-brand-primary">
          <span className="trackspace-wordmark">
            TRACK<span>SPACE</span>
          </span>
          <span className="trackspace-subtitle">LUNAR BASE READINESS</span>
        </span>
      </div>

      <div className="trackspace-header-stats" aria-label="Mission status">
        <StatusCell label="Next Gate" value={nextGate} />
        <StatusCell label="UTC" value={utcTime} tabular />
        <span className="trackspace-live">
          <span className="trackspace-live-dot" aria-hidden="true" />
          LIVE
        </span>
        <button
          type="button"
          className="trackspace-help-btn"
          onClick={onOpenBriefing}
          aria-label="Open mission briefing"
          title="Mission briefing"
        >
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <circle
              cx="8"
              cy="8"
              r="6.25"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
            />
            <circle cx="8" cy="5.1" r="1" fill="currentColor" />
            <line
              x1="8"
              y1="7.6"
              x2="8"
              y2="11.2"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </header>
  );
}

function TrackspaceLogoMark() {
  return (
    <span
      className="trackspace-logo-mark"
      role="img"
      aria-label="Trackspace logo"
    />
  );
}

function StatusCell({
  label,
  tabular = false,
  value,
}: {
  label: string;
  tabular?: boolean;
  value: string;
}) {
  return (
    <div className="trackspace-status-cell">
      <span>{label}</span>
      <b className={tabular ? "trackspace-tabular" : undefined}>{value}</b>
    </div>
  );
}

function TabBar({
  activeView,
  navItems,
  onNavChange,
}: {
  activeView: string;
  navItems: TrackspaceNavItem[];
  onNavChange: (view: string) => void;
}) {
  return (
    <nav className="trackspace-tabbar" aria-label="Trackspace views">
      {navItems.map((item) => (
        <button
          type="button"
          key={item.id}
          className={`trackspace-tab${item.id === activeView ? " is-active" : ""}`}
          onClick={() => onNavChange(item.id)}
          aria-current={item.id === activeView ? "page" : undefined}
        >
          <span
            className={`trackspace-tab-icon trackspace-tab-icon-${item.id}`}
            aria-hidden="true"
          >
            {item.icon}
          </span>
          {item.name}
        </button>
      ))}
    </nav>
  );
}
