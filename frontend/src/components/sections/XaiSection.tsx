"use client";

import React from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";
import { Sk, SectionWrap } from "../UI";
import type {
  PerfResponse,
  PredictResponse,
  DecisionPath,
  ShapItem,
  XaiGlobalItem,
} from "../../app/page";

interface XaiProps {
  perfData:       PerfResponse | null;
  predResult:     PredictResponse | null;
  perfLoading:    boolean;
  predLoading:    boolean;
  // v3.0 props
  decisionPath:   DecisionPath | null;
  xaiShap:        ShapItem[] | null;
  xaiGlobal:      XaiGlobalItem[] | null;
  consensusLabel: string | null;
}

const FEAT_COLORS = ["#2D6A4F", "#40916C", "#52B788", "#74C69D", "#95D5B2", "#B7E4C7", "#D8F3DC"];

export const XaiSection: React.FC<XaiProps> = ({
  perfData,
  predResult,
  perfLoading,
  predLoading,
  decisionPath,
  xaiShap,
  xaiGlobal,
  consensusLabel,
}) => (
  <SectionWrap>
    <div className="g2">
      {/* Feature Importance Bar */}
      <div className="card">
        <div className="card-title">Feature Importance — Decision Tree (After FS)</div>
        <div className="card-subtitle">Kontribusi global setiap fitur dalam pembentukan model</div>
        <div style={{ height: 270 }}>
          {perfLoading ? <Sk h={270} /> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[...(perfData?.feature_importance_dt ?? [])].sort((a: any, b: any) => b.importance - a.importance)}
                margin={{ top: 0, right: 10, bottom: 0, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="abbr" tick={{ fontSize: 11, fontFamily: "DM Mono", fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 10.5, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v: any) => `${Number(v).toFixed(2)}%`}
                  contentStyle={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12, boxShadow: "var(--shadow-md)" }}
                />
                <Bar dataKey="importance" radius={[5, 5, 0, 0]} maxBarSize={36}>
                  {(perfData?.feature_importance_dt ?? []).map((_: any, i: number) => (
                    <Cell key={i} fill={FEAT_COLORS[i % FEAT_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Radar — xaiGlobal (v3.0) or fallback to predResult.xai_contribution */}
      <div className="card">
        <div className="card-title">Radar — Kontribusi Instance Saat Ini</div>
        <div className="card-subtitle">Berdasarkan nilai input di Live Prediction</div>
        <div style={{ height: 270 }}>
          {predLoading ? <Sk h={270} /> : (
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={
                (xaiGlobal ?? (predResult as any)?.xai_contribution ?? []).map((x: any) => ({
                  subject: x.feature ?? x.abbr,
                  value:   x.importance,
                  fullMark: 100,
                }))
              }>
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9.5, fontFamily: "DM Mono", fill: "var(--muted)" }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9, fill: "var(--muted)" }} />
                <Radar name="Importance" dataKey="value" stroke="var(--green)" fill="var(--green)" fillOpacity={0.15} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>

    {/* SHAP Table (v3.0) */}
    {xaiShap && xaiShap.length > 0 && (
      <div className="card">
        <div className="card-title">SHAP — Per-Sample Feature Impact</div>
        <div className="card-subtitle">Kontribusi setiap fitur terhadap prediksi instance saat ini</div>
        <table className="tbl">
          <thead>
            <tr><th>#</th><th>Fitur</th><th>Nama Lengkap</th><th>SHAP Value</th><th>Arah</th><th>Abs Impact</th></tr>
          </thead>
          <tbody>
            {[...xaiShap].sort((a, b) => b.abs_impact - a.abs_impact).map((s, i) => (
              <tr key={s.feature}>
                <td style={{ color: "var(--muted)", fontFamily: "var(--mono)" }}>{i + 1}</td>
                <td><span className="badge badge-green" style={{ fontFamily: "var(--mono)" }}>{s.feature}</span></td>
                <td className="tbl-main">{s.full_name}</td>
                <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
                  <span style={{ color: s.direction === "positive" ? "var(--green)" : "#A32D2D" }}>
                    {s.shap_value >= 0 ? "+" : ""}{s.shap_value.toFixed(4)}
                  </span>
                </td>
                <td>
                  <span className={`badge ${s.direction === "positive" ? "badge-green" : "badge-red"}`}>
                    {s.direction === "positive" ? "▲ Positif" : "▼ Negatif"}
                  </span>
                </td>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 80, height: 5, background: "var(--border)", borderRadius: 999, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min(s.abs_impact * 100, 100)}%`, background: "var(--green)", borderRadius: 999 }} />
                    </div>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{s.abs_impact.toFixed(4)}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}

    {/* Decision Path (v3.0) */}
    {decisionPath && (
      <div className="card">
        <div className="card-title">Decision Path — Jalur Keputusan DT</div>
        <div className="card-subtitle">Node yang dilalui Decision Tree untuk input saat ini (panjang: {decisionPath.path_length})</div>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead>
              <tr><th>Node</th><th>Tipe</th><th>Fitur</th><th>Threshold</th><th>Input Value</th><th>Arah</th><th>Samples</th><th>Impurity</th></tr>
            </thead>
            <tbody>
              {decisionPath.nodes.map((node, i) => (
                <tr key={node.node_id}>
                  <td style={{ fontFamily: "var(--mono)", color: "var(--muted)" }}>{node.node_id}</td>
                  <td>
                    <span className={`badge ${node.is_leaf ? "badge-gold" : "badge-green"}`}>
                      {node.is_leaf ? "Leaf" : "Split"}
                    </span>
                  </td>
                  <td className="tbl-main">{node.feature ?? node.predicted_class ?? "—"}</td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{node.threshold != null ? node.threshold.toFixed(4) : "—"}</td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{node.input_value != null ? node.input_value.toFixed(4) : "—"}</td>
                  <td>{node.direction
                    ? <span className={`badge ${node.direction === "left" ? "badge-gray" : "badge-green"}`}>{node.direction}</span>
                    : "—"}
                  </td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{node.samples}</td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{node.impurity.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {decisionPath.tree_rules_excerpt && (
          <div style={{ background: "var(--bg)", borderRadius: 10, padding: "14px 16px", fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--muted)", lineHeight: 2, marginTop: 14, whiteSpace: "pre-wrap" }}>
            {decisionPath.tree_rules_excerpt}
          </div>
        )}
      </div>
    )}

    {/* Consensus Label (v3.0) */}
    {consensusLabel && (
      <div className="card" style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div className="card-title" style={{ margin: 0 }}>Consensus Status:</div>
        <span className={`badge ${consensusLabel.toLowerCase().includes("verified") ? "badge-green" : "badge-gold"}`} style={{ fontSize: 13, padding: "4px 14px" }}>
          {consensusLabel}
        </span>
      </div>
    )}

    {/* Feature Importance Table */}
    <div className="card">
      <div className="card-title">Tabel Feature Importance (DT, After FS)</div>
      <table className="tbl">
        <thead><tr><th>#</th><th>Fitur</th><th>Abbr</th><th>Importance</th><th>Rank</th></tr></thead>
        <tbody>
          {perfLoading
            ? <tr><td colSpan={5}><Sk h={100} /></td></tr>
            : [...(perfData?.feature_importance_dt ?? [])].sort((a: any, b: any) => b.importance - a.importance).map((f: any, i: number) => (
              <tr key={f.feature}>
                <td style={{ color: "var(--muted)", fontFamily: "var(--mono)" }}>{i + 1}</td>
                <td className="tbl-main">{f.feature}</td>
                <td><span className="badge badge-green" style={{ fontFamily: "var(--mono)" }}>{f.abbr}</span></td>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 80, height: 5, background: "var(--border)", borderRadius: 999, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min(f.importance, 100)}%`, background: "var(--green)", borderRadius: 999 }} />
                    </div>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{f.importance?.toFixed(2)}%</span>
                  </div>
                </td>
                <td>
                  <span className={`badge ${i === 0 ? "badge-green" : i < 3 ? "badge-gold" : "badge-gray"}`}>
                    #{i + 1}
                  </span>
                </td>
              </tr>
            ))
          }
        </tbody>
      </table>
    </div>

    {/* How it works */}
    <div className="g2">
      <div className="card">
        <div className="card-title" style={{ color: "#2D6A4F" }}>Decision Tree — Cara Kerja</div>
        <p style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.75, marginBottom: 14 }}>
          Decision Tree membuat keputusan berdasarkan aturan IF-THEN pada nilai fitur. Setiap node memilih fitur yang memaksimalkan <strong style={{ color: "var(--text)" }}>penurunan Gini impurity</strong>.
        </p>
        <div style={{ background: "var(--bg)", borderRadius: 10, padding: "14px 16px", fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted)", lineHeight: 2.1 }}>
          <span style={{ color: "var(--green)", fontWeight: 700 }}>IF</span> ARL ≤ threshold<br />
          &nbsp;&nbsp;<span style={{ color: "var(--green)", fontWeight: 700 }}>IF</span> ADWV ≤ threshold → <span style={{ color: "var(--green)" }}>Class SA</span><br />
          &nbsp;&nbsp;<span style={{ color: "var(--green)", fontWeight: 700 }}>ELSE</span> → <span style={{ color: "var(--green)" }}>Class SB</span><br />
          <span style={{ color: "var(--green)", fontWeight: 700 }}>ELSE</span> → <span style={{ color: "var(--green)" }}>Class SC/SD/SE</span>
        </div>
      </div>
      <div className="card">
        <div className="card-title" style={{ color: "#40916C" }}>Naive Bayes — Cara Kerja</div>
        <p style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.75, marginBottom: 14 }}>
          Naive Bayes menggunakan teorema Bayes dengan asumsi <strong style={{ color: "var(--text)" }}>independensi kondisional</strong> antar fitur, menghitung distribusi Gaussian per fitur.
        </p>
        <div style={{ background: "var(--bg)", borderRadius: 10, padding: "14px 16px", fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted)", lineHeight: 2.1 }}>
          P(y | x₁…x₇) ∝ P(y) × <span style={{ color: "#40916C" }}>∏</span> P(xᵢ | y)<br />
          P(xᵢ | y) = <span style={{ color: "#40916C" }}>N</span>(μᵧᵢ, σᵧᵢ²)<br />
          → argmax P(y | x)
        </div>
      </div>
    </div>
  </SectionWrap>
);
