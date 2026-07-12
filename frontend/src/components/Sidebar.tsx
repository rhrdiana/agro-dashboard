"use client";

import React, { useState } from "react";

// ─── Types ─────────────────────────────────────────────────────────────────
export type NavId =
  | "overview"
  | "eda"
  | "stress"
  | "performance"
  | "prediction"
  | "xai"
  | "conclusion"
  | "batch"
  | "audit";

interface NavItem {
  id: NavId;
  label: string;
  icon: React.ReactNode;
  group: "Project" | "Experiment" | "Demo" | "Output";
}

interface SidebarProps {
  activeTab: NavId;
  onTabChange: (tab: NavId) => void;
  sessionId: string;
}

// ─── Nav items ───────────────────────────────────────────────────────────────
const NAV_ITEMS: NavItem[] = [
  {
    id: "overview",
    label: "Overview",
    group: "Project",
    icon: (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="14" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
  },
  {
    id: "eda",
    label: "Data Explorer",
    group: "Project",
    icon: (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3"/>
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
      </svg>
    ),
  },
  {
    id: "stress",
    label: "Stress Test Lab",
    group: "Experiment",
    icon: (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
      </svg>
    ),
  },
  {
    id: "performance",
    label: "Model Performance",
    group: "Experiment",
    icon: (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
        <polyline points="17 6 23 6 23 12"/>
      </svg>
    ),
  },
  {
    id: "batch",
    label: "Batch Prediction",
    group: "Experiment",
    icon: (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M15 3h6v6"/>
        <path d="M10 14 21 3"/>
        <line x1="8" y1="13" x2="8" y2="17"/>
        <line x1="12" y1="11" x2="12" y2="17"/>
        <line x1="16" y1="9" x2="16" y2="13"/>
      </svg>
    ),
  },
  {
    id: "prediction",
    label: "Live Prediction",
    group: "Demo",
    icon: (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polygon points="10 8 16 12 10 16 10 8"/>
      </svg>
    ),
  },
  {
    id: "xai",
    label: "Inside the Model",
    group: "Demo",
    icon: (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    ),
  },
  {
    id: "conclusion",
    label: "Conclusion",
    group: "Output",
    icon: (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  {
    id: "audit",
    label: "Audit Trail",
    group: "Output",
    icon: (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="6" x2="21" y2="6"/>
        <line x1="8" y1="12" x2="21" y2="12"/>
        <line x1="8" y1="18" x2="21" y2="18"/>
        <line x1="3" y1="6" x2="3.01" y2="6"/>
        <line x1="3" y1="12" x2="3.01" y2="12"/>
        <line x1="3" y1="18" x2="3.01" y2="18"/>
      </svg>
    ),
  },
];

const NAV_GROUPS: Array<"Project" | "Experiment" | "Demo" | "Output"> = [
  "Project", "Experiment", "Demo", "Output",
];

// ─── Sidebar ─────────────────────────────────────────────────────────────────
export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange, sessionId }) => {
  const [collapsed, setCollapsed] = useState(false);
  const W = collapsed ? 64 : 220;

  return (
    <>
      <style>{`
        .sb {
          position: fixed;
          left: 0;
          top: 0;
          height: 100vh;
          width: ${W}px;
          background: #fff;
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          transition: width .25s cubic-bezier(.4,0,.2,1);
          z-index: 40;
        }

        .sb-spacer {
          flex-shrink: 0;
          width: ${W}px;
          transition: width .25s cubic-bezier(.4,0,.2,1);
        }

        .sb-logo {
          padding: ${collapsed ? "18px 0" : "20px 18px"};
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          gap: 10px;
          overflow: hidden;
          justify-content: ${collapsed ? "center" : "flex-start"};
          flex-shrink: 0;
        }
        .sb-logo-mark {
          width: 30px; height: 30px; flex-shrink: 0;
          background: var(--green, #1A3D2B);
          border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
        }
        .sb-app-name {
          font-size: 14.5px; font-weight: 700;
          color: var(--text); letter-spacing: -.02em;
          white-space: nowrap;
        }
        .sb-app-sub {
          font-size: 10px; color: var(--muted);
          font-weight: 500; white-space: nowrap;
          margin-top: 1px;
        }

        .sb-nav {
          padding: 10px 10px;
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
        }
        .sb-nav::-webkit-scrollbar { width: 0; }

        .sb-grp {
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: .1em;
          color: var(--muted);
          padding: ${collapsed ? "14px 0 4px" : "14px 8px 4px"};
          white-space: nowrap;
          overflow: hidden;
          text-align: ${collapsed ? "center" : "left"};
          opacity: ${collapsed ? 0 : 1};
          max-height: ${collapsed ? "0px" : "40px"};
          transition: opacity .15s, max-height .15s;
        }

        .nav-btn {
          display: flex;
          align-items: center;
          gap: 9px;
          width: 100%;
          padding: ${collapsed ? "10px 0" : "8px 10px"};
          border-radius: 8px;
          cursor: pointer;
          background: none;
          border: none;
          text-align: left;
          overflow: hidden;
          font-size: 12.5px;
          font-weight: 500;
          font-family: var(--sans);
          color: var(--muted);
          transition: background .12s, color .12s;
          margin-bottom: 1px;
          white-space: nowrap;
          justify-content: ${collapsed ? "center" : "flex-start"};
          position: relative;
        }
        .nav-btn:hover {
          background: var(--green-xpale, #F0FAF4);
          color: var(--green, #1A3D2B);
        }
        .nav-btn.nb-active {
          background: var(--green-xpale, #F0FAF4);
          color: var(--green, #1A3D2B);
          font-weight: 600;
        }
        .nb-dot {
          position: absolute;
          left: 0; top: 50%;
          transform: translateY(-50%);
          width: 2.5px; height: 18px;
          border-radius: 0 2px 2px 0;
          background: var(--green, #1A3D2B);
          opacity: 0;
          transition: opacity .15s;
        }
        .nav-btn.nb-active .nb-dot { opacity: 1; }

        .sb-footer {
          padding: 14px;
          border-top: 1px solid var(--border);
          overflow: hidden;
          flex-shrink: 0;
        }
        .sb-meta {
          display: flex;
          align-items: center;
          gap: 9px;
          overflow: hidden;
        }
        .sb-avatar {
          width: 28px; height: 28px;
          border-radius: 50%;
          background: var(--green-pale, #D8F3DC);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          font-size: 11.5px; font-weight: 700;
          color: var(--green, #1A3D2B);
        }
        .sb-meta-name {
          font-size: 12px; font-weight: 600;
          color: var(--text); white-space: nowrap;
        }
        .sb-meta-id {
          font-size: 10px; color: var(--muted);
          font-family: var(--mono); white-space: nowrap;
          margin-top: 1px;
        }

        .sb-toggle {
          position: fixed;
          left: ${W - 11}px;
          top: 32px;
          width: 22px; height: 22px;
          border-radius: 50%;
          background: #fff;
          border: 1px solid var(--border);
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          color: var(--muted);
          transition: left .25s cubic-bezier(.4,0,.2,1), border-color .12s, color .12s;
          z-index: 50;
        }
        .sb-toggle:hover {
          border-color: var(--green, #1A3D2B);
          color: var(--green, #1A3D2B);
        }

        @media (max-width: 1100px) {
          .sb { display: none; }
          .sb-spacer { display: none; }
          .sb-toggle { display: none; }
        }
      `}</style>

      {/* Fixed sidebar */}
      <aside className="sb">
        {/* Logo */}
        <div className="sb-logo">
          <div className="sb-logo-mark">
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 8C8 10 5.9 16.17 3.82 19.11a1 1 0 0 0 1.16 1.47C6.82 19.67 10.83 18 17 18c5 0 7-2 7-7 0-6-3-9-9-9-4 0-7 2-7 6 0 2 1 4 3 5" />
            </svg>
          </div>
          {!collapsed && (
            <div>
              <div className="sb-app-name">AgroAI</div>
              <div className="sb-app-sub">IoT Analytics v2.0</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="sb-nav">
          {NAV_GROUPS.map(group => (
            <div key={group}>
              <div className="sb-grp">{group}</div>
              {NAV_ITEMS.filter(n => n.group === group).map(item => (
                <button
                  key={item.id}
                  className={`nav-btn ${activeTab === item.id ? "nb-active" : ""}`}
                  onClick={() => onTabChange(item.id)}
                  title={collapsed ? item.label : ""}
                >
                  <span className="nb-dot" />
                  <span style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
                    {item.icon}
                  </span>
                  {!collapsed && <span style={{ flex: 1 }}>{item.label}</span>}
                </button>
              ))}
            </div>
          ))}
        </nav>

        {/* Footer */}
        {!collapsed && (
          <div className="sb-footer">
            <div className="sb-meta">
              <div className="sb-avatar">A</div>
              <div style={{ overflow: "hidden" }}>
                <div className="sb-meta-name">AgroAI</div>
                <div className="sb-meta-id">#{sessionId}</div>
              </div>
              <div style={{ marginLeft: "auto", flexShrink: 0 }}>
                <span style={{
                  width: 7, height: 7, borderRadius: "50%",
                  background: "#22c55e", display: "block",
                  boxShadow: "0 0 0 2px rgba(34,197,94,.2)",
                }} />
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Toggle button */}
      <button className="sb-toggle" onClick={() => setCollapsed(p => !p)}>
        <svg width={10} height={10} viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={2}>
          {collapsed
            ? <polyline points="3,2 7,5 3,8" />
            : <polyline points="7,2 3,5 7,8" />}
        </svg>
      </button>

      {/* Spacer */}
      <div className="sb-spacer" />
    </>
  );
};
