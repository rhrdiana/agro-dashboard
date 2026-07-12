"use client";

import React, { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import { ConfMatrix, Sk, SectionWrap } from "../UI";
import type { PerfResponse } from "../../app/page";

// ─── Types ────────────────────────────────────────────────────────────────────
interface PerfProps {
  perfData: PerfResponse | null;
  loading:  boolean;
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const DT_COLOR   = "#1A3D2B";
const NB_COLOR   = "#52B788";
const FEAT_COLORS = ["#1A3D2B","#2D6A4F","#40916C","#52B788","#74C69D","#95D5B2","#B7E4C7"];

// ─── Sub-components ───────────────────────────────────────────────────────────
const Label = ({ children, color }: { children: React.ReactNode; color?: string }) => (
  <p style={{
    fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const,
    letterSpacing: ".12em", color: color ?? "var(--muted)", marginBottom: 14,
  }}>{children}</p>
);

const MetricBar = ({
  tag, val, color, faded,
}: { tag: string; val: number; color: string; faded?: boolean }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 5 }}>
    <span style={{
      fontSize: 9, fontFamily: "var(--mono)", color: "var(--muted)",
      width: 28, textAlign: "right", flexShrink: 0, letterSpacing: ".04em",
    }}>{tag}</span>
    <div style={{
      flex: 1, height: 5, background: "var(--bg)",
      borderRadius: 2, overflow: "hidden",
    }}>
      <div style={{
        height: "100%", borderRadius: 2,
        width: `${Math.min(val, 100)}%`,
        background: color, opacity: faded ? 0.28 : 1,
        transition: "width .6s cubic-bezier(.4,0,.2,1)",
      }} />
    </div>
    <span style={{
      fontFamily: "var(--mono)", fontSize: 10.5,
      color: faded ? "var(--muted)" : "var(--text)",
      width: 44, textAlign: "right", flexShrink: 0,
    }}>{val?.toFixed(2)}%</span>
  </div>
);

// [FIX] Threshold turun dari >2 ke >0.1 agar selisih kecil tetap terdeteksi
const getWinner = (perfData: PerfResponse | null) => {
  const dtA = perfData?.metrics?.after_fs?.decision_tree?.accuracy ?? 0;
  const nbA = perfData?.metrics?.after_fs?.naive_bayes?.accuracy   ?? 0;
  const diff = dtA - nbA;
  if (diff >  0.1) return { name: "Decision Tree", margin: diff.toFixed(2), winner: "dt" };
  if (diff < -0.1) return { name: "Naive Bayes",   margin: (-diff).toFixed(2), winner: "nb" };
  return { name: "Tie", margin: Math.abs(diff).toFixed(2), winner: "tie" };
};

// Colour badge untuk nilai metrik
const metricChip = (v: number) => ({
  color:      v >= 90 ? "#1A3D2B" : v >= 70 ? "#B45309" : "#991B1B",
  background: v >= 90 ? "#F0FAF4" : v >= 70 ? "#FFFBEB" : "#FEF2F2",
});

// ─── Main component ───────────────────────────────────────────────────────────
export const PerformanceSection: React.FC<PerfProps> = ({ perfData, loading }) => {
  // Tab untuk confusion matrix: "after" | "before"
  const [cmTab, setCmTab] = useState<"after" | "before">("after");

  const winner = getWinner(perfData);

  const compareRows = [
    { metric: "Accuracy",
      dtA: perfData?.metrics?.after_fs?.decision_tree?.accuracy,
      nbA: perfData?.metrics?.after_fs?.naive_bayes?.accuracy,
      dtB: perfData?.metrics?.before_fs?.decision_tree?.accuracy,
      nbB: perfData?.metrics?.before_fs?.naive_bayes?.accuracy },
    { metric: "Precision",
      dtA: perfData?.metrics?.after_fs?.decision_tree?.precision,
      nbA: perfData?.metrics?.after_fs?.naive_bayes?.precision,
      dtB: perfData?.metrics?.before_fs?.decision_tree?.precision,
      nbB: perfData?.metrics?.before_fs?.naive_bayes?.precision },
    { metric: "Recall",
      dtA: perfData?.metrics?.after_fs?.decision_tree?.recall,
      nbA: perfData?.metrics?.after_fs?.naive_bayes?.recall,
      dtB: perfData?.metrics?.before_fs?.decision_tree?.recall,
      nbB: perfData?.metrics?.before_fs?.naive_bayes?.recall },
    { metric: "F1-Score",
      dtA: perfData?.metrics?.after_fs?.decision_tree?.f1_score,
      nbA: perfData?.metrics?.after_fs?.naive_bayes?.f1_score,
      dtB: perfData?.metrics?.before_fs?.decision_tree?.f1_score,
      nbB: perfData?.metrics?.before_fs?.naive_bayes?.f1_score },
  ];

  // [FIX] split_info dari PerfResponse v3.3.0
  const splitInfo = perfData?.split_info as Record<string, unknown> | undefined;

  // [FIX] best_dt_params_full & best_dt_params_sel dari PerfResponse v3.3.0
  const bestSel  = perfData?.best_dt_params_sel  as Record<string, unknown> | undefined;
  const bestFull = perfData?.best_dt_params_full as Record<string, unknown> | undefined;

  // Feature importance sudah disorting dari API — tidak perlu sort ulang
  const featImportance = perfData?.feature_importance_dt ?? [];

  return (
    <SectionWrap>

      {/* ── Head-to-head ──────────────────────────────────────────────────── */}
      <div className="card" style={{ padding: "28px 30px" }}>
        <div style={{
          display: "flex", alignItems: "flex-start",
          justifyContent: "space-between", marginBottom: 26, gap: 16,
        }}>
          <div>
            <Label>Head-to-Head</Label>
            <div style={{
              fontSize: 16, fontWeight: 700,
              color: "var(--text)", letterSpacing: "-.025em", lineHeight: 1.2,
            }}>Decision Tree vs Naive Bayes</div>
          </div>

          {/* [FIX] Winner badge — threshold 0.1% */}
          {!loading && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "7px 14px", borderRadius: 6, flexShrink: 0,
              background: winner.winner === "tie" ? "var(--bg)" : "#F0FAF4",
              border: `1px solid ${winner.winner === "tie" ? "var(--border)" : "#B7E4C7"}`,
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                background: winner.winner === "tie" ? "var(--muted)" : DT_COLOR,
              }} />
              <span style={{
                fontSize: 11, fontWeight: 600, letterSpacing: "-.01em",
                color: winner.winner === "tie" ? "var(--muted)" : DT_COLOR,
              }}>
                {winner.winner === "tie"
                  ? `Imbang — selisih ${winner.margin}%`
                  : `${winner.name} unggul ${winner.margin}%`}
              </span>
            </div>
          )}
        </div>

        {loading ? <Sk h={220} /> : (
          <div>
            {compareRows.map((row, idx) => (
              <div key={row.metric} style={{
                display: "grid", gridTemplateColumns: "80px 1fr",
                gap: 20, alignItems: "start",
                padding: "14px 0",
                borderTop: idx === 0 ? "1px solid var(--border)" : "none",
                borderBottom: "1px solid var(--border)",
              }}>
                <div style={{
                  fontSize: 11.5, fontWeight: 600,
                  color: "var(--text)", paddingTop: 2, letterSpacing: "-.01em",
                }}>{row.metric}</div>
                <div>
                  <MetricBar tag="DT↑" val={row.dtA ?? 0} color={DT_COLOR} />
                  <MetricBar tag="NB↑" val={row.nbA ?? 0} color={NB_COLOR} />
                  <MetricBar tag="DT↓" val={row.dtB ?? 0} color={DT_COLOR} faded />
                  <MetricBar tag="NB↓" val={row.nbB ?? 0} color={NB_COLOR} faded />
                </div>
              </div>
            ))}
            <div style={{
              fontSize: 10, color: "var(--muted)",
              marginTop: 12, textAlign: "right", letterSpacing: ".02em",
            }}>
              ↑ After Feature Selection &nbsp;·&nbsp; ↓ Before Feature Selection
            </div>
          </div>
        )}
      </div>

      {/* ── Confusion Matrices — tabbed (After / Before FS) ─────────────── */}
      {/* [FIX] Before FS juga ditampilkan via tab */}
      <div className="card">
        {/* Tab switcher */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
          {(["after","before"] as const).map(t => (
            <button key={t} onClick={() => setCmTab(t)} style={{
              padding: "5px 14px", borderRadius: 6, fontSize: 10.5,
              fontWeight: 700, cursor: "pointer", border: "1px solid",
              borderColor: cmTab === t ? DT_COLOR : "var(--border)",
              background:  cmTab === t ? DT_COLOR : "var(--bg)",
              color:       cmTab === t ? "#fff"   : "var(--muted)",
              transition: "all .15s",
              textTransform: "uppercase" as const, letterSpacing: ".08em",
            }}>
              {t === "after" ? "After FS" : "Before FS"}
            </button>
          ))}
        </div>

        <div className="g2">
          {[
            {
              title: `Confusion Matrix — DT ${cmTab === "after" ? "After" : "Before"} FS`,
              data:  cmTab === "after"
                ? perfData?.metrics?.after_fs?.decision_tree
                : perfData?.metrics?.before_fs?.decision_tree,
              accent: DT_COLOR,
            },
            {
              title: `Confusion Matrix — NB ${cmTab === "after" ? "After" : "Before"} FS`,
              data:  cmTab === "after"
                ? perfData?.metrics?.after_fs?.naive_bayes
                : perfData?.metrics?.before_fs?.naive_bayes,
              accent: NB_COLOR,
            },
          ].map(({ title, data, accent }) => (
            <div key={title} style={{ borderTop: `2px solid ${accent}`, paddingTop: 14 }}>
              <Label color={accent}>{title}</Label>
              {loading ? <Sk h={160} /> : data
                ? <ConfMatrix matrix={data.confusion_matrix} classes={data.classes} />
                : <p style={{ color: "var(--muted)", fontSize: 12 }}>Tidak ada data.</p>
              }
            </div>
          ))}
        </div>
      </div>

      {/* ── Per-class + Feature importance ───────────────────────────────── */}
      <div className="g2">

        {/* Per-class table */}
        <div className="card">
          <Label>Per-Class — DT After FS</Label>
          {loading ? <Sk h={160} /> : (
            <table className="tbl">
              <thead>
                <tr>
                  {["Class","Precision","Recall","F1","Support"].map(h => (
                    <th key={h} style={{ textAlign: h === "Class" ? "left" : "center" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(
                  perfData?.metrics?.after_fs?.decision_tree?.per_class ?? {}
                ).map(([cls, m]) => (
                  <tr key={cls}>
                    <td>
                      <span style={{
                        fontSize: 11, fontWeight: 600, color: DT_COLOR,
                        background: "#F0FAF4", padding: "3px 8px",
                        borderRadius: 4, fontFamily: "var(--mono)",
                      }}>{cls}</span>
                    </td>
                    {([m.precision, m.recall, m.f1] as number[]).map((v, i) => (
                      <td key={i} style={{ textAlign: "center" }}>
                        <span style={{
                          fontFamily: "var(--mono)", fontSize: 11, fontWeight: 600,
                          padding: "2px 7px", borderRadius: 4,
                          ...metricChip(v),
                        }}>{v?.toFixed(2)}%</span>
                      </td>
                    ))}
                    <td style={{
                      fontFamily: "var(--mono)", fontSize: 11,
                      color: "var(--muted)", textAlign: "center",
                    }}>{m.support}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Feature importance */}
        <div className="card">
          <Label>Feature Importance — DT After FS</Label>
          <div style={{ height: 220 }}>
            {loading ? <Sk h={220} /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  // [FIX] Tidak perlu sort — API sudah sort descending
                  data={featImportance}
                  layout="vertical"
                  margin={{ top: 0, right: 52, bottom: 0, left: 0 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="abbr" type="category" width={52}
                    tick={{ fontSize: 10.5, fontFamily: "var(--mono)", fill: "var(--muted)" }}
                    axisLine={false} tickLine={false}
                  />
                  <Tooltip
                    formatter={(v: any) => [`${Number(v).toFixed(3)}%`, "Importance"]}
                    contentStyle={{
                      background: "#fff", border: "1px solid var(--border)",
                      borderRadius: 8, fontSize: 11.5,
                      boxShadow: "0 4px 16px rgba(0,0,0,.06)",
                      fontFamily: "var(--mono)",
                    }}
                    cursor={{ fill: "var(--bg)" }}
                  />
                  <Bar dataKey="importance" radius={[0,3,3,0]} maxBarSize={11}
                    label={{
                      position: "right", fontSize: 10,
                      fontFamily: "var(--mono)", fill: "var(--muted)",
                      formatter: (v: any) => `${Number(v).toFixed(1)}%`,
                    }}
                  >
                    {featImportance.map((_, i) => (
                      <Cell key={i} fill={FEAT_COLORS[i % FEAT_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* ── Best DT Params — [FIX] v3.3.0: full & sel dipisah ──────────── */}
      {!loading && (bestSel || bestFull) && (
        <div className="g2">
          {[
            { title: "Best DT Params — Selected Features (After RFE)",  params: bestSel  },
            { title: "Best DT Params — Full Features (Before RFE)",      params: bestFull },
          ].map(({ title, params }) =>
            params ? (
              <div className="card" key={title}>
                <Label>{title}</Label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {Object.entries(params).map(([k, v]) => (
                    <span key={k} style={{
                      fontFamily: "var(--mono)", fontSize: 10.5,
                      background: "var(--bg)", border: "1px solid var(--border)",
                      borderRadius: 5, padding: "3px 9px", color: "var(--text)",
                    }}>
                      <span style={{ color: "var(--muted)", marginRight: 4 }}>
                        {k.replace(/_/g, " ")}
                      </span>
                      <strong>{String(v ?? "None")}</strong>
                    </span>
                  ))}
                </div>
              </div>
            ) : null
          )}
        </div>
      )}

      {/* ── Split info — [FIX] tersedia di PerfResponse v3.3.0 ──────────── */}
      {!loading && splitInfo && (
        <div className="card">
          <Label>Pipeline Split Info — v3.3.0</Label>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 8,
          }}>
            {Object.entries(splitInfo).map(([k, v]) => (
              <div key={k} style={{
                background: "var(--bg)", border: "1px solid var(--border)",
                borderRadius: 7, padding: "10px 12px",
              }}>
                <div style={{
                  fontSize: 9, fontWeight: 700, textTransform: "uppercase" as const,
                  letterSpacing: ".1em", color: "var(--muted)", marginBottom: 4,
                }}>
                  {k.replace(/_/g, " ")}
                </div>
                <div style={{
                  fontSize: 11, fontFamily: "var(--mono)",
                  color: "var(--text)", wordBreak: "break-word",
                }}>
                  {String(v ?? "—")}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </SectionWrap>
  );
};
