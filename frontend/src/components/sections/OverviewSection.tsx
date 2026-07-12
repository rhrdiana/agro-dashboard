"use client";

import React from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, Area, AreaChart,
} from "recharts";
import { KpiCard, MetricBox, Sk, SectionWrap } from "../UI";

// ─── Types (diselaraskan dengan page.tsx v3.3.0) ──────────────────────────────
import type { EdaResponse, PerfResponse } from "../../app/page";

interface OverviewProps {
  edaData:     EdaResponse | null;
  perfData:    PerfResponse | null;
  edaLoading:  boolean;
  perfLoading: boolean;
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const DT_COLOR = "#1A3D2B";
const NB_COLOR = "#52B788";
const ACCENT   = "#74C69D";

// ─── Sub-components ───────────────────────────────────────────────────────────
const Label = ({ children }: { children: React.ReactNode }) => (
  <p style={{
    fontSize: 10, fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: ".12em",
    color: "var(--muted)",
    marginBottom: 14,
  }}>{children}</p>
);

const CustomTooltip = ({ active, payload, label }: any) =>
  active && payload?.length ? (
    <div style={{
      background: "#fff",
      border: "1px solid var(--border)",
      borderRadius: 8,
      padding: "8px 12px",
      fontSize: 11.5,
      boxShadow: "0 4px 20px rgba(0,0,0,.07)",
      fontFamily: "var(--mono)",
    }}>
      <p style={{ fontWeight: 700, marginBottom: 4, color: "var(--text)" }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <strong>{p.value?.toLocaleString()}</strong>
        </p>
      ))}
    </div>
  ) : null;

// ─── Main component ───────────────────────────────────────────────────────────
export const OverviewSection: React.FC<OverviewProps> = ({
  edaData, perfData, edaLoading, perfLoading,
}) => {
  const di = edaData?.dataset_info;

  // [FIX-1] Struktur class_distribution v3.3.0:
  //   original_full_dataset  → seluruh dataset asli
  //   train_raw              → training set sebelum augmentasi
  //   train_augmented        → training set setelah augmentasi
  const classDist = Object.keys(
    edaData?.class_distribution?.original_full_dataset ?? {}
  ).map(cls => ({
    class:    cls,
    original: edaData!.class_distribution.original_full_dataset[cls] ?? 0,
    train:    edaData!.class_distribution.train_raw?.[cls]           ?? 0,
    augmented:edaData!.class_distribution.train_augmented?.[cls]     ?? 0,
  }));

  const dtMetrics = perfData?.metrics?.after_fs?.decision_tree;
  const nbMetrics = perfData?.metrics?.after_fs?.naive_bayes;

  // [FIX-2] Nilai sudah dalam % dari API — tidak perlu ×100
  const barData = [
    { metric: "Accuracy",  DT: +(dtMetrics?.accuracy  ?? 0).toFixed(1), NB: +(nbMetrics?.accuracy  ?? 0).toFixed(1) },
    { metric: "Precision", DT: +(dtMetrics?.precision  ?? 0).toFixed(1), NB: +(nbMetrics?.precision ?? 0).toFixed(1) },
    { metric: "Recall",    DT: +(dtMetrics?.recall     ?? 0).toFixed(1), NB: +(nbMetrics?.recall    ?? 0).toFixed(1) },
    { metric: "F1-Score",  DT: +(dtMetrics?.f1_score   ?? 0).toFixed(1), NB: +(nbMetrics?.f1_score  ?? 0).toFixed(1) },
  ];

  // [FIX-2] best params dari PerfResponse v3.3.0: best_dt_params_full & best_dt_params_sel
  const bestParamsSel  = perfData?.best_dt_params_sel  ?? {};
  const bestParamsFull = perfData?.best_dt_params_full ?? {};

  // Helper: format param object → singkat satu baris
  const formatParams = (p: Record<string, unknown>) =>
    Object.entries(p)
      .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v ?? "None"}`)
      .join(" · ");

  return (
    <SectionWrap>

      {/* ── Hero banner ──────────────────────────────────────────────────────── */}
      <div style={{
        borderRadius: 14,
        padding: "30px 34px",
        color: "#fff",
        position: "relative",
        overflow: "hidden",
        background: "linear-gradient(135deg, #0f2d1f 0%, #1A3D2B 45%, #1e3a4a 100%)",
        boxShadow: "0 8px 32px rgba(15,45,31,.35)",
      }}>
        {/* decorative blobs */}
        <div style={{
          position: "absolute", right: -50, top: -50,
          width: 260, height: 260, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(116,198,157,.12) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", left: "38%", bottom: -70,
          width: 200, height: 200, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(30,58,74,.5) 0%, transparent 80%)",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px), " +
            "linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          pointerEvents: "none",
        }} />

        <div style={{
          display: "flex", alignItems: "flex-start",
          justifyContent: "space-between", position: "relative",
          gap: 28, flexWrap: "wrap",
        }}>
          <div style={{ flex: 1, minWidth: 260, maxWidth: 520 }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "3px 11px", borderRadius: 5,
              background: "rgba(255,255,255,.09)",
              fontSize: 9.5, fontWeight: 700, letterSpacing: ".1em",
              textTransform: "uppercase" as const,
              marginBottom: 18, color: "rgba(255,255,255,.65)",
            }}>
              <span style={{
                width: 5, height: 5, borderRadius: "50%",
                background: ACCENT, display: "inline-block",
              }} />
              Agricultural IoT · Gold Dataset · v3.3.0
            </span>

            <h1 style={{
              fontSize: 21, fontWeight: 800,
              lineHeight: 1.25, marginBottom: 12,
              letterSpacing: "-.03em", color: "#fff",
            }}>
              Klasifikasi Tanaman Hidroponik<br />
              <span style={{ color: ACCENT }}>dengan Relative Gaussian Noise</span>
            </h1>

            <p style={{
              fontSize: 12, color: "rgba(255,255,255,.5)",
              lineHeight: 1.75, maxWidth: 620,
            }}>
              Dashboard ini membandingkan performa Decision Tree dan Naive Bayes dalam mengklasifikasikan 
              tanaman hidroponik — mulai dari seleksi fitur, augmentasi noise, hingga evaluasi akurasi model. 
            </p>
          </div>

          {/* info chips — [FIX-13] augmentasi diupdate ke formula relatif 5% */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
            {[
              { l: "Augmentasi",        v: "Relatif Noise 5%" },
              { l: "Feature Selection", v: "RFE 12 → 7" },
              { l: "Scaling",           v: "StandardScaler" },
              { l: "Models",            v: "DT + NB" },
            ].map(p => (
              <div key={p.l} style={{
                background: "rgba(255,255,255,.06)",
                border: "1px solid rgba(255,255,255,.09)",
                borderRadius: 8, padding: "8px 14px", minWidth: 170,
              }}>
                <div style={{
                  fontSize: 9, color: "rgba(255,255,255,.45)",
                  fontWeight: 700, textTransform: "uppercase" as const,
                  letterSpacing: ".09em", marginBottom: 3,
                }}>{p.l}</div>
                <div style={{
                  fontSize: 12.5, fontWeight: 600,
                  color: "rgba(255,255,255,.88)", letterSpacing: "-.01em",
                }}>{p.v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── KPI row ───────────────────────────────────────────────────────────── */}
      {/* [FIX-3] Pakai field yang tersedia di /eda dataset_info v3.3.0 */}
      <div className="g4">
        {[
          { label: "Rows Original",       value: di?.total_rows_original     ? Number(di.total_rows_original).toLocaleString()     : "—", sub: "data mentah asli" },
          { label: "Train Augmented",     value: di?.total_train_augmented   ? Number(di.total_train_augmented).toLocaleString()   : "—", sub: `×${di?.augmentation_multiplier ?? 2} setelah noise` },
          { label: "Features After RFE",  value: di?.total_features_after_fs ?? "—",                                                      sub: `dari ${di?.total_features_before_fs ?? 12} fitur` },
          { label: "Classes",             value: di?.num_classes             ?? "—",                                                      sub: "SA – TC" },
        ].map(k => (
          edaLoading
            ? <div key={k.label} className="kpi-card"><Sk h={70} /></div>
            : <KpiCard key={k.label} {...k} />
        ))}
      </div>

      {/* ── Model performance cards ───────────────────────────────────────────── */}
      <div className="g2">
        <div className="g1">
          {[
            { title: "Decision Tree — After RFE", data: dtMetrics, color: DT_COLOR },
            { title: "Naive Bayes — After RFE",   data: nbMetrics, color: NB_COLOR },
          ].map(({ title, data, color }) => (
            <div className="card" key={title} style={{ borderTop: `2px solid ${color}` }}>
              <Label>{title}</Label>
              {perfLoading ? <Sk h={60} /> : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
                  {/* [FIX-4] Nilai sudah % dari API, langsung render */}
                  {([ ["Accuracy", data?.accuracy], ["Precision", data?.precision],
                       ["Recall",  data?.recall],   ["F1",        data?.f1_score],
                  ] as [string, number | undefined][]).map(([l, v]) => (
                    <MetricBox key={l} label={l} value={v} color={color} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Grouped Bar Chart */}
        <div className="card">
          <Label>Model Comparison — After RFE</Label>
          <p style={{ fontSize: 11.5, color: "var(--muted)", marginTop: -8, marginBottom: 14 }}>
            Decision Tree vs Naive Bayes (% score)
          </p>
          {perfLoading ? <Sk h={220} /> : (
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} barGap={4} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="metric"
                    tick={{ fontSize: 11, fill: "var(--muted)", fontWeight: 600 }}
                    axisLine={false} tickLine={false}
                  />
                  {/* [FIX-5] Domain 95-101 agar perbedaan terlihat jika akurasi ~100% */}
                  <YAxis
                    domain={[95, 101]}
                    tick={{ fontSize: 10, fill: "var(--muted)" }}
                    axisLine={false} tickLine={false}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    content={<CustomTooltip />}
                    cursor={{ fill: "var(--bg)" }}
                    formatter={(v: any) => [`${v}%`]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, color: "var(--muted)", paddingTop: 6 }} />
                  <Bar dataKey="DT" name="Decision Tree" fill={DT_COLOR} radius={[4,4,0,0]} maxBarSize={18} />
                  <Bar dataKey="NB" name="Naive Bayes"   fill={NB_COLOR} radius={[4,4,0,0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* ── Class distribution charts ─────────────────────────────────────────── */}
      <div className="g2">
        <div className="card">
          <Label>Distribusi Kelas — Original vs Augmented</Label>
          <p style={{ fontSize: 11.5, color: "var(--muted)", marginTop: -8, marginBottom: 14 }}>
            {/* [FIX-1] Tampilkan 3 level: original_full_dataset, train_raw, train_augmented */}
            Full dataset vs Train Raw vs Train Augmented per kelas
          </p>
          {edaLoading ? <Sk h={190} /> : (
            <div style={{ height: 190 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={classDist} barGap={3} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="class"
                    tick={{ fontSize: 10.5, fill: "var(--muted)", fontFamily: "var(--mono)" }}
                    axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--bg)" }} />
                  <Legend wrapperStyle={{ fontSize: 11, color: "var(--muted)", paddingTop: 6 }} />
                  <Bar dataKey="original"  fill={DT_COLOR}   radius={[4,4,0,0]} maxBarSize={12} name="Original Full" />
                  <Bar dataKey="train"     fill="#2d6a4f"    radius={[4,4,0,0]} maxBarSize={12} name="Train Raw" />
                  <Bar dataKey="augmented" fill={ACCENT}     radius={[4,4,0,0]} maxBarSize={12} name="Train Augmented" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="card">
          <Label>Augmentation Uplift — Area</Label>
          <p style={{ fontSize: 11.5, color: "var(--muted)", marginTop: -8, marginBottom: 14 }}>
            Tren penambahan sampel: Train Raw → Augmented
          </p>
          {edaLoading ? <Sk h={190} /> : (
            <div style={{ height: 190 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={classDist}>
                  <defs>
                    <linearGradient id="gradTrain" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={DT_COLOR} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={DT_COLOR} stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="gradAug" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={NB_COLOR} stopOpacity={0.28} />
                      <stop offset="95%" stopColor={NB_COLOR} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="class"
                    tick={{ fontSize: 10.5, fill: "var(--muted)", fontFamily: "var(--mono)" }}
                    axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: "var(--border)" }} />
                  <Legend wrapperStyle={{ fontSize: 11, color: "var(--muted)", paddingTop: 6 }} />
                  <Area type="monotone" dataKey="train"
                    stroke={DT_COLOR} strokeWidth={2} fill="url(#gradTrain)"
                    name="Train Raw" dot={{ r: 3, fill: DT_COLOR }} />
                  <Area type="monotone" dataKey="augmented"
                    stroke={NB_COLOR} strokeWidth={2} fill="url(#gradAug)"
                    name="Train Augmented" dot={{ r: 3, fill: NB_COLOR }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* ── Best DT Params — [FIX-2] v3.3.0 pisah full vs sel ───────────────── */}
      {!perfLoading && (Object.keys(bestParamsSel).length > 0 || Object.keys(bestParamsFull).length > 0) && (
        <div className="g2">
          {[
            { title: "Best DT Params — Selected Features (After RFE)", params: bestParamsSel  },
            { title: "Best DT Params — Full Features (Before RFE)",    params: bestParamsFull },
          ].map(({ title, params }) => (
            <div className="card" key={title}>
              <Label>{title}</Label>
              <div style={{
                display: "flex", flexWrap: "wrap", gap: 6,
              }}>
                {Object.entries(params).map(([k, v]) => (
                  <span key={k} style={{
                    fontFamily: "var(--mono)",
                    fontSize: 10.5,
                    background: "var(--bg)",
                    border: "1px solid var(--border)",
                    borderRadius: 5,
                    padding: "3px 9px",
                    color: "var(--text)",
                  }}>
                    <span style={{ color: "var(--muted)", marginRight: 4 }}>
                      {k.replace(/_/g, " ")}
                    </span>
                    <strong>{String(v ?? "None")}</strong>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Methodology steps ─────────────────────────────────────────────────── */}
      <div className="card" style={{ padding: "20px 24px" }}>
        <Label>Metodologi — Split → Augment → Scale (v3.3.0)</Label>
        <div style={{ display: "flex", alignItems: "stretch", gap: 0 }}>
          {[
            {
              step: "01",
              title: "Split Original",
              desc:  "80% train / 20% test dari data asli — stratified per kelas, sebelum augmentasi atau scaling apapun.",
            },
            {
              step: "02",
              // [FIX-13] Formula diupdate ke noise relatif 5%, bukan 8% × std kolom
              title: "Augmentasi Train Only",
              desc:  "Relative Gaussian noise: X_noisy = X + X·N(0, 0.05) — ±5% dari nilai asli tiap elemen, multiplier ×2, hanya pada training set.",
            },
            {
              step: "03",
              // [FIX-12] StandardScaler diperkenalkan di v3.3.0
              title: "Scaling (StandardScaler)",
              desc:  "scaler.fit() pada training original (pre-augment) untuk hindari kontaminasi noise. scaler.transform() pada train augmented & test set.",
            },
            {
              step: "04",
              title: "GridSearchCV + Refit",
              desc:  "GridSearch CV=5 pada scaled original train. Model final di-refit pada scaled augmented train. Test set murni tanpa augmentasi.",
            },
          ].map((s, i) => (
            <React.Fragment key={s.step}>
              <div style={{
                flex: 1, display: "flex", flexDirection: "column", gap: 8,
                padding: "18px 16px", borderRadius: 10,
                background: "var(--bg)", border: "1px solid var(--border)",
              }}>
                <span style={{
                  fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700,
                  letterSpacing: ".12em", textTransform: "uppercase" as const,
                  color: "var(--muted)",
                }}>Step {s.step}</span>
                <div style={{
                  fontSize: 12.5, fontWeight: 700, letterSpacing: "-.02em",
                  color: "var(--text)", lineHeight: 1.3,
                }}>{s.title}</div>
                <div style={{ fontSize: 11, lineHeight: 1.7, color: "var(--muted)" }}>
                  {s.desc}
                </div>
              </div>
              {i < 3 && (
                <div style={{ display: "flex", alignItems: "center", padding: "0 6px", flexShrink: 0 }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2 7h10M8 3l4 4-4 4"
                      stroke="var(--border)" strokeWidth="1.5"
                      strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

    </SectionWrap>
  );
};
