"use client";

import React from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { ConfMatrix, Sk, SectionWrap } from "../UI";

interface PerfProps { perfData: any; loading: boolean; }

const getWinner = (perfData: any) => {
  const dtA = perfData?.metrics?.after_fs?.decision_tree?.accuracy ?? 0;
  const nbA = perfData?.metrics?.after_fs?.naive_bayes?.accuracy ?? 0;
  if (dtA > nbA + 2) return { name: "Decision Tree", margin: (dtA - nbA).toFixed(2), winner: "dt" };
  if (nbA > dtA + 2) return { name: "Naive Bayes", margin: (nbA - dtA).toFixed(2), winner: "nb" };
  return { name: "Tie", margin: Math.abs(dtA - nbA).toFixed(2), winner: "tie" };
};

const MetricBar = ({ tag, val, color, faded }: { tag: string; val: number; color: string; faded?: boolean }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 5 }}>
    <span style={{
      fontSize: 9,
      fontFamily: "var(--mono)",
      color: "var(--muted)",
      width: 24,
      textAlign: "right",
      flexShrink: 0,
      letterSpacing: ".04em",
    }}>{tag}</span>
    <div style={{
      flex: 1,
      height: 5,
      background: "var(--bg)",
      borderRadius: 2,
      overflow: "hidden",
    }}>
      <div style={{
        height: "100%",
        borderRadius: 2,
        width: `${val}%`,
        background: color,
        opacity: faded ? 0.28 : 1,
        transition: "width .6s cubic-bezier(.4,0,.2,1)",
      }} />
    </div>
    <span style={{
      fontFamily: "var(--mono)",
      fontSize: 10.5,
      color: faded ? "var(--muted)" : "var(--text-2)",
      width: 40,
      textAlign: "right",
      flexShrink: 0,
    }}>{val?.toFixed(1)}%</span>
  </div>
);

export const PerformanceSection: React.FC<PerfProps> = ({ perfData, loading }) => {
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

  const DT_COLOR = "#1A3D2B";
  const NB_COLOR = "#52B788";
  const FEAT_COLORS = ["#1A3D2B", "#2D6A4F", "#40916C", "#52B788", "#74C69D", "#95D5B2", "#B7E4C7"];

  return (
    <SectionWrap>

      {/* Head-to-head */}
      <div className="card" style={{ padding: "28px 30px" }}>
        <div style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 26,
          gap: 16,
        }}>
          <div>
            <div style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: ".12em",
              color: "var(--muted)",
              marginBottom: 6,
            }}>Head-to-Head</div>
            <div style={{
              fontSize: 16,
              fontWeight: 700,
              color: "var(--text)",
              letterSpacing: "-.025em",
              lineHeight: 1.2,
            }}>Decision Tree vs Naive Bayes</div>
          </div>

          {!loading && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "7px 14px",
              borderRadius: 6,
              background: winner.winner === "tie" ? "var(--bg)" : "#F0FAF4",
              border: `1px solid ${winner.winner === "tie" ? "var(--border)" : "#B7E4C7"}`,
              flexShrink: 0,
            }}>
              <div style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: winner.winner === "tie" ? "var(--muted)" : DT_COLOR,
                flexShrink: 0,
              }} />
              <span style={{
                fontSize: 11,
                fontWeight: 600,
                color: winner.winner === "tie" ? "var(--muted)" : DT_COLOR,
                letterSpacing: "-.01em",
              }}>
                {winner.winner === "tie"
                  ? `Imbang — selisih ${winner.margin}%`
                  : `${winner.name} unggul ${winner.margin}%`}
              </span>
            </div>
          )}
        </div>

        {loading ? <Sk h={200} /> : (
          <div>
            {compareRows.map((row, idx) => (
              <div key={row.metric} style={{
                display: "grid",
                gridTemplateColumns: "72px 1fr",
                gap: 20,
                alignItems: "start",
                padding: "14px 0",
                borderTop: idx === 0 ? "1px solid var(--border)" : "none",
                borderBottom: "1px solid var(--border)",
              }}>
                <div style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: "var(--text)",
                  paddingTop: 2,
                  letterSpacing: "-.01em",
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
              fontSize: 10,
              color: "var(--muted)",
              marginTop: 12,
              textAlign: "right",
              letterSpacing: ".02em",
            }}>
              ↑ After Feature Selection &nbsp;&middot;&nbsp; ↓ Before Feature Selection
            </div>
          </div>
        )}
      </div>

      {/* Confusion matrices */}
      <div className="g2">
        {[
          { title: "Confusion Matrix — DT After FS", data: perfData?.metrics?.after_fs?.decision_tree, accent: DT_COLOR },
          { title: "Confusion Matrix — NB After FS", data: perfData?.metrics?.after_fs?.naive_bayes, accent: NB_COLOR },
        ].map(({ title, data, accent }) => (
          <div className="card" key={title} style={{
            borderTop: `2px solid ${accent}`,
          }}>
            <div style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: ".1em",
              color: accent,
              marginBottom: 16,
            }}>{title}</div>
            {loading ? <Sk h={160} /> : data ? <ConfMatrix matrix={data.confusion_matrix} classes={data.classes} /> : null}
          </div>
        ))}
      </div>

      {/* Per-class + Feature importance */}
      <div className="g2">
        <div className="card">
          <div style={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: ".1em",
            color: "var(--muted)",
            marginBottom: 16,
          }}>Per-Class — DT After FS</div>
          {loading ? <Sk h={150} /> : (
            <table className="tbl" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Class", "Precision", "Recall", "F1", "Support"].map(h => (
                    <th key={h} style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: "var(--muted)",
                      textTransform: "uppercase",
                      letterSpacing: ".08em",
                      padding: "0 0 10px",
                      textAlign: h === "Class" ? "left" : "center",
                      borderBottom: "1px solid var(--border)",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(perfData?.metrics?.after_fs?.decision_tree?.per_class ?? {}).map(([cls, m]: [string, any]) => (
                  <tr key={cls}>
                    <td style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                      <span style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: DT_COLOR,
                        background: "#F0FAF4",
                        padding: "3px 8px",
                        borderRadius: 4,
                        fontFamily: "var(--mono)",
                      }}>{cls}</span>
                    </td>
                    {[m.precision, m.recall, m.f1].map((v: number, i: number) => (
                      <td key={i} style={{
                        textAlign: "center",
                        padding: "10px 0",
                        borderBottom: "1px solid var(--border)",
                      }}>
                        <span style={{
                          fontFamily: "var(--mono)",
                          fontSize: 11,
                          fontWeight: 600,
                          color: v >= 85 ? "#1A3D2B" : v >= 65 ? "#B45309" : "#991B1B",
                          background: v >= 85 ? "#F0FAF4" : v >= 65 ? "#FFFBEB" : "#FEF2F2",
                          padding: "2px 7px",
                          borderRadius: 4,
                        }}>{v}%</span>
                      </td>
                    ))}
                    <td style={{
                      fontFamily: "var(--mono)",
                      fontSize: 11,
                      color: "var(--muted)",
                      textAlign: "center",
                      padding: "10px 0",
                      borderBottom: "1px solid var(--border)",
                    }}>{m.support}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <div style={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: ".1em",
            color: "var(--muted)",
            marginBottom: 16,
          }}>Feature Importance — DT After FS</div>
          <div style={{ height: 220 }}>
            {loading ? <Sk h={220} /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[...(perfData?.feature_importance_dt ?? [])].sort((a: any, b: any) => b.importance - a.importance)}
                  layout="vertical"
                  margin={{ top: 0, right: 52, bottom: 0, left: 0 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="abbr"
                    type="category"
                    width={52}
                    tick={{ fontSize: 10.5, fontFamily: "DM Mono", fill: "var(--muted)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(v: any) => [`${Number(v).toFixed(2)}%`, "Importance"]}
                    contentStyle={{
                      background: "#fff",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 11.5,
                      boxShadow: "0 4px 16px rgba(0,0,0,.06)",
                      fontFamily: "var(--mono)",
                    }}
                    cursor={{ fill: "var(--bg)" }}
                  />
                  <Bar dataKey="importance" radius={[0, 3, 3, 0]} maxBarSize={11}
                    label={{
                      position: "right",
                      fontSize: 10,
                      fontFamily: "DM Mono",
                      fill: "var(--muted)",
                      formatter: (v: any) => `${Number(v).toFixed(1)}%`,
                    }}>
                    {(perfData?.feature_importance_dt ?? []).map((_: any, i: number) => (
                      <Cell key={i} fill={FEAT_COLORS[i % FEAT_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

    </SectionWrap>
  );
};
