"use client";

import React from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Sk, SectionWrap } from "../UI";
import type { PerfResponse } from "../../app/page";

// FIX: ganti "any" dengan type yang benar dari page.tsx
interface StressProps {
  perfData: PerfResponse | null;
  loading:  boolean;
}

const DT_COLOR  = "#1A3D2B";
const NB_COLOR  = "#40916C";
const DT2_COLOR = "#74C69D";
const NB2_COLOR = "#95D5B2";

const Label = ({ children }: { children: React.ReactNode }) => (
  <div style={{
    fontSize: 10, fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: ".1em", color: "var(--muted)", marginBottom: 14,
  }}>{children}</div>
);

export const StressSection: React.FC<StressProps> = ({ perfData, loading }) => (
  <SectionWrap>

    {/* Info banner — FIX: deskripsi diupdate sesuai augmentasi v3.0 (std-based) */}
    <div style={{
      background: "var(--bg, #F8F9FA)", border: "1px solid var(--border)",
      borderRadius: 10, padding: "14px 18px",
      display: "flex", gap: 14, alignItems: "flex-start",
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 6, flexShrink: 0,
        background: "var(--border)",
        display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1,
      }}>
        <svg width={13} height={13} viewBox="0 0 24 24" fill="none"
          stroke="var(--muted)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
        </svg>
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", letterSpacing: "-.01em", marginBottom: 3 }}>
          Gaussian Noise Injection Lab
        </div>
        <div style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.7 }}>
          Model dievaluasi pada test set original + tambahan Gaussian noise berbagai level.{" "}
          <code style={{
            fontFamily: "var(--mono)", background: "rgba(0,0,0,.06)",
            padding: "1px 6px", borderRadius: 4, fontSize: 11, color: "var(--text-2)",
          }}>
            X_noisy = X + N(0, σ × std_col)
          </code>
          {" "}— test set original{" "}
          <strong style={{ color: "var(--text)", fontWeight: 600 }}>bebas noise</strong>.
          Augmentasi training menggunakan noise berbasis std per kolom (8% std).
        </div>
      </div>
    </div>

    {/* Params — FIX: nilai diupdate sesuai v3.0 */}
    <div className="g4">
      {[
        { l: "Noise Method",    v: "Std-based", d: "N(0, 8% × std_col)" },
        { l: "Multiplier",      v: "×2",        d: "Ukuran train jadi 2×" },
        { l: "Random Seed",     v: "42",        d: "Reproduksibilitas" },
        { l: "Scope",           v: "Train Only",d: "Test set bersih" },
      ].map(p => (
        <div key={p.l} style={{
          background: "#fff", border: "1px solid var(--border)",
          borderRadius: 10, padding: "16px 18px",
        }}>
          <div style={{
            fontSize: 9.5, color: "var(--muted)", fontWeight: 700,
            textTransform: "uppercase" as const, letterSpacing: ".1em", marginBottom: 8,
          }}>{p.l}</div>
          <div style={{
            fontFamily: "var(--mono)", fontSize: 20, fontWeight: 700,
            color: "var(--text)", lineHeight: 1, letterSpacing: "-.02em",
          }}>{p.v}</div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>{p.d}</div>
        </div>
      ))}
    </div>

    {/* Chart */}
    <div className="card">
      <Label>Akurasi vs Noise Level</Label>
      <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: -8, marginBottom: 16 }}>
        Semakin kecil degradasi, semakin robust model terhadap gangguan sensor
      </div>
      <div style={{ height: 280 }}>
        {loading ? <Sk h={280} /> : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={perfData?.stress_test ?? []}
              margin={{ top: 4, right: 20, bottom: 0, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="noise"
                tick={{ fontSize: 10.5, fill: "var(--muted)", fontFamily: "var(--mono)" }}
                axisLine={false} tickLine={false}
              />
              <YAxis
                domain={[50, 101]}
                tick={{ fontSize: 10, fill: "var(--muted)" }}
                axisLine={false} tickLine={false}
                tickFormatter={(v: number) => `${v}%`}
              />
              <Tooltip
                formatter={(v: number) => [`${Number(v).toFixed(2)}%`]}
                contentStyle={{
                  background: "#fff", border: "1px solid var(--border)",
                  borderRadius: 8, fontSize: 11.5,
                  boxShadow: "0 4px 16px rgba(0,0,0,.06)",
                  fontFamily: "var(--mono)",
                }}
                cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, color: "var(--muted)", paddingTop: 12 }}
                iconType="circle" iconSize={7}
              />
              <Line type="monotone" dataKey="dt_before" stroke={DT_COLOR}  strokeWidth={2} dot={{ r: 3, fill: DT_COLOR,  strokeWidth: 0 }} name="DT Before FS" />
              <Line type="monotone" dataKey="nb_before" stroke={NB_COLOR}  strokeWidth={2} dot={{ r: 3, fill: NB_COLOR,  strokeWidth: 0 }} name="NB Before FS" />
              <Line type="monotone" dataKey="dt_after"  stroke={DT2_COLOR} strokeWidth={2} dot={{ r: 3, fill: DT2_COLOR, strokeWidth: 0 }} strokeDasharray="5 3" name="DT After FS" />
              <Line type="monotone" dataKey="nb_after"  stroke={NB2_COLOR} strokeWidth={2} dot={{ r: 3, fill: NB2_COLOR, strokeWidth: 0 }} strokeDasharray="5 3" name="NB After FS" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>

    {/* Table */}
    <div className="card">
      <Label>Tabel Hasil Stress Test</Label>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {["Noise Level", "DT Before FS", "NB Before FS", "DT After FS", "NB After FS"].map((h, i) => (
              <th key={h} style={{
                fontSize: 10, fontWeight: 700,
                textTransform: "uppercase" as const, letterSpacing: ".08em",
                color: "var(--muted)", padding: "0 0 10px",
                textAlign: i === 0 ? "left" : "center",
                borderBottom: "1px solid var(--border)",
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(perfData?.stress_test ?? []).map(row => (
            <tr key={row.noise}>
              <td style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                <span style={{
                  fontFamily: "var(--mono)", fontSize: 11, fontWeight: 600,
                  color: "var(--text-2)", background: "var(--bg)",
                  padding: "2px 8px", borderRadius: 4,
                }}>{row.noise}</span>
              </td>
              {([row.dt_before, row.nb_before, row.dt_after, row.nb_after] as number[]).map((v, i) => (
                <td key={i} style={{
                  textAlign: "center", padding: "10px 0",
                  borderBottom: "1px solid var(--border)",
                }}>
                  <span style={{
                    fontFamily: "var(--mono)", fontSize: 11, fontWeight: 600,
                    color:      v >= 90 ? "#1A3D2B" : v >= 75 ? "#7C5208" : "#991B1B",
                    background: v >= 90 ? "#F0FAF4" : v >= 75 ? "#FFFBEB" : "#FEF2F2",
                    padding: "2px 8px", borderRadius: 4,
                  }}>{v?.toFixed(2)}%</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>

  </SectionWrap>
);
