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
  utcTime: string;
  presenceIndex: number;
  nextGate: string;
  children: ReactNode;
};

export function AppShell({
  activeView,
  children,
  drawer,
  navItems,
  nextGate,
  onNavChange,
  presenceIndex,
  utcTime,
}: AppShellProps) {
  return (
    <div className="trackspace-app">
      <TopStatusStrip presenceIndex={presenceIndex} utcTime={utcTime} />
      <Header nextGate={nextGate} />
      <TabBar
        activeView={activeView}
        navItems={navItems}
        onNavChange={onNavChange}
      />
      <div className="trackspace-body">
        <main className="trackspace-screen">{children}</main>
      </div>
      <div className="trackspace-drawer-mount">{drawer}</div>
    </div>
  );
}

function TopStatusStrip({
  presenceIndex,
  utcTime,
}: {
  presenceIndex: number;
  utcTime: string;
}) {
  return (
    <div className="trackspace-topstrip" aria-label="Trackspace status">
      <span className="trackspace-live">
        <span className="trackspace-live-dot" aria-hidden="true" />
        LIVE
      </span>
      <span className="trackspace-separator" aria-hidden="true" />
      <span>
        MODEL <b>TRACKSPACE v0.1</b>
      </span>
      <span className="trackspace-separator" aria-hidden="true" />
      <span>
        FEED <b className="trackspace-ready">NOMINAL</b>
      </span>
      <span className="trackspace-grow" />
      <span>
        SUSTAINED-PRESENCE INDEX <b>{presenceIndex}%</b>
      </span>
      <span className="trackspace-separator" aria-hidden="true" />
      <span>
        UTC <b className="trackspace-tabular">{utcTime}</b>
      </span>
    </div>
  );
}

function Header({ nextGate }: { nextGate: string }) {
  return (
    <header className="trackspace-header">
      <div className="trackspace-brand" aria-label="Trackspace">
        <span className="trackspace-brand-primary">
          <TrackspaceLogoMark />
          <span className="trackspace-wordmark">
            TRACK<span>SPACE</span>
          </span>
        </span>
        <span className="trackspace-subtitle">LUNAR BASE READINESS</span>
      </div>

      <div className="trackspace-header-stats" aria-label="Program summary">
        <StatusCell label="Program" value="Artemis / Moon-to-Mars" />
        <StatusCell label="Horizon" value="Sustained Presence" />
        <StatusCell label="Next Gate" value={nextGate} />
      </div>
    </header>
  );
}

function TrackspaceLogoMark() {
  return (
    <svg
      className="trackspace-logo-mark"
      viewBox="0 0 32 32"
      role="img"
      aria-label="Trackspace logo"
    >
      <rect className="trackspace-logo-tile" x="0.75" y="0.75" width="30.5" height="30.5" rx="7" />
      <g className="trackspace-logo-reticle">
        <circle className="trackspace-logo-dot" cx="16" cy="12" r="1.2" />
        <path d="M11.8 10.2A4.7 4.7 0 0 1 14.2 7.9" />
        <path d="M17.8 7.9A4.7 4.7 0 0 1 20.2 10.2" />
        <path d="M20.2 13.8A4.7 4.7 0 0 1 17.8 16.1" />
        <path d="M14.2 16.1A4.7 4.7 0 0 1 11.8 13.8" />
        <path d="M16 5.8V8.1" />
        <path d="M16 15.9V18.2" />
        <path d="M9.8 12H12.1" />
        <path d="M19.9 12H22.2" />
      </g>
      <path className="trackspace-logo-horizon-dim" d="M5.6 22.7Q16 18.4 26.4 22.7" />
      <path className="trackspace-logo-horizon" d="M6.4 24.7Q16 20.9 25.6 24.7" />
    </svg>
  );
}

function StatusCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="trackspace-status-cell">
      <span>{label}</span>
      <b>{value}</b>
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
      <span className="trackspace-tabbar-hint" aria-hidden="true">
        PRESS 1–{navItems.length}
      </span>
    </nav>
  );
}
