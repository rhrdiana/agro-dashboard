"use client";

import React, { useState, useEffect } from "react";

// ─── Skeleton ─────────────────────────────────────────────────────────────────
export const Sk = ({ h = 20, w = "100%" }: { h?: number; w?: string | number }) => (
  <div className="skeleton" style={{ height: h, width: w, borderRadius: 8 }} />
);

// ─── KPI Card ─────────────────────────────────────────────────────────────────
export const KpiCard = ({
  label, value, sub, icon, color = "var(--green)",
}: {
  label: string; value: any; sub?: string; icon?: React.ReactNode; color?: string;
}) => (
  <>
    <style>{`
      .kpi-card {
        background: #fff;
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .kpi-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 10px;
      }
      .kpi-icon {
        width: 30px; height: 30px;
        border-radius: 8px;
        background: var(--green-xpale);
        border: 1px solid rgba(45,106,79,.1);
        display: flex; align-items: center; justify-content: center;
      }
      .kpi-val {
        font-size: 26px;
        font-weight: 700;
        letter-spacing: -.03em;
        line-height: 1;
        font-variant-numeric: normal;
        font-feature-settings: normal;
      }
      .kpi-label {
        font-size: 10px;
        font-weight: 700;
        color: var(--muted);
        text-transform: uppercase;
        letter-spacing: .1em;
      }
      .kpi-sub {
        font-size: 11px;
        color: var(--muted);
        margin-top: 3px;
      }
    `}</style>
    <div className="kpi-card">
      <div className="kpi-top">
        <span className="kpi-label">{label}</span>
        {icon && <div className="kpi-icon">{icon}</div>}
      </div>
      <div className="kpi-val" style={{ color }}>{value ?? "—"}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  </>
);

// ─── Metric mini box ──────────────────────────────────────────────────────────
export const MetricBox = ({
  label, value, unit = "%", color = "var(--green)",
}: {
  label: string; value: any; unit?: string; color?: string;
}) => (
  <div style={{
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "12px 14px",
    textAlign: "center",
  }}>
    <div style={{
      fontSize: 18,
      fontWeight: 700,
      color,
      lineHeight: 1,
      letterSpacing: "-.02em",
      fontVariantNumeric: "normal",
      fontFeatureSettings: "'tnum' 0",
    }}>
      {value != null
        ? `${typeof value === "number" ? value.toFixed(1) : value}${unit}`
        : "—"}
    </div>
    <div style={{
      fontSize: 9.5,
      color: "var(--muted)",
      fontWeight: 700,
      textTransform: "uppercase" as const,
      letterSpacing: ".1em",
      marginTop: 6,
    }}>{label}</div>
  </div>
);

// ─── Confusion Matrix ─────────────────────────────────────────────────────────
export const ConfMatrix = ({ matrix, classes }: { matrix: number[][]; classes: string[] }) => {
  const maxVal = Math.max(...matrix.flat(), 1);
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", fontSize: 11.5, fontFamily: "var(--mono)" }}>
        <thead>
          <tr>
            <th style={{ padding: "6px 10px", color: "var(--muted)", fontSize: 10, fontWeight: 600 }}>↓Act / Pred→</th>
            {classes.map(c => (
              <th key={c} style={{ padding: "6px 12px", color: "var(--green)", fontWeight: 700 }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, i) => (
            <tr key={i}>
              <td style={{ padding: "6px 10px", color: "var(--green)", fontWeight: 700 }}>{classes[i]}</td>
              {row.map((cell, j) => {
                const diag = i === j;
                const alpha = cell / maxVal;
                const bg = diag
                  ? `rgba(45,106,79,${0.08 + alpha * 0.45})`
                  : cell > 0 ? `rgba(217,95,95,${0.06 + alpha * 0.3})` : "transparent";
                return (
                  <td key={j} style={{
                    padding: "9px 16px", textAlign: "center",
                    background: bg,
                    fontWeight: diag ? 700 : 400,
                    color: diag ? "var(--green)" : cell > 0 ? "var(--red)" : "var(--muted)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                  }}>{cell}</td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ─── Class probability bars ───────────────────────────────────────────────────
const CLASS_COLORS: Record<string, string> = {
  SA: "#2D6A4F", SB: "#40916C", SC: "#52B788", SD: "#74C69D", SE: "#95D5B2",
};

export const ProbBars = ({ probs }: { probs: Record<string, number> }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
    {Object.entries(probs).map(([cls, pct]) => (
      <div key={cls} style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{
          fontFamily: "var(--mono)", fontSize: 11, fontWeight: 600,
          width: 26, color: "var(--text-2)", flexShrink: 0,
        }}>{cls}</span>
        <div style={{
          flex: 1, height: 5, background: "var(--border)",
          borderRadius: 999, overflow: "hidden",
        }}>
          <div style={{
            height: "100%",
            width: `${pct}%`,
            background: CLASS_COLORS[cls] ?? "#40916C",
            borderRadius: 999,
            transition: "width .5s ease",
          }} />
        </div>
        <span style={{
          fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted)",
          width: 42, textAlign: "right", flexShrink: 0,
        }}>{pct.toFixed(1)}%</span>
      </div>
    ))}
  </div>
);

// ─── Feature Input ────────────────────────────────────────────────────────────
export const FeatureInput: React.FC<{
  feat: string;
  abbr: string;
  value: number;
  onChange: (v: number) => void;
  stats?: { mean: number; std: number; min: number; max: number };
}> = ({ feat, abbr, value, onChange, stats }) => {
  const [raw, setRaw] = useState(String(value));
  const min = stats ? Math.max(0, stats.min - stats.std) : 0;
  const max = stats ? stats.max + stats.std : 200;

  useEffect(() => { setRaw(value.toFixed(2)); }, [value]);
  const commit = (s: string) => {
    const n = parseFloat(s);
    if (!isNaN(n)) onChange(n);
    else setRaw(value.toFixed(2));
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "center", marginBottom: 7,
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{
            fontSize: 11.5, fontWeight: 700,
            color: "var(--green)", fontFamily: "var(--mono)",
          }}>{abbr}</span>
          <span style={{ fontSize: 11, color: "var(--muted)" }}>{feat}</span>
        </div>
        {stats && (
          <span style={{
            fontSize: 10, color: "var(--muted)", fontFamily: "var(--mono)",
          }}>μ {stats.mean.toFixed(1)}</span>
        )}
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <input
          type="number" step={0.01} value={raw} style={{ width: 80 }}
          onChange={e => setRaw(e.target.value)}
          onBlur={e => commit(e.target.value)}
          onKeyDown={e => e.key === "Enter" && commit(raw)}
        />
        <input
          type="range" min={min} max={max} step={0.1} value={value}
          style={{ flex: 1 }}
          onChange={e => {
            const v = parseFloat(e.target.value);
            onChange(v);
            setRaw(v.toFixed(2));
          }}
        />
      </div>
      {stats && (
        <div style={{
          display: "flex", justifyContent: "space-between",
          fontSize: 9.5, color: "var(--muted)", marginTop: 3,
          fontFamily: "var(--mono)",
        }}>
          <span>{stats.min.toFixed(1)}</span>
          <span>{stats.max.toFixed(1)}</span>
        </div>
      )}
    </div>
  );
};

// ─── Section wrapper ──────────────────────────────────────────────────────────
export const SectionWrap: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="section-anim g1">{children}</div>
);
