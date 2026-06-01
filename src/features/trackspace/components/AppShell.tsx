import type { ReactNode } from "react";

export type TrackspaceNavItem = {
  id: string;
  icon: string;
  label: string;
  name: string;
};

type AppShellProps = {
  activeView: string;
  drawer: ReactNode;
  navItems: TrackspaceNavItem[];
  onNavChange: (view: string) => void;
  utcTime: string;
  children: ReactNode;
};

export function AppShell({
  activeView,
  children,
  drawer,
  navItems,
  onNavChange,
  utcTime,
}: AppShellProps) {
  return (
    <div className="trackspace-app">
      <TopStatusStrip utcTime={utcTime} />
      <Header />
      <div className="trackspace-body">
        <LeftRail
          activeView={activeView}
          navItems={navItems}
          onNavChange={onNavChange}
        />
        <main className="trackspace-screen">{children}</main>
      </div>
      <div className="trackspace-drawer-mount">{drawer}</div>
    </div>
  );
}

function TopStatusStrip({ utcTime }: { utcTime: string }) {
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
        SUSTAINED-PRESENCE INDEX <b>68%</b>
      </span>
      <span className="trackspace-separator" aria-hidden="true" />
      <span>
        UTC <b className="trackspace-tabular">{utcTime}</b>
      </span>
    </div>
  );
}

function Header() {
  return (
    <header className="trackspace-header">
      <div className="trackspace-brand" aria-label="Trackspace">
        <span className="trackspace-wordmark">
          TRACK<span>SPACE</span>
        </span>
        <span className="trackspace-subtitle">LUNAR BASE READINESS</span>
      </div>

      <div className="trackspace-header-stats" aria-label="Program summary">
        <StatusCell label="Program" value="Artemis / Moon-to-Mars" />
        <StatusCell label="Horizon" value="Sustained Presence" />
        <StatusCell label="Next Gate" value="A3 / 2026" />
      </div>
    </header>
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

function LeftRail({
  activeView,
  navItems,
  onNavChange,
}: {
  activeView: string;
  navItems: TrackspaceNavItem[];
  onNavChange: (view: string) => void;
}) {
  return (
    <nav className="trackspace-rail" aria-label="Trackspace views">
      {navItems.map((item) => (
        <button
          type="button"
          key={item.id}
          className={item.id === activeView ? "is-active" : undefined}
          onClick={() => onNavChange(item.id)}
          aria-current={item.id === activeView ? "page" : undefined}
          title={item.name}
        >
          <span className="trackspace-rail-icon" aria-hidden="true">
            {item.icon}
          </span>
          <span className="trackspace-rail-label">{item.label}</span>
        </button>
      ))}
      <span className="trackspace-rail-spacer" />
    </nav>
  );
}
