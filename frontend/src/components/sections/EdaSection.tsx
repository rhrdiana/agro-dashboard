"use client";

import React, { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { Sk, SectionWrap } from "../UI";
import type { EdaResponse, FeatureStat } from "../../app/page";

// ─── Types ────────────────────────────────────────────────────────────────────
interface EdaProps {
  edaData: EdaResponse | null;
  loading: boolean;
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const C_SEL  = "#2D6A4F";
const C_AUG  = "#95D5B2";
const C_TRAIN = "#52B788";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const Label = ({ children }: { children: React.ReactNode }) => (
  <p style={{
    fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const,
    letterSpacing: ".12em", color: "var(--muted)", marginBottom: 10,
  }}>{children}</p>
);

const CustomTooltip = ({ active, payload, label }: any) =>
  active && payload?.length ? (
    <div style={{
      background: "#fff", border: "1px solid var(--border)",
      borderRadius: 8, padding: "8px 12px", fontSize: 11.5,
      boxShadow: "0 4px 20px rgba(0,0,0,.07)", fontFamily: "var(--mono)",
    }}>
      <p style={{ fontWeight: 700, marginBottom: 4, color: "var(--text)" }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <strong>{typeof p.value === "number" ? p.value.toFixed(4) : p.value}</strong>
        </p>
      ))}
    </div>
  ) : null;

// ─── Correlation cell colour ──────────────────────────────────────────────────
function corrCellStyle(v: number): React.CSSProperties {
  const abs = Math.abs(v);
  const bg =
    v >  0.5 ? `rgba(45,106,79,${abs * 0.45})`  :
    v < -0.5 ? `rgba(217,95,95,${abs * 0.45})`  : "transparent";
  return {
    padding: "8px 12px", textAlign: "center",
    background: bg,
    color: abs > 0.5 ? "#fff" : "var(--text)",
    fontWeight: abs > 0.7 ? 700 : 400,
    border: "1px solid var(--border)",
    fontSize: 10.5,
  };
}

// ─── Main component ───────────────────────────────────────────────────────────
export const EdaSection: React.FC<EdaProps> = ({ edaData, loading }) => {

  const [perClassFeature, setPerClassFeature] = useState<string>("");

  // [FIX] Ambil feature_abbr & correlation features dari API — bukan hardcoded
  const featureAbbr: Record<string, string> = edaData?.feature_abbr ?? {};
  const corrFeatures: string[]              = edaData?.correlation_matrix?.features ?? [];
  const corrData:     number[][]            = edaData?.correlation_matrix?.data     ?? [];

  // Abbr lookup terbalik: abbr → full name  (untuk label ringkas)
  const abbrOf = (col: string) => featureAbbr[col] ?? col;

  // [FIX-1] class_distribution v3.3.0 → 3 level
  const classDist = Object.keys(
    edaData?.class_distribution?.original_full_dataset ?? {}
  ).map(cls => ({
    class:    cls,
    original: edaData!.class_distribution.original_full_dataset[cls] ?? 0,
    train:    edaData!.class_distribution.train_raw?.[cls]           ?? 0,
    augmented:edaData!.class_distribution.train_augmented?.[cls]     ?? 0,
  }));

  // [ADD] feature_stats_raw_sel — nilai ASLI sebelum scaling (dari X_tr_raw_sel)
  // Ini yang ditampilkan di tabel statistik deskriptif agar mean/std bermakna
  // Sesuai Colab: nilai X_train sebelum scaler.fit()
  const statsRaw = (edaData as any)?.feature_stats_raw_sel as Record<string, FeatureStat> | undefined;

  // feature_stats_selected (scaled, mean≈0) — hanya dipakai sebagai referensi scaled space
  const statsSel = edaData?.feature_stats_selected ?? {};

  // scaler_params dari /eda — mean_ & scale_ untuk transparansi normalisasi
  const scalerParams = edaData?.scaler_params ?? {};

  // [FIX] per_class_stats dari /eda (scaled)
  const perClassStats = edaData?.per_class_stats ?? {};
  const classes       = Object.keys(perClassStats);

  // Pilihan default fitur untuk per-class chart
  const firstFeat = corrFeatures[0] ?? "";
  const activeFeat = perClassFeature || firstFeat;

  // Data per-class untuk fitur aktif
  const perClassChartData = classes.map(cls => ({
    class: cls,
    mean:  perClassStats[cls]?.[activeFeat]?.mean ?? 0,
    std:   perClassStats[cls]?.[activeFeat]?.std  ?? 0,
  }));

  return (
    <SectionWrap>

      {/* ── Row 1: Distribusi kelas + RFE ranking ─────────────────────────── */}
      <div className="g2">

        {/* Class distribution — [FIX-1] 3 level dari v3.3.0 */}
        <div className="card">
          <Label>Distribusi Kelas — 3 Level</Label>
          <p style={{ fontSize: 11.5, color: "var(--muted)", marginTop: -6, marginBottom: 14 }}>
            Original full dataset · Train raw · Train augmented
          </p>
          {loading ? <Sk h={210} /> : (
            <div style={{ height: 210 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={classDist} barGap={3} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="class"
                    tick={{ fontSize: 10.5, fill: "var(--muted)", fontFamily: "var(--mono)" }}
                    axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--bg)" }} />
                  <Legend wrapperStyle={{ fontSize: 11, color: "var(--muted)", paddingTop: 6 }} />
                  <Bar dataKey="original"  fill={C_SEL}   radius={[4,4,0,0]} maxBarSize={13} name="Original Full" />
                  <Bar dataKey="train"     fill={C_TRAIN}  radius={[4,4,0,0]} maxBarSize={13} name="Train Raw" />
                  <Bar dataKey="augmented" fill={C_AUG}   radius={[4,4,0,0]} maxBarSize={13} name="Train Augmented" opacity={.85} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* [FIX] Ringkasan angka */}
          {!loading && classDist.length > 0 && (
            <div style={{
              marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap",
            }}>
              {classDist.map(d => (
                <div key={d.class} style={{
                  flex: 1, minWidth: 80,
                  background: "var(--bg)", border: "1px solid var(--border)",
                  borderRadius: 8, padding: "8px 10px", textAlign: "center",
                }}>
                  <div style={{
                    fontFamily: "var(--mono)", fontSize: 10, fontWeight: 700,
                    color: C_SEL, marginBottom: 4,
                  }}>{d.class}</div>
                  <div style={{ fontSize: 10, color: "var(--muted)", lineHeight: 1.8 }}>
                    <span style={{ display: "block" }}>full: <strong>{d.original}</strong></span>
                    <span style={{ display: "block" }}>train: <strong>{d.train}</strong></span>
                    <span style={{ display: "block" }}>aug: <strong>{d.augmented}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RFE Ranking */}
        <div className="card">
          <Label>RFE Feature Ranking</Label>
          <p style={{ fontSize: 11.5, color: "var(--muted)", marginTop: -6, marginBottom: 14 }}>
            Rank 1 = dipilih oleh Recursive Feature Elimination (7 dari 12 fitur)
          </p>
          {loading ? <Sk h={260} /> : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Abbr</th>
                  <th>Rank</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(edaData?.rfe_ranking ?? {})
                  .sort(([, a], [, b]) => (a as number) - (b as number))
                  .map(([feat, rank]) => (
                    <tr key={feat}>
                      <td className="tbl-main" style={{ fontSize: 11 }}>{feat}</td>
                      <td style={{ fontFamily: "var(--mono)", fontSize: 11.5 }}>
                        {/* [FIX] Abbr dari API, bukan hardcoded */}
                        {abbrOf(feat)}
                      </td>
                      <td style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
                        #{String(rank)}
                      </td>
                      <td>
                        <span className={`badge ${(rank as number) === 1 ? "badge-green" : "badge-gray"}`}>
                          {(rank as number) === 1 ? "Selected" : "Excluded"}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Row 2: Statistik deskriptif RAW + scaler params ─────────────── */}
      <div className="g2">

        {/* [ADD] Descriptive stats — RAW space (X_tr_raw_sel, sebelum scaling) */}
        <div className="card">
          <Label>Statistik Deskriptif — 7 Fitur Terpilih (Nilai Asli)</Label>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "rgba(45,106,79,.07)", border: "1px solid rgba(45,106,79,.2)",
            borderRadius: 6, padding: "5px 10px", marginBottom: 14,
          }}>
            <span style={{ fontSize: 10, color: C_SEL, fontWeight: 700 }}>ℹ</span>
            <span style={{ fontSize: 10.5, color: "var(--muted)" }}>
              Nilai <strong>asli (raw)</strong> dari training set sebelum augmentasi &amp; scaling —
              sesuai dengan nilai yang masuk ke <code>scaler.fit()</code> di pipeline.
            </span>
          </div>
          {loading ? <Sk h={200} /> : statsRaw ? (
            <div style={{ overflowX: "auto" }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Feature</th>
                    <th>Abbr</th>
                    <th>Mean</th>
                    <th>Std</th>
                    <th>Min</th>
                    <th>Q25</th>
                    <th>Q75</th>
                    <th>Max</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(statsRaw).map(([feat, s]) => (
                    <tr key={feat}>
                      <td className="tbl-main" style={{ fontSize: 10.5 }}>{feat}</td>
                      <td style={{ fontFamily: "var(--mono)", fontSize: 11, color: C_SEL, fontWeight: 700 }}>
                        {abbrOf(feat)}
                      </td>
                      {(["mean","std","min","q25","q75","max"] as const).map(k => (
                        <td key={k} style={{ fontFamily: "var(--mono)", fontSize: 10.5 }}>
                          {typeof s[k] === "number" ? (s[k] as number).toFixed(4) : "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            /* Fallback: jika backend belum update, tampilkan scaled dengan keterangan */
            <div>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "rgba(180,83,9,.07)", border: "1px solid rgba(180,83,9,.2)",
                borderRadius: 6, padding: "5px 10px", marginBottom: 12,
              }}>
                <span style={{ fontSize: 10, color: "#B45309", fontWeight: 700 }}>⚠</span>
                <span style={{ fontSize: 10.5, color: "var(--muted)" }}>
                  <code>feature_stats_raw_sel</code> belum tersedia di backend.
                  Menampilkan nilai scaled (mean ≈ 0, std ≈ 1) sebagai fallback.
                  Update <code>main.py</code> dengan patch yang disediakan.
                </span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Feature</th><th>Abbr</th>
                      <th>Mean</th><th>Std</th><th>Min</th>
                      <th>Q25</th><th>Q75</th><th>Max</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(statsSel).map(([feat, s]) => (
                      <tr key={feat}>
                        <td className="tbl-main" style={{ fontSize: 10.5 }}>{feat}</td>
                        <td style={{ fontFamily: "var(--mono)", fontSize: 11, color: C_SEL, fontWeight: 700 }}>
                          {abbrOf(feat)}
                        </td>
                        {(["mean","std","min","q25","q75","max"] as const).map(k => (
                          <td key={k} style={{ fontFamily: "var(--mono)", fontSize: 10.5 }}>
                            {typeof s[k] === "number" ? (s[k] as number).toFixed(4) : "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* [FIX] Scaler params — mean_ = mean training raw */}
        <div className="card">
          <Label>Scaler Params — StandardScaler (Training Raw)</Label>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "rgba(45,106,79,.07)", border: "1px solid rgba(45,106,79,.2)",
            borderRadius: 6, padding: "5px 10px", marginBottom: 14,
          }}>
            <span style={{ fontSize: 10, color: C_SEL, fontWeight: 700 }}>ℹ</span>
            <span style={{ fontSize: 10.5, color: "var(--muted)" }}>
              <strong>mean_</strong> = rata-rata nilai asli training set sebelum augmentasi.{" "}
              <strong>scale_</strong> = std dev yang dipakai untuk normalisasi.
            </span>
          </div>
          {loading ? <Sk h={200} /> : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Abbr</th>
                  <th>mean_ (raw)</th>
                  <th>scale_ (std)</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(scalerParams).map(([feat, p]) => (
                  <tr key={feat}>
                    <td className="tbl-main" style={{ fontSize: 10.5 }}>{feat}</td>
                    <td style={{ fontFamily: "var(--mono)", fontSize: 11, color: C_SEL, fontWeight: 700 }}>
                      {abbrOf(feat)}
                    </td>
                    <td style={{ fontFamily: "var(--mono)", fontSize: 10.5 }}>
                      {(p as any).mean_?.toFixed(6) ?? "—"}
                    </td>
                    <td style={{ fontFamily: "var(--mono)", fontSize: 10.5 }}>
                      {(p as any).scale_?.toFixed(6) ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Row 3: Correlation matrix ──────────────────────────────────────── */}
      <div className="card">
        <Label>Matriks Korelasi — Fitur Terpilih (Scaled Training Set)</Label>
        <p style={{ fontSize: 11.5, color: "var(--muted)", marginTop: -6, marginBottom: 14 }}>
          Dihitung dari training set scaled saja — no data leakage.
          Nilai ±1 = korelasi sempurna · 0 = tidak berkorelasi.
          {edaData?.correlation_matrix?.source && (
            <span style={{ color: C_SEL, marginLeft: 6, fontStyle: "italic" }}>
              ({edaData.correlation_matrix.source})
            </span>
          )}
        </p>
        {loading ? <Sk h={200} /> : (
          <div style={{ overflowX: "auto" }}>
            <table style={{
              borderCollapse: "collapse",
              fontSize: 11, fontFamily: "var(--mono)",
              minWidth: "100%",
            }}>
              <thead>
                <tr>
                  <th style={{
                    padding: "6px 10px", color: "var(--muted)",
                    fontSize: 10, fontWeight: 600,
                  }}></th>
                  {corrFeatures.map(f => (
                    <th key={f} style={{
                      padding: "6px 12px", color: C_SEL,
                      fontSize: 10, fontWeight: 700,
                      whiteSpace: "nowrap",
                    }}>
                      {/* [FIX] Abbr dari API */}
                      {abbrOf(f)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {corrData.map((row, i) => (
                  <tr key={i}>
                    <td style={{
                      padding: "6px 12px", color: C_SEL,
                      fontWeight: 700, fontSize: 10,
                      whiteSpace: "nowrap",
                    }}>
                      {abbrOf(corrFeatures[i] ?? "")}
                    </td>
                    {row.map((v, j) => (
                      <td key={j} style={corrCellStyle(v)}>
                        {v.toFixed(2)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Row 4: Per-class stats (interactive) ──────────────────────────── */}
      {!loading && classes.length > 0 && corrFeatures.length > 0 && (
        <div className="card">
          <Label>Per-Class Statistics — Nilai Scaled per Fitur</Label>
          <p style={{ fontSize: 11.5, color: "var(--muted)", marginTop: -6, marginBottom: 14 }}>
            Statistik per kelas dihitung dari training set scaled — pilih fitur untuk visualisasi.
          </p>

          {/* Feature selector */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
            {corrFeatures.map(f => (
              <button
                key={f}
                onClick={() => setPerClassFeature(f)}
                style={{
                  padding: "4px 10px", borderRadius: 6, fontSize: 10.5,
                  fontFamily: "var(--mono)", fontWeight: 600, cursor: "pointer",
                  border: "1px solid",
                  borderColor: activeFeat === f ? C_SEL : "var(--border)",
                  background:  activeFeat === f ? C_SEL : "var(--bg)",
                  color:       activeFeat === f ? "#fff" : "var(--muted)",
                  transition:  "all .15s",
                }}
              >
                {abbrOf(f)}
              </button>
            ))}
          </div>

          <div className="g2" style={{ alignItems: "flex-start" }}>
            {/* Bar chart: mean per kelas */}
            <div>
              <p style={{ fontSize: 10.5, color: "var(--muted)", marginBottom: 8 }}>
                Mean per kelas — <strong style={{ color: C_SEL }}>{abbrOf(activeFeat)}</strong> (scaled)
              </p>
              <div style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={perClassChartData} barCategoryGap="35%">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="class"
                      tick={{ fontSize: 10.5, fill: "var(--muted)", fontFamily: "var(--mono)" }}
                      axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--bg)" }} />
                    <Bar dataKey="mean" fill={C_SEL} radius={[4,4,0,0]} maxBarSize={30} name="Mean (scaled)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Table: full per-class stats */}
            <div style={{ overflowX: "auto" }}>
              <p style={{ fontSize: 10.5, color: "var(--muted)", marginBottom: 8 }}>
                Detail per kelas — <strong style={{ color: C_SEL }}>{abbrOf(activeFeat)}</strong>
              </p>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Class</th>
                    <th>Mean</th>
                    <th>Std</th>
                    <th>Min</th>
                    <th>Max</th>
                  </tr>
                </thead>
                <tbody>
                  {classes.map(cls => {
                    const s = perClassStats[cls]?.[activeFeat];
                    return (
                      <tr key={cls}>
                        <td style={{ fontFamily: "var(--mono)", fontWeight: 700, color: C_SEL }}>
                          {cls}
                        </td>
                        {(["mean","std","min","max"] as const).map(k => (
                          <td key={k} style={{ fontFamily: "var(--mono)", fontSize: 10.5 }}>
                            {s?.[k] !== undefined ? (s[k] as number).toFixed(4) : "—"}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </SectionWrap>
  );
};
