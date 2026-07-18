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
        <TrackspaceLogoMark />
        <span className="trackspace-brand-primary">
          <span className="trackspace-wordmark">
            TRACK<span>SPACE</span>
          </span>
          <span className="trackspace-subtitle">LUNAR BASE READINESS</span>
        </span>
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
    <span
      className="trackspace-logo-mark"
      role="img"
      aria-label="Trackspace logo"
    />
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
    </nav>
  );
}
