"use client";

import { useEffect, useState, type ReactNode } from "react";
import { VIEWS } from "../views";
import { InfoIcon } from "./icons";

export type DataStatus = "live" | "connecting" | "snapshot";

type AppShellProps = {
  dataStatus: DataStatus;
  activeView: string;
  drawer: ReactNode;
  onNavChange: (view: string) => void;
  onOpenBriefing: () => void;
  nextGate: string;
  overlay?: ReactNode;
  children: ReactNode;
};

export function AppShell({
  dataStatus,
  activeView,
  children,
  drawer,
  nextGate,
  onNavChange,
  onOpenBriefing,
  overlay,
}: AppShellProps) {
  return (
    <div className="trackspace-app">
      <Header
        dataStatus={dataStatus}
        nextGate={nextGate}
        onOpenBriefing={onOpenBriefing}
      />
      <TabBar activeView={activeView} onNavChange={onNavChange} />
      <main className="trackspace-screen">{children}</main>
      <div className="trackspace-overlays">
        {drawer}
        {overlay}
      </div>
    </div>
  );
}

const CONNECTION: Record<DataStatus, { label: string; title: string }> = {
  live: { label: "LIVE", title: "Receiving live updates" },
  connecting: {
    label: "CONNECTING",
    title: "Connecting to live updates. Showing the saved dataset.",
  },
  snapshot: {
    label: "SNAPSHOT",
    title: "Live updates unavailable. Showing the last available dataset. Reload to reconnect.",
  },
};

function Header({
  dataStatus,
  nextGate,
  onOpenBriefing,
}: {
  dataStatus: DataStatus;
  nextGate: string;
  onOpenBriefing: () => void;
}) {
  const connection = CONNECTION[dataStatus];
  return (
    <header className="trackspace-header">
      <div className="trackspace-brand" aria-label="Trackspace">
        <span className="trackspace-logo-mark" role="img" aria-label="Trackspace logo" />
        <span className="trackspace-wordmark">
          TRACK<span>SPACE</span>
        </span>
        <span className="trackspace-subtitle">Lunar base readiness</span>
      </div>

      <div className="trackspace-header-stats" aria-label="Mission status">
        <StatusCell label="Next Gate" value={nextGate} />
        <UtcClock />
        <span
          className="trackspace-conn"
          data-state={dataStatus}
          role="status"
          title={connection.title}
        >
          <span className="trackspace-conn-dot" aria-hidden="true" />
          {connection.label}
        </span>
        <button
          type="button"
          className="trackspace-iconbtn"
          onClick={onOpenBriefing}
          aria-label="Open mission briefing"
          title="Mission briefing"
        >
          <InfoIcon size={15} />
        </button>
      </div>
    </header>
  );
}

function UtcClock() {
  const [utcTime, setUtcTime] = useState("00:00:00");

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setUtcTime(
        [now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds()]
          .map((part) => part.toString().padStart(2, "0"))
          .join(":"),
      );
    };

    tick();
    const timer = window.setInterval(tick, 1000);

    return () => window.clearInterval(timer);
  }, []);

  return <StatusCell label="UTC" value={utcTime} tabular />;
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
  onNavChange,
}: {
  activeView: string;
  onNavChange: (view: string) => void;
}) {
  return (
    <nav className="trackspace-tabbar" aria-label="Trackspace views">
      {VIEWS.map((item) => {
        const Icon = item.icon;
        return (
          <button
            type="button"
            key={item.id}
            className={`trackspace-tab${item.id === activeView ? " is-active" : ""}`}
            onClick={() => onNavChange(item.id)}
            aria-current={item.id === activeView ? "page" : undefined}
          >
            <Icon size={15} />
            {item.name}
          </button>
        );
      })}
    </nav>
  );
}
