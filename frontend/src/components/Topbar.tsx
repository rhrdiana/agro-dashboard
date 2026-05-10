"use client";

import React from "react";
import type { NavId } from "./Sidebar";

interface TopbarProps {
  activeTab: NavId;
  onRefresh: () => void;
}

const NAV_LABEL: Record<NavId, { label: string; group: string }> = {
  overview:    { label: "Dashboard Overview",  group: "Project" },
  eda:         { label: "Data Explorer",        group: "Project" },
  stress:      { label: "Stress Test Lab",      group: "Experiment" },
  performance: { label: "Model Performance",    group: "Experiment" },
  prediction:  { label: "Live Prediction",      group: "Demo" },
  xai:         { label: "Inside the Model",     group: "Demo" },
  conclusion:  { label: "Conclusion & Recs",    group: "Output" },
  audit:       { label: "Audit Trail",          group: "Output" },
};

export const Topbar: React.FC<TopbarProps> = ({ activeTab, onRefresh }) => {
  const nav = NAV_LABEL[activeTab];

  return (
    <>
      <style>{`
        .topbar {
          background: #fff;
          border-bottom: 1px solid var(--border);
          padding: 0 24px;
          height: var(--topbar-h);
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: sticky;
          top: 0;
          z-index: 10;
        }
        .tb-left { display: flex; align-items: center; gap: 14px; }
        .tb-crumb {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--muted);
          font-weight: 500;
        }
        .tb-crumb-sep { color: var(--border-2); }
        .tb-title {
          font-size: 15px;
          font-weight: 700;
          color: var(--text);
          letter-spacing: -.02em;
        }
        .tb-live {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          border-radius: 20px;
          background: var(--green-xpale);
          border: 1px solid rgba(45,106,79,.12);
          font-size: 11px;
          font-weight: 600;
          color: var(--green);
        }
        .tb-live-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: var(--green-light);
          animation: pulse 2s infinite;
        }
        .tb-right { display: flex; align-items: center; gap: 8px; }

        .tb-icon-btn {
          width: 36px; height: 36px;
          border-radius: 9px;
          background: #fff;
          border: 1px solid var(--border);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          color: var(--muted);
          transition: all .15s;
        }
        .tb-icon-btn:hover { border-color: var(--green); color: var(--green); background: var(--green-xpale); }

        .tb-date {
          font-size: 12px;
          color: var(--muted);
          font-weight: 500;
          padding: 0 12px;
          border-right: 1px solid var(--border);
          white-space: nowrap;
        }
      `}</style>

      <header className="topbar">
        <div className="tb-left">
          <div className="tb-live">
            <span className="tb-live-dot" />
            Live
          </div>
          <div>
            <div className="tb-crumb">
              <span>AgroAI</span>
              <span className="tb-crumb-sep">/</span>
              <span>{nav.group}</span>
            </div>
            <div className="tb-title">{nav.label}</div>
          </div>
        </div>

        <div className="tb-right">
          <span className="tb-date">
            {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
          </span>

          {/* Refresh */}
          <button className="tb-icon-btn" onClick={onRefresh} title="Refresh data">
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
          </button>

          {/* Export */}
          <button className="btn btn-primary btn-sm" onClick={() => window.print()}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export
          </button>
        </div>
      </header>
    </>
  );
};
