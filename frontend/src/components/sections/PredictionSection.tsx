"use client";

import React, { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend,
} from "recharts";
import { FeatureInput, ProbBars, Sk, SectionWrap } from "../UI";
import type {
  PredictResponse, EdaResponse,
  WhatIfResponse, DecisionPathNode, FeatureStat,
} from "../../app/page";

const DT_COLOR = "#1A3D2B";
const NB_COLOR = "#40916C";

interface PredProps {
  inputs:           Record<string, number>;
  setInputs:        (fn: (p: Record<string, number>) => Record<string, number>) => void;
  edaData:          EdaResponse | null;
  predResult:       PredictResponse | null;
  predLoading:      boolean;
  whatIfData:       WhatIfResponse | null;
  whatIfLoading:    boolean;
  onFetchWhatIf:    (feature: string, min: number, max: number, steps?: number) => void;
  onDownloadReport: (logIndex: number) => void;
}

// ─── Helper: ambil stats RAW per fitur ────────────────────────────────────────
// Prioritas: feature_stats_raw_sel (nilai asli) → fallback scaler_params (mean_ saja)
// JANGAN pakai feature_stats_selected (scaled, mean≈0)
function getRawStats(
  edaData: EdaResponse | null,
  feat: string,
): { mean: number; min: number; max: number; std: number } | null {
  if (!edaData) return null;

  // [FIX] Opsi A: feature_stats_raw_sel tersedia (setelah patch main.py)
  const rawSel = (edaData as any)?.feature_stats_raw_sel as
    Record<string, FeatureStat> | undefined;
  if (rawSel?.[feat]) {
    const s = rawSel[feat];
    return { mean: s.mean, min: s.min, max: s.max, std: s.std };
  }

  // [FIX] Opsi B: fallback ke scaler_params.mean_ jika raw belum ada
  // mean_ = mean training raw, scale_ = std training raw
  const sp = edaData.scaler_params?.[feat];
  if (sp) {
    // Rekonstruksi min/max dari scaled stats × scale_ + mean_
    const scaled = edaData.feature_stats_selected[feat];
    const mean_  = sp.mean_;
    const scale_ = sp.scale_;
    return {
      mean: mean_,
      std:  scale_,
      min:  scaled ? scaled.min  * scale_ + mean_ : mean_ - 3 * scale_,
      max:  scaled ? scaled.max  * scale_ + mean_ : mean_ + 3 * scale_,
    };
  }

  return null;
}

// ── What-If panel ─────────────────────────────────────────────────────────────
const WhatIfPanel: React.FC<{
  edaData:       EdaResponse | null;
  inputs:        Record<string, number>;
  whatIfData:    WhatIfResponse | null;
  whatIfLoading: boolean;
  onFetch:       (feature: string, min: number, max: number, steps?: number) => void;
}> = ({ edaData, inputs, whatIfData, whatIfLoading, onFetch }) => {
  const features = edaData ? Object.keys(edaData.feature_stats_selected) : [];
  const abbr     = edaData?.feature_abbr ?? {};

  const [selectedFeat, setSelectedFeat] = useState<string>(features[0] ?? "");
  const [rangeMin, setRangeMin]         = useState<number>(0);
  const [rangeMax, setRangeMax]         = useState<number>(100);

  const handleFeatChange = (col: string) => {
    setSelectedFeat(col);
    // [FIX] Pakai raw stats untuk range min/max — bukan scaled
    const raw = getRawStats(edaData, col);
    if (raw) {
      setRangeMin(parseFloat(raw.min.toFixed(4)));
      setRangeMax(parseFloat(raw.max.toFixed(4)));
    }
  };

  return (
    <div className="card">
      <div style={{
        fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const,
        letterSpacing: ".1em", color: "var(--muted)", marginBottom: 4,
      }}>What-If Analysis</div>
      <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 14 }}>
        Lihat bagaimana prediksi berubah saat satu fitur divariasikan
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <select
          value={selectedFeat}
          onChange={e => handleFeatChange(e.target.value)}
          style={{
            flex: 1, minWidth: 160, fontSize: 12,
            padding: "6px 10px", borderRadius: 6,
            border: "1px solid var(--border)",
            background: "var(--card, #fff)", color: "var(--text)",
          }}
        >
          {features.map(f => (
            <option key={f} value={f}>{abbr[f] ?? f}</option>
          ))}
        </select>

        <input
          type="number"
          value={rangeMin}
          onChange={e => setRangeMin(parseFloat(e.target.value))}
          placeholder="Min"
          style={{
            width: 90, fontSize: 12, padding: "6px 10px",
            borderRadius: 6, border: "1px solid var(--border)",
            background: "var(--card, #fff)", color: "var(--text)",
          }}
        />

        <input
          type="number"
          value={rangeMax}
          onChange={e => setRangeMax(parseFloat(e.target.value))}
          placeholder="Max"
          style={{
            width: 90, fontSize: 12, padding: "6px 10px",
            borderRadius: 6, border: "1px solid var(--border)",
            background: "var(--card, #fff)", color: "var(--text)",
          }}
        />

        <button
          onClick={() => onFetch(abbr[selectedFeat] ?? selectedFeat, rangeMin, rangeMax, 30)}
          disabled={whatIfLoading || !selectedFeat}
          style={{
            fontSize: 12, fontWeight: 600,
            padding: "6px 16px", borderRadius: 6,
            border: "none", background: DT_COLOR, color: "#fff",
            cursor: whatIfLoading ? "not-allowed" : "pointer",
            opacity: whatIfLoading ? 0.7 : 1,
          }}
        >
          {whatIfLoading ? "Loading…" : "Analyze"}
        </button>
      </div>

      <div style={{ height: 200 }}>
        {whatIfLoading ? <Sk h={200} /> : whatIfData ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={whatIfData.results}
              margin={{ top: 4, right: 10, bottom: 0, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="vary_value"
                tick={{ fontSize: 9.5, fill: "var(--muted)", fontFamily: "var(--mono)" }}
                axisLine={false} tickLine={false}
                tickFormatter={(v: number) => v.toFixed(1)}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 9.5, fill: "var(--muted)" }}
                axisLine={false} tickLine={false}
                tickFormatter={(v: number) => `${v}%`}
              />
              <Tooltip
                formatter={(v: number, name: string) => [`${Number(v).toFixed(1)}%`, name]}
                contentStyle={{
                  background: "#fff", border: "1px solid var(--border)",
                  borderRadius: 8, fontSize: 11, fontFamily: "var(--mono)",
                }}
              />
              <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} iconSize={7} iconType="circle" />
              <Line type="monotone" dataKey="dt_confidence" stroke={DT_COLOR} strokeWidth={2} dot={false} name="DT Confidence" />
              <Line type="monotone" dataKey="nb_confidence" stroke={NB_COLOR} strokeWidth={2} dot={false} name="NB Confidence" strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div style={{
            height: "100%", display: "flex", alignItems: "center",
            justifyContent: "center", color: "var(--muted)", fontSize: 12,
          }}>
            Pilih fitur dan klik Analyze untuk melihat What-If chart
          </div>
        )}
      </div>
    </div>
  );
};

// ── Decision Path panel ───────────────────────────────────────────────────────
const DecisionPathPanel: React.FC<{ nodes: DecisionPathNode[]; loading: boolean }> = ({ nodes, loading }) => (
  <div className="card">
    <div style={{
      fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const,
      letterSpacing: ".1em", color: "var(--muted)", marginBottom: 4,
    }}>Decision Path Highlighter</div>
    <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 14 }}>
      Jalur spesifik di pohon keputusan yang dilalui input ini
    </div>

    {loading ? <Sk h={120} /> : nodes.length === 0 ? (
      <div style={{ color: "var(--muted)", fontSize: 12 }}>Belum ada prediksi.</div>
    ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {nodes.map((node, i) => (
          <div key={node.node_id} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
              <div style={{
                width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                background: node.is_leaf ? DT_COLOR : "#E8F5EE",
                border: `1.5px solid ${node.is_leaf ? DT_COLOR : "var(--border)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 9, fontWeight: 700, color: node.is_leaf ? "#fff" : "var(--muted)",
                fontFamily: "var(--mono)",
              }}>
                {node.is_leaf ? "✓" : i + 1}
              </div>
              {i < nodes.length - 1 && (
                <div style={{ width: 1, height: 16, background: "var(--border)", marginTop: 2 }} />
              )}
            </div>

            <div style={{
              flex: 1, padding: "4px 10px", borderRadius: 6,
              background: node.is_leaf ? "#F0FAF4" : "var(--bg)",
              border: `1px solid ${node.is_leaf ? "#B7E4C7" : "var(--border)"}`,
              marginBottom: 2,
            }}>
              {node.is_leaf ? (
                <span style={{ fontSize: 12, fontWeight: 700, color: DT_COLOR }}>
                  Leaf → Prediksi: <span style={{ fontFamily: "var(--mono)" }}>{node.predicted_class}</span>
                  <span style={{ fontWeight: 400, color: "var(--muted)", marginLeft: 8, fontSize: 11 }}>
                    ({node.samples} samples, impurity {node.impurity})
                  </span>
                </span>
              ) : (
                <span style={{ fontSize: 11.5, color: "var(--text)" }}>
                  <span style={{ fontFamily: "var(--mono)", fontWeight: 600, color: "var(--text)" }}>
                    {node.feature}
                  </span>
                  {" "}{node.direction}{" "}
                  <span style={{ fontFamily: "var(--mono)", color: NB_COLOR }}>{node.threshold}</span>
                  <span style={{ color: "var(--muted)", marginLeft: 6, fontSize: 10.5 }}>
                    (input scaled: {node.input_value})
                  </span>
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

// ── Noise Curve panel ─────────────────────────────────────────────────────────
const NoiseCurvePanel: React.FC<{
  noiseCurve:       PredictResponse["noise_curve"];
  sensitivityScore: number;
  loading:          boolean;
}> = ({ noiseCurve, sensitivityScore, loading }) => (
  <div className="card">
    <div style={{
      fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const,
      letterSpacing: ".1em", color: "var(--muted)", marginBottom: 4,
    }}>Noise Sensitivity Meter</div>
    <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 8 }}>
      Stabilitas prediksi DT pada berbagai level noise (input spesifik ini)
    </div>

    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
      <div style={{
        fontFamily: "var(--mono)", fontSize: 28, fontWeight: 800,
        color: sensitivityScore >= 85 ? DT_COLOR : sensitivityScore >= 60 ? "#7C5208" : "#991B1B",
      }}>
        {sensitivityScore}%
      </div>
      <div style={{ fontSize: 11, color: "var(--muted)" }}>
        stability @ 10% noise<br />
        <span style={{ fontWeight: 600, color: sensitivityScore >= 85 ? DT_COLOR : "#991B1B" }}>
          {sensitivityScore >= 85 ? "Robust" : sensitivityScore >= 60 ? "Moderate" : "Fragile"}
        </span>
      </div>
    </div>

    <div style={{ height: 140 }}>
      {loading ? <Sk h={140} /> : (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={noiseCurve} margin={{ top: 4, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="noise"
              tick={{ fontSize: 9.5, fill: "var(--muted)", fontFamily: "var(--mono)" }}
              axisLine={false} tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 9.5, fill: "var(--muted)" }}
              axisLine={false} tickLine={false}
              tickFormatter={(v: number) => `${v}%`}
            />
            <Tooltip
              formatter={(v: number) => [`${Number(v).toFixed(1)}%`, "Stability"]}
              contentStyle={{
                background: "#fff", border: "1px solid var(--border)",
                borderRadius: 8, fontSize: 11, fontFamily: "var(--mono)",
              }}
            />
            <Line
              type="monotone" dataKey="stability" stroke={DT_COLOR}
              strokeWidth={2} dot={{ r: 3, fill: DT_COLOR, strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────
export const PredictionSection: React.FC<PredProps> = ({
  inputs, setInputs, edaData,
  predResult, predLoading,
  whatIfData, whatIfLoading, onFetchWhatIf,
  onDownloadReport,
}) => {
  const setF = (feat: string, val: number) => setInputs(p => ({ ...p, [feat]: val }));

  const features         = edaData ? Object.keys(edaData.feature_stats_selected) : [];
  const abbr             = edaData?.feature_abbr ?? {};
  const bs               = predResult?.baseline_stats ?? {};
  const isConsensus      = predResult?.consensus;
  const sensitivityScore = predResult?.sensitivity_score ?? 0;
  const noiseCurve       = predResult?.noise_curve ?? [];
  const pathNodes        = predResult?.decision_path?.nodes ?? [];

  // [FIX] Reset to Mean — pakai mean RAW dari scaler_params.mean_ atau feature_stats_raw_sel
  const handleResetToMean = () => {
    if (!edaData) return;
    const d: Record<string, number> = {};
    for (const feat of features) {
      const raw = getRawStats(edaData, feat);
      // raw.mean = scaler_params.mean_ = mean training original (nilai asli)
      d[feat] = raw ? parseFloat(raw.mean.toFixed(6)) : 0;
    }
    setInputs(() => d);
  };

  // [FIX] Randomize — pakai min/max RAW agar range bermakna
  const handleRandomize = () => {
    if (!edaData) return;
    const d: Record<string, number> = {};
    for (const feat of features) {
      const raw = getRawStats(edaData, feat);
      if (raw) {
        d[feat] = parseFloat(
          (Math.random() * (raw.max - raw.min) + raw.min).toFixed(4)
        );
      } else {
        d[feat] = 0;
      }
    }
    setInputs(() => d);
  };

  return (
    <SectionWrap>

      {/* OOD Warning */}
      {predResult?.ood_warning && (
        <div style={{
          background: "#FFFBEB", border: "1px solid #E8D9A0",
          borderRadius: 10, padding: "12px 18px",
          display: "flex", alignItems: "flex-start", gap: 12,
        }}>
          <span style={{ fontSize: 18 }}>⚠️</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#7C5208", marginBottom: 4 }}>
              Out-of-Distribution Warning
            </div>
            <div style={{ fontSize: 12, color: "#7C5208" }}>
              Beberapa fitur berada di luar rentang normal dataset (&gt;3σ).
              Hasil prediksi mungkin tidak akurat.
            </div>
            {predResult.ood_features.map(f => (
              <span key={f.feature} style={{
                display: "inline-block", marginRight: 6, marginTop: 6,
                fontSize: 11, fontFamily: "var(--mono)",
                background: "#FEF3C7", padding: "2px 8px", borderRadius: 4,
                color: "#7C5208", border: "1px solid #E8D9A0",
              }}>
                {/* [FIX] f.value_raw sesuai OodFeature v3.3.0 */}
                {f.abbr} = {f.value_raw} (z={f.z_score})
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="g73">
        {/* ── Left: results ─────────────────────────────────────── */}
        <div className="g1">

          {/* Model prediction cards */}
          <div className="g2">
            {([
              { label: "Decision Tree", key: "decision_tree" as const, color: DT_COLOR },
              { label: "Naive Bayes",   key: "naive_bayes"   as const, color: NB_COLOR },
            ]).map(({ label, key, color }) => (
              <div className="card" key={key} style={{ borderTop: `2px solid ${color}` }}>
                <div style={{
                  fontSize: 10, fontWeight: 700,
                  textTransform: "uppercase" as const,
                  letterSpacing: ".1em", color, marginBottom: 14,
                }}>{label}</div>

                {predLoading ? <Sk h={100} /> : (
                  <>
                    <div style={{
                      fontFamily: "var(--mono)", fontSize: 44, fontWeight: 800,
                      color, lineHeight: 1, letterSpacing: "-.03em", marginBottom: 10,
                    }}>
                      {predResult?.[key]?.prediction ?? "—"}
                    </div>

                    <div style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "3px 10px", borderRadius: 5,
                      background: "#F0FAF4", border: "1px solid #B7E4C7", marginBottom: 14,
                    }}>
                      <div style={{ width: 5, height: 5, borderRadius: "50%", background: color, flexShrink: 0 }} />
                      <span style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 600, color }}>
                        {predResult?.[key]?.confidence?.toFixed(1) ?? "—"}% conf
                      </span>
                    </div>

                    <div style={{
                      fontSize: 10, fontWeight: 700,
                      textTransform: "uppercase" as const,
                      letterSpacing: ".08em", color: "var(--muted)", marginBottom: 8,
                    }}>Probabilities</div>
                    <ProbBars probs={predResult?.[key]?.class_probabilities ?? {}} />
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Consensus + Robustness */}
          <div className="g2">
            <div className="card" style={{
              border: `1px solid ${isConsensus ? "#B7E4C7" : "#FECACA"}`,
              background: isConsensus ? "#F8FDF9" : "#FFF9F9",
            }}>
              {predLoading ? <Sk h={80} /> : (
                <div style={{
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  gap: 10, padding: "12px 0",
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: "50%",
                    background: isConsensus ? "#D1FAE5" : "#FEE2E2",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {isConsensus ? (
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                        <path d="M3.5 9.5L7 13L14.5 5.5" stroke="#1A3D2B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M4 4L12 12M12 4L4 12" stroke="#991B1B" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    )}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: isConsensus ? DT_COLOR : "#991B1B" }}>
                    {isConsensus ? "Verified Consensus" : "Conflicting Predictions"}
                  </div>
                  <div style={{
                    fontSize: 11, color: "var(--muted)", textAlign: "center",
                    padding: "0 8px", lineHeight: 1.5,
                  }}>
                    {predResult?.consensus_label ?? (isConsensus ? "Kedua model setuju" : "Model berbeda pendapat")}
                  </div>
                </div>
              )}
            </div>

            <div className="card">
              <div style={{
                fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const,
                letterSpacing: ".1em", color: "var(--muted)", marginBottom: 14,
              }}>Robustness</div>
              {predLoading ? <Sk h={80} /> : (
                <>
                  <div style={{
                    display: "flex", justifyContent: "space-between",
                    alignItems: "baseline", marginBottom: 8,
                  }}>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>Sensitivity Score</span>
                    <span style={{
                      fontFamily: "var(--mono)", fontSize: 13, fontWeight: 700,
                      color: sensitivityScore >= 85 ? DT_COLOR : "#991B1B",
                    }}>{sensitivityScore ?? "—"}%</span>
                  </div>
                  <div style={{
                    height: 5, borderRadius: 2,
                    background: "var(--bg)", overflow: "hidden", marginBottom: 10,
                  }}>
                    <div style={{
                      height: "100%", borderRadius: 2,
                      width: `${sensitivityScore}%`,
                      background: sensitivityScore >= 85 ? DT_COLOR : "#DC2626",
                      transition: "width .6s cubic-bezier(.4,0,.2,1)",
                    }} />
                  </div>
                  <div style={{ fontSize: 10.5, color: "var(--muted)" }}>
                    Monte Carlo 15x · std-based noise · per-input
                  </div>
                </>
              )}
            </div>
          </div>

          {/* SHAP bar */}
          <div className="card">
            <div style={{
              fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const,
              letterSpacing: ".1em", color: "var(--muted)", marginBottom: 4,
            }}>SHAP — Feature Contribution (Per-Sample)</div>
            <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 14 }}>
              Kontribusi setiap fitur terhadap prediksi spesifik ini (bukan global)
            </div>
            <div style={{ height: 190 }}>
              {predLoading ? <Sk h={190} /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={predResult?.xai_shap ?? []}
                    layout="vertical"
                    margin={{ top: 0, right: 60, bottom: 0, left: 0 }}
                  >
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="feature" type="category" width={52}
                      tick={{ fontSize: 10.5, fontFamily: "var(--mono)", fill: "var(--muted)" }}
                      axisLine={false} tickLine={false}
                    />
                    <Tooltip
                      formatter={(v: number) => [`${Number(v).toFixed(4)}`, "SHAP value"]}
                      contentStyle={{
                        background: "#fff", border: "1px solid var(--border)",
                        borderRadius: 8, fontSize: 11.5, fontFamily: "var(--mono)",
                      }}
                      cursor={{ fill: "var(--bg)" }}
                    />
                    <Bar
                      dataKey="abs_impact" fill={DT_COLOR}
                      radius={[0, 3, 3, 0]} maxBarSize={11}
                      label={{
                        position: "right", fontSize: 10,
                        fontFamily: "var(--mono)", fill: "var(--muted)",
                        formatter: (v: number) => v.toFixed(4),
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <DecisionPathPanel nodes={pathNodes} loading={predLoading} />
          <NoiseCurvePanel noiseCurve={noiseCurve} sensitivityScore={sensitivityScore} loading={predLoading} />
          <WhatIfPanel edaData={edaData} inputs={inputs} whatIfData={whatIfData} whatIfLoading={whatIfLoading} onFetch={onFetchWhatIf} />

          {/* Download Report */}
          {predResult && (
            <div className="card" style={{ background: "#F8FDF9", border: "1px solid #B7E4C7" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: DT_COLOR, marginBottom: 4 }}>
                    Academic Report
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                    Generate PDF formal: input, prediksi, decision path, SHAP, metrik model
                  </div>
                </div>
                <button
                  onClick={() => onDownloadReport(predResult.log_index)}
                  style={{
                    fontSize: 12, fontWeight: 600, padding: "8px 18px",
                    borderRadius: 7, border: "none",
                    background: DT_COLOR, color: "#fff",
                    cursor: "pointer", flexShrink: 0, marginLeft: 16,
                  }}
                >
                  ↓ Download PDF
                </button>
              </div>
              <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 8, fontFamily: "var(--mono)" }}>
                Log index: #{predResult.log_index} · {predResult.model_version}
              </div>
            </div>
          )}
        </div>

        {/* ── Right: input panel ─────────────────────────────────── */}
        <div className="card" style={{ height: "fit-content" }}>
          <div style={{
            fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const,
            letterSpacing: ".1em", color: "var(--muted)", marginBottom: 4,
          }}>Input Features</div>
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 16 }}>
            Masukkan nilai <strong>asli (raw)</strong> — scaling dilakukan otomatis oleh backend
          </div>

          <div style={{ maxHeight: 540, overflowY: "auto", paddingRight: 4 }}>
            {features.map(feat => {
              // [FIX] Kirim raw stats ke FeatureInput agar slider range bermakna
              const rawStats = getRawStats(edaData, feat);
              return (
                <FeatureInput
                  key={feat}
                  feat={feat}
                  abbr={abbr[feat] ?? feat}
                  value={inputs[feat] ?? 0}
                  onChange={v => setF(feat, v)}
                  // baseline_stats dari /predict adalah scaled — gunakan raw untuk slider
                  stats={rawStats ?? bs[feat] ?? edaData?.feature_stats_selected[feat]}
                />
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            {/* [FIX] Reset to Mean — pakai scaler_params.mean_ (mean training raw) */}
            <button
              onClick={handleResetToMean}
              style={{
                fontSize: 11.5, fontWeight: 600, padding: "6px 14px",
                borderRadius: 6, border: "1px solid var(--border)",
                background: "transparent", color: "var(--text)",
                cursor: "pointer",
              }}
            >
              Reset to Mean
            </button>

            {/* [FIX] Randomize — pakai min/max raw agar range realistis */}
            <button
              onClick={handleRandomize}
              style={{
                fontSize: 11.5, fontWeight: 600, padding: "6px 14px",
                borderRadius: 6, border: "1px solid var(--border)",
                background: "transparent", color: "var(--text)",
                cursor: "pointer",
              }}
            >
              Randomize
            </button>
          </div>

          {/* Info note tentang scaling */}
          <div style={{
            marginTop: 12, padding: "8px 10px",
            background: "rgba(45,106,79,.06)", borderRadius: 6,
            border: "1px solid rgba(45,106,79,.15)",
            fontSize: 10.5, color: "var(--muted)", lineHeight: 1.6,
          }}>
            <strong style={{ color: "#2D6A4F" }}>ℹ</strong>{" "}
            Nilai yang diinput adalah <strong>nilai asli</strong> (sebelum StandardScaler).
            Backend melakukan scaling otomatis sebelum prediksi.
          </div>
        </div>
      </div>
    </SectionWrap>
  );
};
