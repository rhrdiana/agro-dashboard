"use client";

import React from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { KpiCard, MetricBox, Sk, SectionWrap } from "../UI";

interface OverviewProps {
  edaData: any;
  perfData: any;
  edaLoading: boolean;
  perfLoading: boolean;
}

const DT_COLOR = "#1A3D2B";
const NB_COLOR = "#40916C";

const Label = ({ children }: { children: React.ReactNode }) => (
  <div style={{
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: ".1em",
    color: "var(--muted)",
    marginBottom: 14,
  }}>{children}</div>
);

export const OverviewSection: React.FC<OverviewProps> = ({
  edaData, perfData, edaLoading, perfLoading,
}) => {
  const di = edaData?.dataset_info;

  const classDist = Object.keys(edaData?.class_distribution?.original ?? {}).map(cls => ({
    class: cls,
    original: edaData.class_distribution.original[cls],
    augmented: edaData.class_distribution.augmented?.[cls] ?? 0,
  }));

  return (
    <SectionWrap>

      {/* Header banner */}
      <div style={{
        background: DT_COLOR,
        borderRadius: 12,
        padding: "28px 32px",
        color: "#fff",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Subtle decorative ring */}
        <div style={{
          position: "absolute", right: -60, top: -60,
          width: 240, height: 240, borderRadius: "50%",
          border: "1px solid rgba(255,255,255,.07)",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", right: 30, bottom: -80,
          width: 180, height: 180, borderRadius: "50%",
          border: "1px solid rgba(255,255,255,.05)",
          pointerEvents: "none",
        }} />

        <div style={{
          display: "flex", alignItems: "flex-start",
          justifyContent: "space-between", position: "relative", gap: 24,
        }}>
          <div style={{ flex: 1, maxWidth: 520 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "3px 11px", borderRadius: 5,
              background: "rgba(255,255,255,.1)",
              fontSize: 10, fontWeight: 600, letterSpacing: ".08em",
              textTransform: "uppercase" as const,
              marginBottom: 16, color: "rgba(255,255,255,.75)",
            }}>
              <span style={{
                width: 5, height: 5, borderRadius: "50%",
                background: "#74C69D", display: "inline-block", flexShrink: 0,
              }} />
              Agricultural IoT · Gold Dataset
            </div>

            <h1 style={{
              fontSize: 20,
              fontWeight: 700,
              lineHeight: 1.3,
              marginBottom: 10,
              letterSpacing: "-.025em",
              color: "#fff",
            }}>
              Klasifikasi Tanaman Hidroponik<br />dengan Gaussian Noise
            </h1>

            <p style={{
              fontSize: 12.5,
              color: "rgba(255,255,255,.6)",
              lineHeight: 1.7,
              maxWidth: 440,
            }}>
              Decision Tree vs Naive Bayes — Recursive Feature Elimination (12→7 fitur),
              augmentasi noise Gaussian σ=20%
            </p>
          </div>

          <div style={{
            display: "flex", flexDirection: "column", gap: 6,
            flexShrink: 0,
          }}>
            {[
              { l: "Augmentasi",        v: "Gaussian σ=20%" },
              { l: "Feature Selection", v: "RFE 12→7" },
              { l: "Models",            v: "DT + NB" },
            ].map(p => (
              <div key={p.l} style={{
                background: "rgba(255,255,255,.08)",
                borderRadius: 7,
                padding: "8px 14px",
                minWidth: 155,
              }}>
                <div style={{
                  fontSize: 9.5, color: "rgba(255,255,255,.5)",
                  fontWeight: 600, textTransform: "uppercase" as const,
                  letterSpacing: ".08em", marginBottom: 3,
                }}>{p.l}</div>
                <div style={{
                  fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,.9)",
                  letterSpacing: "-.01em",
                }}>{p.v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="g4">
        {[
          { label: "Rows Original",     value: di?.total_rows_original?.toLocaleString(), sub: "data asli" },
          { label: "Train Augmented",   value: di?.total_train?.toLocaleString(),          sub: "setelah noise ×2" },
          { label: "Features After RFE",value: di?.total_features_after_fs,               sub: "dari 12 fitur" },
          { label: "Classes",           value: di?.num_classes,                            sub: "SA – TC" },
        ].map(k => (
          edaLoading
            ? <div key={k.label} className="kpi-card"><Sk h={70} /></div>
            : <KpiCard key={k.label} {...k} />
        ))}
      </div>

      {/* Model performance + class distribution */}
      <div className="g2">

        {/* Model perf */}
        <div className="g1">
          {[
            { title: "Decision Tree — After RFE", data: perfData?.metrics?.after_fs?.decision_tree, color: DT_COLOR },
            { title: "Naive Bayes — After RFE",   data: perfData?.metrics?.after_fs?.naive_bayes,   color: NB_COLOR },
          ].map(({ title, data, color }) => (
            <div className="card" key={title} style={{ borderTop: `2px solid ${color}` }}>
              <Label>{title}</Label>
              {perfLoading ? <Sk h={60} /> : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
                  {[
                    ["Accuracy",  data?.accuracy],
                    ["Precision", data?.precision],
                    ["Recall",    data?.recall],
                    ["F1",        data?.f1_score],
                  ].map(([l, v]) => (
                    <MetricBox key={String(l)} label={String(l)} value={v} color={color} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Class distribution */}
        <div className="card">
          <Label>Distribusi Kelas</Label>
          <div style={{
            fontSize: 11.5, color: "var(--muted)",
            marginTop: -8, marginBottom: 14,
          }}>Perbandingan data original vs augmented</div>
          {edaLoading ? <Sk h={200} /> : (
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={classDist} barGap={3}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="class"
                    tick={{ fontSize: 11, fill: "var(--muted)", fontFamily: "var(--mono)" }}
                    axisLine={false} tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "var(--muted)" }}
                    axisLine={false} tickLine={false}
                  />
                  <Tooltip
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
                  <Legend
                    wrapperStyle={{
                      fontSize: 11,
                      color: "var(--muted)",
                      paddingTop: 8,
                    }}
                  />
                  <Bar dataKey="original"  fill={DT_COLOR} radius={[3,3,0,0]} maxBarSize={16} name="Original" />
                  <Bar dataKey="augmented" fill="#95D5B2"  radius={[3,3,0,0]} maxBarSize={16} name="Augmented" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Methodology steps */}
      <div className="card">
        <Label>Metodologi — Split-Before-Augment</Label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
          {[
            { step: "01", title: "Split Original",        desc: "80% train / 20% test dari data asli — stratified per kelas" },
            { step: "02", title: "Augmentasi Train Only", desc: "Gaussian noise σ=20% × 2 multiplier — hanya pada training set" },
            { step: "03", title: "Evaluasi Test Original",desc: "Test set murni tanpa noise — validitas eksperimen terjaga" },
          ].map(s => (
            <div key={s.step} style={{
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "14px 16px",
            }}>
              <div style={{
                fontFamily: "var(--mono)",
                fontSize: 9.5,
                color: DT_COLOR,
                fontWeight: 700,
                letterSpacing: ".06em",
                marginBottom: 8,
              }}>Step {s.step}</div>
              <div style={{
                fontSize: 12.5,
                fontWeight: 700,
                color: "var(--text)",
                letterSpacing: "-.01em",
                marginBottom: 5,
              }}>{s.title}</div>
              <div style={{
                fontSize: 11.5,
                color: "var(--muted)",
                lineHeight: 1.65,
              }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

    </SectionWrap>
  );
};
