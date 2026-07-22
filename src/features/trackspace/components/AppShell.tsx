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
  overlay,
  utcTime,
}: AppShellProps) {
  return (
    <div className="trackspace-app">
      <Header nextGate={nextGate} utcTime={utcTime} />
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

function Header({ nextGate, utcTime }: { nextGate: string; utcTime: string }) {
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
