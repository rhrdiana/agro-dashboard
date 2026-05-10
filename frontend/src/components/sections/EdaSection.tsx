"use client";

import React from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { Sk, SectionWrap } from "../UI";

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
  "Average of chlorophyll content of leaves": "Chloro",
  "Average wet weight of growth vegetative": "AWWGV",
  "Average dry weight of root": "ADWR",
  "Number of plant leaves": "NPL",
  "Dry matter of root growth": "DMRG",
};

interface EdaProps { edaData: any; loading: boolean; }

export const EdaSection: React.FC<EdaProps> = ({ edaData, loading }) => (
  <SectionWrap>
    <div className="g2">
      {/* Class distribution + Correlation matrix stacked */}
      <div className="card">
        <div className="card-title">Distribusi Kelas</div>
        <div className="card-subtitle">Original vs Augmented training set</div>
        {loading ? <Sk h={220} /> : (
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={Object.keys(edaData?.class_distribution?.original ?? {}).map(cls => ({
                class: cls,
                original: edaData.class_distribution.original[cls],
                augmented: edaData.class_distribution.augmented?.[cls] ?? 0,
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="class" tick={{ fontSize: 11.5, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10.5, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12, boxShadow: "var(--shadow-md)" }} />
                <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted)" }} />
                <Bar dataKey="original"  fill="#2D6A4F" radius={[4,4,0,0]} maxBarSize={20} name="Original" />
                <Bar dataKey="augmented" fill="#95D5B2" radius={[4,4,0,0]} maxBarSize={20} name="Augmented" opacity={.8} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Correlation matrix — stacked below the chart */}
        <div style={{ marginTop: 28, borderTop: "1px solid var(--border)", paddingTop: 20 }}>
          <div className="card-title">Matriks Korelasi — Fitur Terpilih</div>
          <div className="card-subtitle" style={{ marginBottom: 14 }}>Nilai mendekati ±1 menunjukkan korelasi kuat antar fitur</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", fontSize: 11.5, fontFamily: "var(--mono)" }}>
              <thead>
                <tr>
                  <th style={{ padding: "6px 10px", color: "var(--muted)", fontSize: 10, fontWeight: 600 }}></th>
                  {SELECTED_FEATURES.map(f => (
                    <th key={f} style={{ padding: "6px 12px", color: "var(--green)", fontSize: 10, fontWeight: 700 }}>{FEATURE_ABBR[f]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading
                  ? <tr><td colSpan={8}><Sk h={120} /></td></tr>
                  : (edaData?.correlation_matrix?.data ?? []).map((row: number[], i: number) => (
                    <tr key={i}>
                      <td style={{ padding: "6px 12px", color: "var(--green)", fontWeight: 700, fontSize: 10 }}>{FEATURE_ABBR[SELECTED_FEATURES[i]]}</td>
                      {row.map((v: number, j: number) => {
                        const abs = Math.abs(v);
                        const bg = v > 0.5
                          ? `rgba(45,106,79,${abs * 0.45})`
                          : v < -0.5 ? `rgba(217,95,95,${abs * 0.45})` : "transparent";
                        return (
                          <td key={j} style={{
                            padding: "9px 14px", textAlign: "center",
                            background: bg,
                            color: abs > 0.5 ? "#fff" : "var(--text-2)",
                            fontWeight: abs > 0.7 ? 700 : 400,
                            border: "1px solid var(--border)",
                            borderRadius: 4,
                            fontSize: 11,
                          }}>
                            {v.toFixed(2)}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* RFE Ranking */}
      <div className="card">
        <div className="card-title">RFE Feature Ranking</div>
        <div className="card-subtitle">Rank 1 = fitur terpilih oleh Recursive Feature Elimination</div>
        {loading ? <Sk h={220} /> : (
          <table className="tbl">
            <thead>
              <tr><th>Feature</th><th>Abbr</th><th>Rank</th><th>Status</th></tr>
            </thead>
            <tbody>
              {Object.entries(edaData?.rfe_ranking ?? {})
                .sort(([, a]: any, [, b]: any) => a - b)
                .map(([feat, rank]: [string, any]) => (
                  <tr key={feat}>
                    <td className="tbl-main">{feat}</td>
                    <td style={{ fontFamily: "var(--mono)", fontSize: 11.5 }}>{FEATURE_ABBR[feat] ?? "—"}</td>
                    <td style={{ fontFamily: "var(--mono)" }}>#{rank}</td>
                    <td>
                      <span className={`badge ${rank === 1 ? "badge-green" : "badge-gray"}`}>
                        {rank === 1 ? "Selected" : "Excluded"}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>
    </div>

    {/* Descriptive stats */}
    <div className="card">
      <div className="card-title">Statistik Deskriptif — 7 Fitur Terpilih</div>
      {loading ? <Sk h={200} /> : (
        <table className="tbl">
          <thead>
            <tr><th>Feature</th><th>Mean</th><th>Std</th><th>Min</th><th>Q25</th><th>Q75</th><th>Max</th></tr>
          </thead>
          <tbody>
            {Object.entries(edaData?.feature_stats_selected ?? {}).map(([feat, s]: [string, any]) => (
              <tr key={feat}>
                <td className="tbl-main">{feat}</td>
                <td style={{ fontFamily: "var(--mono)" }}>{s.mean}</td>
                <td style={{ fontFamily: "var(--mono)" }}>{s.std}</td>
                <td style={{ fontFamily: "var(--mono)" }}>{s.min}</td>
                <td style={{ fontFamily: "var(--mono)" }}>{s.q25}</td>
                <td style={{ fontFamily: "var(--mono)" }}>{s.q75}</td>
                <td style={{ fontFamily: "var(--mono)" }}>{s.max}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  </SectionWrap>
);
