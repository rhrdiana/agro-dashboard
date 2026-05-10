"use client";

import React from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { FeatureInput, ProbBars, Sk, SectionWrap } from "../UI";

const SELECTED_FEATURES = [
  "Plant height rate (PHR)",
  "Average leaf area of the plant (ALAP)",
  "Percentage of dry matter for vegetative growth (PDMVG)",
  "Average root diameter (ARD)",
  "Average wet weight of the root (AWWR)",
  "Average dry weight of vegetative plants (ADWV)",
  "Average root length (ARL)",
];

const FEATURE_ABBR: Record<string, string> = {
  "Plant height rate (PHR)": "PHR",
  "Average leaf area of the plant (ALAP)": "ALAP",
  "Percentage of dry matter for vegetative growth (PDMVG)": "PDMVG",
  "Average root diameter (ARD)": "ARD",
  "Average wet weight of the root (AWWR)": "AWWR",
  "Average dry weight of vegetative plants (ADWV)": "ADWV",
  "Average root length (ARL)": "ARL",
};

const FEATURE_DEFAULTS: Record<string, number> = {
  "Plant height rate (PHR)": 45.0,
  "Average leaf area of the plant (ALAP)": 30.0,
  "Percentage of dry matter for vegetative growth (PDMVG)": 15.0,
  "Average root diameter (ARD)": 5.0,
  "Average wet weight of the root (AWWR)": 20.0,
  "Average dry weight of vegetative plants (ADWV)": 10.0,
  "Average root length (ARL)": 25.0,
};

const DT_COLOR = "#1A3D2B";
const NB_COLOR = "#40916C";

interface PredProps {
  inputs: Record<string, number>;
  setInputs: (fn: (p: Record<string, number>) => Record<string, number>) => void;
  predResult: any;
  predLoading: boolean;
  addNoise: boolean;
  setAddNoise: (v: boolean) => void;
  noiseLevel: number;
  setNoiseLevel: (v: number) => void;
}

export const PredictionSection: React.FC<PredProps> = ({
  inputs, setInputs, predResult, predLoading,
  addNoise, setAddNoise, noiseLevel, setNoiseLevel,
}) => {
  const setF = (feat: string, val: number) => setInputs(p => ({ ...p, [feat]: val }));
  const bs = predResult?.baseline_stats ?? {};
  const isConsensus = predResult?.consensus;
  const sensitivityScore = predResult?.sensitivity_score ?? 0;

  return (
    <SectionWrap>

      {/* Noise toggle */}
      <div style={{
        background: addNoise ? "#FDFAF3" : "var(--card, #fff)",
        border: `1px solid ${addNoise ? "#E8D9A0" : "var(--border)"}`,
        borderRadius: 10,
        padding: "14px 20px",
        display: "flex",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
        transition: "background .2s, border-color .2s",
      }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{
            fontSize: 12.5,
            fontWeight: 700,
            color: addNoise ? "#7C5208" : "var(--text)",
            letterSpacing: "-.01em",
          }}>Simulasi Noise pada Input</div>
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
            Aktifkan untuk melihat ketahanan model terhadap gangguan sensor
          </div>
        </div>

        {addNoise && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 180 }}>
            <span style={{
              fontSize: 10.5,
              color: "var(--muted)",
              fontFamily: "var(--mono)",
              flexShrink: 0,
            }}>
              σ = {(noiseLevel * 100).toFixed(0)}%
            </span>
            <input
              type="range" min={1} max={50} step={1}
              value={noiseLevel * 100}
              onChange={e => setNoiseLevel(parseInt(e.target.value) / 100)}
              style={{ flex: 1 }}
            />
          </div>
        )}

        {predResult?.ood_warning && (
          <span style={{
            fontSize: 10.5,
            fontWeight: 600,
            color: "#7C5208",
            background: "#FEF3C7",
            border: "1px solid #E8D9A0",
            padding: "3px 10px",
            borderRadius: 5,
            letterSpacing: ".02em",
          }}>Out-of-Distribution</span>
        )}

        {/* Toggle switch */}
        <button
          onClick={() => setAddNoise(!addNoise)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            flexShrink: 0,
          }}
        >
          <div style={{
            width: 36,
            height: 20,
            borderRadius: 10,
            background: addNoise ? DT_COLOR : "var(--border)",
            position: "relative",
            transition: "background .2s",
            flexShrink: 0,
          }}>
            <div style={{
              position: "absolute",
              top: 3,
              left: addNoise ? 19 : 3,
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: "#fff",
              transition: "left .2s",
              boxShadow: "0 1px 3px rgba(0,0,0,.2)",
            }} />
          </div>
          <span style={{
            fontSize: 11.5,
            fontWeight: 600,
            color: addNoise ? "#7C5208" : "var(--muted)",
            letterSpacing: ".01em",
          }}>
            {addNoise ? "Noise ON" : "Noise OFF"}
          </span>
        </button>
      </div>

      <div className="g73">
        {/* Left: results */}
        <div className="g1">

          {/* Model prediction cards */}
          <div className="g2">
            {[
              { label: "Decision Tree", key: "decision_tree", color: DT_COLOR },
              { label: "Naive Bayes",   key: "naive_bayes",   color: NB_COLOR },
            ].map(({ label, key, color }) => (
              <div className="card" key={key} style={{ borderTop: `2px solid ${color}` }}>
                <div style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: ".1em",
                  color,
                  marginBottom: 14,
                }}>{label}</div>

                {predLoading ? <Sk h={100} /> : (
                  <>
                    <div style={{
                      fontFamily: "var(--mono)",
                      fontSize: 44,
                      fontWeight: 800,
                      color,
                      lineHeight: 1,
                      letterSpacing: "-.03em",
                      marginBottom: 10,
                    }}>
                      {predResult?.[key]?.prediction ?? "—"}
                    </div>

                    <div style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "3px 10px",
                      borderRadius: 5,
                      background: "#F0FAF4",
                      border: "1px solid #B7E4C7",
                      marginBottom: 14,
                    }}>
                      <div style={{
                        width: 5, height: 5, borderRadius: "50%",
                        background: color, flexShrink: 0,
                      }} />
                      <span style={{
                        fontFamily: "var(--mono)",
                        fontSize: 11,
                        fontWeight: 600,
                        color,
                      }}>
                        {predResult?.[key]?.confidence?.toFixed(1) ?? "—"}% conf
                      </span>
                    </div>

                    <div style={{
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: ".08em",
                      color: "var(--muted)",
                      marginBottom: 8,
                    }}>Probabilities</div>
                    <ProbBars probs={predResult?.[key]?.class_probabilities ?? {}} />
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Consensus + Robustness */}
          <div className="g2">

            {/* Consensus */}
            <div className="card" style={{
              border: `1px solid ${isConsensus ? "#B7E4C7" : "#FECACA"}`,
              background: isConsensus ? "#F8FDF9" : "#FFF9F9",
            }}>
              {predLoading ? <Sk h={80} /> : (
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  padding: "12px 0",
                }}>
                  {/* Icon */}
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: isConsensus ? "#D1FAE5" : "#FEE2E2",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}>
                    {isConsensus ? (
                      /* Checkmark SVG */
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                        <path d="M3.5 9.5L7 13L14.5 5.5" stroke="#1A3D2B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      /* X SVG */
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M4 4L12 12M12 4L4 12" stroke="#991B1B" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    )}
                  </div>

                  <div style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: isConsensus ? DT_COLOR : "#991B1B",
                    letterSpacing: "-.01em",
                  }}>
                    {isConsensus ? "Consensus" : "Disagreement"}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)", textAlign: "center" }}>
                    {isConsensus ? "Kedua model setuju" : "Model berbeda pendapat"}
                  </div>
                </div>
              )}
            </div>

            {/* Robustness */}
            <div className="card">
              <div style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: ".1em",
                color: "var(--muted)",
                marginBottom: 14,
              }}>Robustness</div>

              {predLoading ? <Sk h={80} /> : (
                <>
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    marginBottom: 8,
                  }}>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>Sensitivity Score</span>
                    <span style={{
                      fontFamily: "var(--mono)",
                      fontSize: 13,
                      fontWeight: 700,
                      color: sensitivityScore >= 85 ? DT_COLOR : "#991B1B",
                    }}>
                      {sensitivityScore ?? "—"}%
                    </span>
                  </div>

                  <div style={{
                    height: 5,
                    borderRadius: 2,
                    background: "var(--bg)",
                    overflow: "hidden",
                    marginBottom: 10,
                  }}>
                    <div style={{
                      height: "100%",
                      borderRadius: 2,
                      width: `${sensitivityScore}%`,
                      background: sensitivityScore >= 85 ? DT_COLOR : "#DC2626",
                      transition: "width .6s cubic-bezier(.4,0,.2,1)",
                    }} />
                  </div>

                  <div style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: ".01em" }}>
                    Monte Carlo 20x @ 5% noise
                  </div>
                </>
              )}
            </div>
          </div>

          {/* XAI bar */}
          <div className="card">
            <div style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: ".1em",
              color: "var(--muted)",
              marginBottom: 14,
            }}>XAI — Feature Contribution (Instance)</div>
            <div style={{ height: 190 }}>
              {predLoading ? <Sk h={190} /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={predResult?.xai_contribution ?? []}
                    layout="vertical"
                    margin={{ top: 0, right: 52, bottom: 0, left: 0 }}
                  >
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="feature" type="category" width={52}
                      tick={{ fontSize: 10.5, fontFamily: "DM Mono", fill: "var(--muted)" }}
                      axisLine={false} tickLine={false}
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
                    <Bar
                      dataKey="importance"
                      fill={DT_COLOR}
                      radius={[0, 3, 3, 0]}
                      maxBarSize={11}
                      label={{
                        position: "right",
                        fontSize: 10,
                        fontFamily: "DM Mono",
                        fill: "var(--muted)",
                        formatter: (v: any) => `${Number(v).toFixed(1)}%`,
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* Right: input panel */}
        <div className="card" style={{ height: "fit-content" }}>
          <div style={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: ".1em",
            color: "var(--muted)",
            marginBottom: 4,
          }}>Input Features</div>
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 16 }}>
            Ubah nilai fitur — prediksi diperbarui otomatis
          </div>

          <div style={{ maxHeight: 520, overflowY: "auto", paddingRight: 4 }}>
            {SELECTED_FEATURES.map(feat => (
              <FeatureInput
                key={feat}
                feat={feat}
                abbr={FEATURE_ABBR[feat]}
                value={inputs[feat] ?? 0}
                onChange={v => setF(feat, v)}
                stats={bs[feat]}
              />
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                const d: Record<string, number> = {};
                SELECTED_FEATURES.forEach(f => d[f] = FEATURE_DEFAULTS[f]);
                setInputs(p => ({ ...p, ...d }));
              }}
              style={{
                fontSize: 11.5,
                fontWeight: 600,
                padding: "6px 14px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text-2)",
                cursor: "pointer",
                letterSpacing: ".01em",
              }}
            >
              Reset
            </button>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                const d: Record<string, number> = {};
                SELECTED_FEATURES.forEach(f => d[f] = parseFloat((Math.random() * 80 + 5).toFixed(2)));
                setInputs(p => ({ ...p, ...d }));
              }}
              style={{
                fontSize: 11.5,
                fontWeight: 600,
                padding: "6px 14px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text-2)",
                cursor: "pointer",
                letterSpacing: ".01em",
              }}
            >
              Randomize
            </button>
          </div>
        </div>
      </div>
    </SectionWrap>
  );
};
