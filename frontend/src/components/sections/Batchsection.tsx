"use client";

import React, { useState, useRef, useCallback } from "react";
import axios from "axios";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BatchRowResult {
  row_index:     number;
  PHR:           number;
  ALAP:          number;
  PDMVG:         number;
  ARD:           number;
  AWWR:          number;
  ADWV:          number;
  ARL:           number;
  dt_prediction: string;
  dt_confidence: number;
  nb_prediction: string;
  nb_confidence: number;
  consensus:     boolean;
  ood_warning:   boolean;
  ood_features:  string;
  true_label?:   string;
  [key: string]: unknown;
}

interface BatchSummary {
  class_distribution: Record<string, number>;
  consensus_rate_pct: number;
  ood_rows:           number;
  ood_pct:            number;
}

interface BatchResponse {
  batch_id:   string;
  total_rows: number;
  results:    BatchRowResult[];
  summary:    BatchSummary;
}

interface ConfusionData {
  labels:          string[];
  dt_matrix:       number[][];
  nb_matrix:       number[][];
  has_true_labels: boolean;
  // inter-model agreement
  agreement_matrix: number[][];
  agreement_labels: string[];
  // self-prediction matrices (always available — DT pred vs DT pred, NB vs NB)
  dt_self_matrix:   number[][];
  nb_self_matrix:   number[][];
}

interface BatchSectionProps {
  apiBase: string;
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bg:          "#F7F8F5",
  surface:     "#FFFFFF",
  surfaceAlt:  "#F2F4EF",
  border:      "#E0E6DA",
  borderFocus: "#2D6A4F",
  text:        "#1A2016",
  text2:       "#4A5544",
  muted:       "#8A9885",
  green:       "#2D6A4F",
  greenPale:   "#D8F3DC",
  greenXpale:  "#F0FAF2",
  gold:        "#E9A43A",
  goldPale:    "#FDF3E1",
  red:         "#D95F5F",
  redPale:     "#FDEAEA",
  blue:        "#3A7BD5",
  bluePale:    "#EBF2FD",
  radius:      "10px",
  radiusLg:    "14px",
  mono:        "'DM Mono', 'Fira Mono', monospace",
  sans:        "'Plus Jakarta Sans', sans-serif",
};

// ─── Palette untuk class badge ────────────────────────────────────────────────
function getClassStyle(cls: string) {
  const palette = [
    { bg: "#EAF3DE", text: "#2D5A0E", border: "#639922" },
    { bg: "#E6F1FB", text: "#185FA5", border: "#378ADD" },
    { bg: "#EEEDFE", text: "#3C3489", border: "#7F77DD" },
    { bg: "#FAEEDA", text: "#854F0B", border: "#EF9F27" },
    { bg: "#E1F5EE", text: "#0F6E56", border: "#1D9E75" },
    { bg: "#FBEAF0", text: "#72243E", border: "#D4537E" },
  ];
  let hash = 0;
  for (let i = 0; i < cls.length; i++)
    hash = (hash * 31 + cls.charCodeAt(i)) & 0xffff;
  return palette[hash % palette.length];
}

function getClassColor(cls: string): string {
  const colors = ["#378ADD","#1D9E75","#7F77DD","#EF9F27","#D4537E","#D85A30","#639922","#185FA5"];
  let hash = 0;
  for (let i = 0; i < cls.length; i++)
    hash = (hash * 31 + cls.charCodeAt(i)) & 0xffff;
  return colors[hash % colors.length];
}

// ─── Icons ────────────────────────────────────────────────────────────────────
const IconUpload = () => (
  <svg width={28} height={28} viewBox="0 0 24 24" fill="none"
    stroke={T.muted} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/>
    <line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
);

const IconInfo = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none"
    stroke={T.blue} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

const IconDownload = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

const IconCheck = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none"
    stroke="#1D9E75" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const IconWarn = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none"
    stroke="#E9A43A" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

const IconRadar = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none"
    stroke="#D85A30" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0"/>
    <path d="M12 12m-6 0a6 6 0 1 0 12 0a6 6 0 1 0-12 0"/>
    <path d="M12 12m-10 0a10 10 0 1 0 20 0a10 10 0 1 0-20 0"/>
    <line x1="12" y1="2" x2="12" y2="4"/>
  </svg>
);

const IconLoader = () => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={2} strokeLinecap="round"
    style={{ animation: "spin 1s linear infinite" }}>
    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
  </svg>
);

const IconAlert = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

const IconChevLeft = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);

const IconChevRight = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

// ─── Compute confusion data from results ──────────────────────────────────────
function computeConfusionData(results: BatchRowResult[]): ConfusionData {
  const dtClasses  = Array.from(new Set(results.map(r => r.dt_prediction))).sort();
  const nbClasses  = Array.from(new Set(results.map(r => r.nb_prediction))).sort();
  const allClasses = Array.from(new Set([...dtClasses, ...nbClasses])).sort();

  const hasTrueLabels = results.some(r => r.true_label && r.true_label.trim() !== "");
  const trueClasses   = hasTrueLabels
    ? Array.from(new Set(results.map(r => r.true_label || "").filter(Boolean))).sort()
    : [];
  const labels = hasTrueLabels
    ? Array.from(new Set([...allClasses, ...trueClasses])).sort()
    : allClasses;

  const n   = labels.length;
  const idx = (cls: string) => labels.indexOf(cls);

  // Confusion matrix vs true labels (only if available)
  const dtMatrix = Array.from({ length: n }, () => new Array(n).fill(0));
  const nbMatrix = Array.from({ length: n }, () => new Array(n).fill(0));
  if (hasTrueLabels) {
    results.forEach(r => {
      if (!r.true_label) return;
      const ti = idx(r.true_label);
      const di = idx(r.dt_prediction);
      const ni = idx(r.nb_prediction);
      if (ti >= 0 && di >= 0) dtMatrix[ti][di]++;
      if (ti >= 0 && ni >= 0) nbMatrix[ti][ni]++;
    });
  }

  // Inter-model agreement matrix
  const agreeMatrix = Array.from({ length: n }, () => new Array(n).fill(0));
  results.forEach(r => {
    const di = idx(r.dt_prediction);
    const ni = idx(r.nb_prediction);
    if (di >= 0 && ni >= 0) agreeMatrix[di][ni]++;
  });

  // Self-prediction distribution matrices (always available)
  // DT self: diagonal = count of each DT prediction class
  const dtSelfMatrix = Array.from({ length: n }, () => new Array(n).fill(0));
  const nbSelfMatrix = Array.from({ length: n }, () => new Array(n).fill(0));
  results.forEach(r => {
    const di = idx(r.dt_prediction);
    const ni = idx(r.nb_prediction);
    if (di >= 0) dtSelfMatrix[di][di]++;
    if (ni >= 0) nbSelfMatrix[ni][ni]++;
  });

  return {
    labels,
    dt_matrix:        dtMatrix,
    nb_matrix:        nbMatrix,
    has_true_labels:  hasTrueLabels,
    agreement_matrix: agreeMatrix,
    agreement_labels: labels,
    dt_self_matrix:   dtSelfMatrix,
    nb_self_matrix:   nbSelfMatrix,
  };
}

// ─── Professional Confusion Matrix Component ──────────────────────────────────
function ConfusionMatrix({
  matrix,
  labels,
  title,
  subtitle,
  rowLabel,
  colLabel,
  mode = "confusion",
}: {
  matrix:       number[][];
  labels:       string[];
  title:        string;
  subtitle?:    string;
  rowLabel:     string;
  colLabel:     string;
  mode?:        "confusion" | "agreement" | "distribution";
}) {
  const n      = labels.length;
  const maxVal = Math.max(1, ...matrix.flat());
  const total  = matrix.flat().reduce((a, b) => a + b, 0);

  const overallAcc = n > 0 && total > 0
    ? Math.round(matrix.reduce((s, row, i) => s + (row[i] || 0), 0) / total * 100)
    : 0;

  const CELL  = Math.max(40, Math.min(58, Math.floor(340 / (n + 1))));
  const LABELW = 90;

  function cellBg(val: number, isDiag: boolean): string {
    if (val === 0) return "#F5F7F3";
    const t = val / maxVal;
    if (mode === "agreement") {
      if (isDiag) {
        // Teal-green diagonal
        const r = Math.round(240 - t * (240 - 32));
        const g = Math.round(249 - t * (249 - 168));
        const b = Math.round(244 - t * (244 - 124));
        return `rgb(${r},${g},${b})`;
      } else {
        const r = Math.round(245 - t * 30);
        const g = Math.round(247 - t * 30);
        const b = Math.round(243 - t * 30);
        return `rgb(${r},${g},${b})`;
      }
    }
    if (isDiag) {
      // Green diagonal (correct)
      const r = Math.round(240 - t * (240 - 27));
      const g = Math.round(250 - t * (250 - 94));
      const b = Math.round(244 - t * (244 - 60));
      return `rgb(${r},${g},${b})`;
    }
    // Red off-diagonal (error)
    const r2 = Math.round(253 - t * (253 - 190));
    const g2 = Math.round(240 - t * (240 - 60));
    const b2 = Math.round(240 - t * (240 - 60));
    return `rgb(${r2},${g2},${b2})`;
  }

  function cellFg(val: number, isDiag: boolean): string {
    if (val === 0) return "#C5CEC0";
    const t = val / maxVal;
    if (t > 0.5) return "#fff";
    return isDiag ? T.green : T.red;
  }

  const isConfusion = mode === "confusion";

  return (
    <div style={{
      background:   T.surface,
      border:       `1px solid ${T.border}`,
      borderRadius: T.radiusLg,
      overflow:     "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding:        "16px 20px 14px",
        borderBottom:   `1px solid ${T.border}`,
        display:        "flex",
        alignItems:     "flex-start",
        justifyContent: "space-between",
        gap:            12,
      }}>
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.text, letterSpacing: "-.01em" }}>
            {title}
          </p>
          {subtitle && (
            <p style={{ margin: "3px 0 0", fontSize: 11, color: T.muted, lineHeight: 1.4 }}>
              {subtitle}
            </p>
          )}
        </div>
        {isConfusion && total > 0 && (
          <div style={{
            flexShrink:   0,
            background:   overallAcc >= 80 ? "#E8F8F0" : overallAcc >= 60 ? T.goldPale : T.redPale,
            border:       `1px solid ${overallAcc >= 80 ? "#A8E6C0" : overallAcc >= 60 ? "#F0D09E" : "#F5C0C0"}`,
            borderRadius: 8,
            padding:      "5px 12px",
            textAlign:    "center",
          }}>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 700, fontFamily: T.mono,
              color: overallAcc >= 80 ? T.green : overallAcc >= 60 ? T.gold : T.red }}>
              {overallAcc}%
            </p>
            <p style={{ margin: 0, fontSize: 10, color: T.muted, letterSpacing: ".04em", textTransform: "uppercase" }}>
              Akurasi
            </p>
          </div>
        )}
        {mode === "agreement" && total > 0 && (
          <div style={{
            flexShrink:   0,
            background:   "#E8F3FE",
            border:       "1px solid #BDD7F8",
            borderRadius: 8,
            padding:      "5px 12px",
            textAlign:    "center",
          }}>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 700, fontFamily: T.mono, color: T.blue }}>
              {Math.round(matrix.reduce((s, r, i) => s + (r[i] || 0), 0) / total * 100)}%
            </p>
            <p style={{ margin: 0, fontSize: 10, color: T.muted, letterSpacing: ".04em", textTransform: "uppercase" }}>
              Sepakat
            </p>
          </div>
        )}
      </div>

      {/* Matrix body */}
      <div style={{ padding: "16px 20px 20px", overflowX: "auto" }}>
        <div style={{ display: "inline-block", minWidth: "100%" }}>

          {/* Col axis label */}
          <div style={{ display: "flex", marginBottom: 2 }}>
            <div style={{ width: LABELW + 20, flexShrink: 0 }} />
            <div style={{
              flex: 1, textAlign: "center",
              fontSize: 10, fontWeight: 700,
              color: T.muted, textTransform: "uppercase",
              letterSpacing: ".1em",
            }}>
              {colLabel}
            </div>
          </div>

          {/* Col class labels */}
          <div style={{ display: "flex", marginBottom: 6, alignItems: "flex-end" }}>
            <div style={{ width: LABELW + 20, flexShrink: 0 }} />
            {labels.map((lbl, j) => {
              const s = getClassStyle(lbl);
              return (
                <div key={j} style={{
                  width:        CELL,
                  flexShrink:   0,
                  textAlign:    "center",
                  fontSize:     10,
                  fontWeight:   700,
                  color:        s.text,
                  background:   s.bg,
                  borderRadius: "6px 6px 0 0",
                  padding:      "3px 2px 4px",
                  margin:       "0 2px",
                  border:       `1px solid ${s.border}`,
                  borderBottom: "none",
                  overflow:     "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace:   "nowrap",
                }}>
                  {lbl}
                </div>
              );
            })}
            <div style={{ width: 64, flexShrink: 0 }} />
          </div>

          {/* Rows */}
          {matrix.map((row, i) => {
            const rowSum = row.reduce((a, b) => a + b, 0);
            const recall = isConfusion && rowSum > 0
              ? Math.round((row[i] || 0) / rowSum * 100)
              : null;
            const s = getClassStyle(labels[i]);
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
                {/* Row axis label — only on middle row */}
                {i === Math.floor(n / 2) ? (
                  <div style={{ width: 20, flexShrink: 0, display: "flex", justifyContent: "center" }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: T.muted,
                      textTransform: "uppercase", letterSpacing: ".1em",
                      writingMode: "vertical-rl" as const,
                      transform: "rotate(180deg)",
                    }}>
                      {rowLabel}
                    </span>
                  </div>
                ) : (
                  <div style={{ width: 20, flexShrink: 0 }} />
                )}

                {/* Row class label */}
                <div style={{
                  width:        LABELW,
                  flexShrink:   0,
                  display:      "flex",
                  alignItems:   "center",
                  justifyContent: "flex-end",
                  paddingRight: 8,
                }}>
                  <span style={{
                    background:   s.bg,
                    color:        s.text,
                    border:       `1px solid ${s.border}`,
                    borderRadius: 6,
                    fontSize:     10,
                    fontWeight:   700,
                    padding:      "2px 7px",
                    overflow:     "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace:   "nowrap",
                    maxWidth:     LABELW - 10,
                  }}>
                    {labels[i]}
                  </span>
                </div>

                {/* Cells */}
                {row.map((val, j) => {
                  const isDiag = i === j;
                  const pct    = total > 0 ? Math.round(val / total * 100) : 0;
                  return (
                    <div
                      key={j}
                      title={`${labels[i]} → ${labels[j]}: ${val} (${pct}%)`}
                      style={{
                        width:          CELL,
                        height:         CELL,
                        flexShrink:     0,
                        margin:         "0 2px",
                        display:        "flex",
                        flexDirection:  "column",
                        alignItems:     "center",
                        justifyContent: "center",
                        background:     cellBg(val, isDiag),
                        borderRadius:   7,
                        cursor:         "default",
                        position:       "relative",
                        border:         isDiag && isConfusion
                          ? `1.5px solid ${val > 0 ? "rgba(45,106,79,.3)" : "#E0E6DA"}`
                          : `1.5px solid ${val > 0 ? "rgba(0,0,0,.06)" : "transparent"}`,
                        transition:     "transform .12s, box-shadow .12s",
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLDivElement).style.transform = "scale(1.06)";
                        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 10px rgba(0,0,0,.1)";
                        (e.currentTarget as HTMLDivElement).style.zIndex = "10";
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLDivElement).style.transform = "scale(1)";
                        (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
                        (e.currentTarget as HTMLDivElement).style.zIndex = "1";
                      }}
                    >
                      <span style={{
                        fontSize:   Math.max(12, Math.min(18, CELL / 2.8)),
                        fontWeight: isDiag ? 800 : val > 0 ? 600 : 400,
                        color:      cellFg(val, isDiag),
                        fontFamily: T.mono,
                        lineHeight: 1,
                      }}>
                        {val}
                      </span>
                      {val > 0 && total > 0 && (
                        <span style={{
                          fontSize:   9,
                          color:      cellFg(val, isDiag),
                          opacity:    0.75,
                          fontFamily: T.mono,
                          marginTop:  2,
                        }}>
                          {pct}%
                        </span>
                      )}
                    </div>
                  );
                })}

                {/* Recall */}
                {isConfusion && (
                  <div style={{ width: 56, flexShrink: 0, paddingLeft: 8, textAlign: "right" }}>
                    {recall !== null && rowSum > 0 ? (
                      <span style={{
                        fontSize:   11,
                        fontWeight: 600,
                        fontFamily: T.mono,
                        color:      recall >= 80 ? T.green : recall >= 50 ? T.gold : T.red,
                      }}>
                        {recall}%
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: T.border }}>—</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Col precision row */}
          {isConfusion && (
            <div style={{ display: "flex", marginTop: 8 }}>
              <div style={{ width: LABELW + 20, flexShrink: 0 }} />
              {labels.map((_, j) => {
                const colSum = matrix.reduce((s, r) => s + (r[j] || 0), 0);
                const diag   = matrix[j]?.[j] || 0;
                const prec   = colSum > 0 ? Math.round(diag / colSum * 100) : null;
                return (
                  <div key={j} style={{
                    width:      CELL,
                    flexShrink: 0,
                    margin:     "0 2px",
                    textAlign:  "center",
                    fontSize:   11,
                    fontWeight: 600,
                    fontFamily: T.mono,
                    color:      prec === null ? T.border
                      : prec >= 80 ? T.green
                      : prec >= 50 ? T.gold : T.red,
                  }}>
                    {prec !== null && colSum > 0 ? `${prec}%` : "—"}
                  </div>
                );
              })}
              <div style={{ width: 64, flexShrink: 0 }} />
            </div>
          )}

          {/* Legend */}
          <div style={{
            display:    "flex",
            gap:        16,
            flexWrap:   "wrap",
            marginTop:  12,
            paddingLeft: LABELW + 20,
          }}>
            {isConfusion ? (
              <>
                <LegendItem color={T.green} label="Benar (diagonal)" />
                <LegendItem color={T.red}   label="Salah (off-diagonal)" />
                <LegendItem color={T.muted} label="Baris = Recall · Kolom = Precision" dot={false} />
              </>
            ) : mode === "agreement" ? (
              <>
                <LegendItem color="#1D9E75" label="DT & NB sepakat" />
                <LegendItem color={T.muted} label="Off-diagonal = tidak sepakat" dot={false} />
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function LegendItem({ color, label, dot = true }: { color: string; label: string; dot?: boolean }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: T.muted }}>
      {dot && (
        <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
      )}
      {label}
    </span>
  );
}

// ─── Per-class metrics table ──────────────────────────────────────────────────
function PerClassMetrics({
  matrix,
  labels,
  modelName,
}: {
  matrix:    number[][];
  labels:    string[];
  modelName: string;
}) {
  const rows = labels.map((cls, i) => {
    const tp     = matrix[i]?.[i] || 0;
    const rowSum = (matrix[i] || []).reduce((a, b) => a + b, 0);
    const colSum = matrix.reduce((s, r) => s + (r[i] || 0), 0);
    const recall = rowSum > 0 ? tp / rowSum : 0;
    const prec   = colSum > 0 ? tp / colSum : 0;
    const f1     = (prec + recall) > 0 ? 2 * prec * recall / (prec + recall) : 0;
    return { cls, tp, support: rowSum, recall, prec, f1 };
  });

  const MetricBadge = ({ val }: { val: number }) => {
    const pct   = Math.round(val * 100);
    const color = pct >= 80 ? T.green : pct >= 60 ? T.gold : T.red;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ flex: 1, height: 4, background: T.surfaceAlt, borderRadius: 2, overflow: "hidden", maxWidth: 48 }}>
          <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 2 }} />
        </div>
        <span style={{ fontSize: 11, fontFamily: T.mono, fontWeight: 600, color, minWidth: 32 }}>
          {pct}%
        </span>
      </div>
    );
  };

  return (
    <div style={{
      background:   T.surface,
      border:       `1px solid ${T.border}`,
      borderRadius: T.radiusLg,
      overflow:     "hidden",
    }}>
      <div style={{ padding: "16px 20px 12px", borderBottom: `1px solid ${T.border}` }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.text }}>
          Per-Class Metrics
        </p>
        <p style={{ margin: "3px 0 0", fontSize: 11, color: T.muted }}>
          {modelName} — prediksi vs label aktual
        </p>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ background: T.surfaceAlt }}>
            <th style={thS(110)}>Kelas</th>
            <th style={thS(64, "center")}>Support</th>
            <th style={thS(100)}>Precision</th>
            <th style={thS(100)}>Recall</th>
            <th style={thS(100)}>F1-Score</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{
              borderTop: `1px solid ${T.border}`,
              background: i % 2 === 1 ? T.surfaceAlt : T.surface,
            }}>
              <td style={{ padding: "9px 12px" }}><ClassBadge cls={r.cls} /></td>
              <td style={{ padding: "9px 8px", textAlign: "center" }}>
                <span style={{ fontSize: 11, fontFamily: T.mono, color: T.text2, fontWeight: 600 }}>
                  {r.support}
                </span>
              </td>
              <td style={{ padding: "9px 12px" }}><MetricBadge val={r.prec} /></td>
              <td style={{ padding: "9px 12px" }}><MetricBadge val={r.recall} /></td>
              <td style={{ padding: "9px 12px" }}><MetricBadge val={r.f1} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Prediction Distribution (no true labels) ─────────────────────────────────
function PredictionDistribution({
  results,
  model,
}: {
  results: BatchRowResult[];
  model:   "dt" | "nb";
}) {
  const key     = model === "dt" ? "dt_prediction" : "nb_prediction";
  const confKey = model === "dt" ? "dt_confidence" : "nb_confidence";
  const color   = model === "dt" ? "#378ADD" : "#1D9E75";
  const name    = model === "dt" ? "Decision Tree" : "Naive Bayes";

  const dist: Record<string, { count: number; totalConf: number }> = {};
  results.forEach(r => {
    const cls = r[key] as string;
    if (!dist[cls]) dist[cls] = { count: 0, totalConf: 0 };
    dist[cls].count++;
    dist[cls].totalConf += r[confKey] as number;
  });

  const total   = results.length;
  const entries = Object.entries(dist).sort((a, b) => b[1].count - a[1].count);

  return (
    <div style={{
      background:   T.surface,
      border:       `1px solid ${T.border}`,
      borderRadius: T.radiusLg,
      overflow:     "hidden",
    }}>
      <div style={{ padding: "16px 20px 14px", borderBottom: `1px solid ${T.border}` }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.text }}>
          Distribusi Prediksi — {name}
        </p>
        <p style={{ margin: "3px 0 0", fontSize: 11, color: T.muted }}>
          Frekuensi & rata-rata confidence per kelas
        </p>
      </div>
      <div style={{ padding: "16px 20px" }}>
        {entries.map(([cls, { count, totalConf }], i) => {
          const pct     = Math.round(count / total * 100);
          const avgConf = count > 0 ? totalConf / count : 0;
          const s       = getClassStyle(cls);
          return (
            <div key={i} style={{
              display:     "flex",
              alignItems:  "center",
              gap:         12,
              marginBottom: i < entries.length - 1 ? 14 : 0,
            }}>
              {/* Class badge */}
              <div style={{ width: 80, flexShrink: 0 }}>
                <span style={{
                  background:   s.bg,
                  color:        s.text,
                  border:       `1px solid ${s.border}`,
                  borderRadius: 6,
                  fontSize:     11,
                  fontWeight:   700,
                  padding:      "3px 8px",
                  display:      "inline-block",
                  whiteSpace:   "nowrap",
                }}>
                  {cls}
                </span>
              </div>

              {/* Bar */}
              <div style={{ flex: 1 }}>
                <div style={{
                  height:       8,
                  background:   T.surfaceAlt,
                  borderRadius: 4,
                  overflow:     "hidden",
                  marginBottom: 3,
                }}>
                  <div style={{
                    width:        `${pct}%`,
                    height:       "100%",
                    background:   color,
                    borderRadius: 4,
                    transition:   "width .4s ease",
                  }} />
                </div>
                {/* Confidence sub-bar */}
                <div style={{
                  height:       4,
                  background:   T.surfaceAlt,
                  borderRadius: 2,
                  overflow:     "hidden",
                }}>
                  <div style={{
                    width:        `${avgConf}%`,
                    height:       "100%",
                    background:   `${color}55`,
                    borderRadius: 2,
                  }} />
                </div>
              </div>

              {/* Stats */}
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, fontFamily: T.mono, color: T.text }}>
                  {count}
                  <span style={{ fontSize: 10, color: T.muted, fontWeight: 400 }}> ({pct}%)</span>
                </p>
                <p style={{ margin: 0, fontSize: 10, color: T.muted, fontFamily: T.mono }}>
                  conf {avgConf.toFixed(1)}%
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }: {
  label:   string;
  value:   string | number;
  sub?:    string;
  accent?: string;
}) {
  return (
    <div style={{
      background:   T.surface,
      border:       `1px solid ${T.border}`,
      borderRadius: T.radius,
      padding:      "14px 16px",
      borderTop:    accent ? `3px solid ${accent}` : undefined,
      minWidth:     0,
    }}>
      <p style={{ fontSize: 10, color: T.muted, margin: "0 0 6px", fontWeight: 600,
        textTransform: "uppercase", letterSpacing: ".07em" }}>
        {label}
      </p>
      <p style={{ fontSize: 22, fontWeight: 700, margin: 0, color: T.text, fontFamily: T.mono,
        letterSpacing: "-.02em" }}>
        {value}
      </p>
      {sub && <p style={{ fontSize: 11, color: T.muted, margin: "4px 0 0" }}>{sub}</p>}
    </div>
  );
}

function ClassBadge({ cls }: { cls: string }) {
  const s = getClassStyle(cls);
  return (
    <span style={{
      background:   s.bg,
      color:        s.text,
      border:       `0.5px solid ${s.border}`,
      borderRadius: 6,
      fontSize:     11,
      fontWeight:   600,
      padding:      "2px 8px",
      whiteSpace:   "nowrap",
    }}>
      {cls}
    </span>
  );
}

function DonutChart({ dist }: { dist: Record<string, number> }) {
  const entries = Object.entries(dist);
  const total   = entries.reduce((s, [, v]) => s + v, 0);
  if (total === 0) return null;

  const colors = ["#378ADD","#1D9E75","#7F77DD","#EF9F27","#D4537E","#D85A30"];
  const cx = 60, cy = 60, r = 46, inner = 28;
  let angle = -Math.PI / 2;

  const slices = entries.map(([cls, count], i) => {
    const frac  = count / total;
    const sweep = frac * 2 * Math.PI;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    angle += sweep;
    const x2 = cx + r * Math.cos(angle);
    const y2 = cy + r * Math.sin(angle);
    const xi1 = cx + inner * Math.cos(angle - sweep);
    const xi2 = cx + inner * Math.cos(angle);
    const yi1 = cy + inner * Math.sin(angle - sweep);
    const yi2 = cy + inner * Math.sin(angle);
    const lg  = sweep > Math.PI ? 1 : 0;
    const d   = `M ${x1} ${y1} A ${r} ${r} 0 ${lg} 1 ${x2} ${y2} L ${xi2} ${yi2} A ${inner} ${inner} 0 ${lg} 0 ${xi1} ${yi1} Z`;
    return { d, color: colors[i % colors.length], cls, count, pct: Math.round(frac * 100) };
  });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
      <svg width={120} height={120} viewBox="0 0 120 120" aria-hidden="true">
        {slices.map((s, i) => <path key={i} d={s.d} fill={s.color} />)}
        <circle cx={cx} cy={cy} r={inner} fill={T.surface} />
        <text x={cx} y={cy + 5} textAnchor="middle" fontSize={14} fontWeight={600} fill={T.text}>{total}</text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, flexShrink: 0,
              background: s.color, display: "inline-block" }} />
            <span style={{ fontSize: 12, color: T.text2 }}>{s.cls}</span>
            <span style={{ fontSize: 12, color: T.muted }}>{s.count} ({s.pct}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConfBar({ value, color }: { value: number; color: string }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ flex: 1, height: 5, background: T.surfaceAlt, borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 11, color: T.muted, minWidth: 36, textAlign: "right", fontFamily: T.mono }}>
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}

function SectionHeader({ title, sub, open, onToggle, accent }: {
  title:    string;
  sub?:     string;
  open:     boolean;
  onToggle: () => void;
  accent?:  string;
}) {
  return (
    <button
      onClick={onToggle}
      style={{
        width:        "100%",
        display:      "flex",
        alignItems:   "center",
        gap:          10,
        background:   "none",
        border:       "none",
        padding:      "12px 0 10px",
        cursor:       "pointer",
        textAlign:    "left",
        borderBottom: open ? `2px solid ${accent || T.green}` : `1px solid ${T.border}`,
        marginBottom: open ? 20 : 0,
        transition:   "border-color .15s",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: accent || T.green, flexShrink: 0 }} />
      <span style={{ flex: 1 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: T.text, display: "block" }}>{title}</span>
        {sub && <span style={{ fontSize: 11, color: T.muted }}>{sub}</span>}
      </span>
      <span style={{ fontSize: 11, color: T.muted, transform: open ? "rotate(180deg)" : "none",
        transition: "transform .2s", display: "block" }}>▾</span>
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function BatchSection({ apiBase }: BatchSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging,   setDragging]   = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [result,     setResult]     = useState<BatchResponse | null>(null);
  const [confusion,  setConfusion]  = useState<ConfusionData | null>(null);
  const [fileName,   setFileName]   = useState<string | null>(null);
  const [filter,     setFilter]     = useState<"all" | "ood" | "conflict">("all");
  const [search,     setSearch]     = useState("");
  const [page,       setPage]       = useState(1);
  const [showMatrix, setShowMatrix] = useState(true);
  // 3 tabs: dt, nb, agree — always available
  const [matrixTab,  setMatrixTab]  = useState<"dt" | "nb" | "agree">("dt");
  const PAGE_SIZE = 20;

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith(".csv")) {
      setError("Hanya file .csv yang diterima.");
      return;
    }
    setFileName(file.name);
    setError(null);
    setResult(null);
    setConfusion(null);
    setLoading(true);
    setPage(1);
    setFilter("all");
    setSearch("");

    const form = new FormData();
    form.append("file", file);

    try {
      const r = await axios.post<BatchResponse>(`${apiBase}/batch-predict`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(r.data);

      const text    = await file.text();
      const lines   = text.trim().split("\n");
      const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
      const trueLabelCol = headers.findIndex(h =>
        h === "class" || h === "label" || h === "true_label" || h === "actual"
      );
      if (trueLabelCol >= 0) {
        const enriched = r.data.results.map((row, i) => {
          const cells = (lines[i + 1] || "").split(",");
          return { ...row, true_label: (cells[trueLabelCol] || "").trim() };
        });
        setConfusion(computeConfusionData(enriched));
      } else {
        setConfusion(computeConfusionData(r.data.results));
      }
    } catch (e: unknown) {
      let msg = "Gagal memproses batch. Periksa format CSV.";
      if (axios.isAxiosError(e) && e.response?.data?.detail) {
        msg = String(e.response.data.detail);
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const downloadCsv = () => {
    if (!result) return;
    window.open(`${apiBase}/batch-download/${result.batch_id}`, "_blank");
  };

  const filteredRows = result?.results.filter(row => {
    if (filter === "ood"      && !row.ood_warning) return false;
    if (filter === "conflict" && row.consensus)    return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !row.dt_prediction.toLowerCase().includes(q) &&
        !row.nb_prediction.toLowerCase().includes(q) &&
        !String(row.row_index).includes(q)
      ) return false;
    }
    return true;
  }) ?? [];

  const totalPages  = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows    = filteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const ABBRS       = ["PHR", "ALAP", "PDMVG", "ARD", "AWWR", "ADWV", "ARL"];

  // ── Resolve matrix for current tab ──────────────────────────────────────────
  // Tab "dt" and "nb":
  //   - if has_true_labels → show actual confusion matrix (true vs predicted)
  //   - if NOT has_true_labels → show prediction distribution component
  // Tab "agree": always show agreement matrix (DT pred vs NB pred)

  const tabs = [
    { key: "dt"    as const, label: "Decision Tree", color: "#378ADD" },
    { key: "nb"    as const, label: "Naive Bayes",   color: "#1D9E75" },
    { key: "agree" as const, label: "DT vs NB",      color: T.green  },
  ];

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .cm-tab:hover { opacity: .85; }
      `}</style>

      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* Header */}
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px", color: T.text,
          letterSpacing: "-.02em" }}>
          Batch Prediction
        </h2>
        <p style={{ fontSize: 13.5, color: T.muted, margin: "0 0 28px", lineHeight: 1.6 }}>
          Upload file CSV dengan kolom fitur — setiap baris diklasifikasikan oleh Decision Tree dan Naive Bayes.
        </p>

        {/* Upload zone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          role="button"
          tabIndex={0}
          onKeyDown={e => e.key === "Enter" && fileInputRef.current?.click()}
          style={{
            border:       `2px dashed ${dragging ? T.green : T.border}`,
            borderRadius: T.radiusLg,
            padding:      "44px 24px",
            textAlign:    "center",
            cursor:       "pointer",
            background:   dragging ? T.greenXpale : T.surface,
            transition:   "background 0.15s, border-color 0.15s",
            marginBottom: 12,
          }}
        >
          <input ref={fileInputRef} type="file" accept=".csv" style={{ display: "none" }} onChange={onFileInput} />
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 12,
              background: T.surfaceAlt, border: `1px solid ${T.border}`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <IconUpload />
            </div>
          </div>
          <p style={{ margin: "0 0 4px", fontWeight: 600, color: T.text, fontSize: 14 }}>
            {fileName
              ? <>✓ <span style={{ color: T.green }}>{fileName}</span></>
              : "Klik atau drag & drop file CSV di sini"}
          </p>
          <p style={{ margin: 0, fontSize: 12, color: T.muted }}>
            Kolom: PHR, ALAP, PDMVG, ARD, AWWR, ADWV, ARL
          </p>
        </div>

        {/* Format hint */}
        <div style={{
          background:   T.bluePale,
          border:       `1px solid #C5D9F5`,
          borderRadius: T.radius,
          padding:      "10px 14px",
          marginBottom: 28,
          display:      "flex",
          alignItems:   "flex-start",
          gap:          8,
        }}>
          <span style={{ flexShrink: 0, marginTop: 1 }}><IconInfo /></span>
          <span style={{ fontSize: 12, color: T.text2, lineHeight: 1.6 }}>
            Contoh header:{" "}
            <code style={{ fontFamily: T.mono, fontSize: 11, background: "#fff",
              padding: "1px 5px", borderRadius: 4, border: `1px solid ${T.border}` }}>
              PHR,ALAP,PDMVG,ARD,AWWR,ADWV,ARL
            </code>
            {" "}— kolom yang tidak ada diisi nilai rata-rata training. Tambahkan kolom{" "}
            <code style={{ fontFamily: T.mono, fontSize: 11, background: "#fff",
              padding: "1px 5px", borderRadius: 4, border: `1px solid ${T.border}` }}>
              Class
            </code>
            {" "}untuk confusion matrix aktual (prediksi vs label asli).
          </span>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{
            display:      "flex", alignItems: "center", gap: 10,
            padding:      "13px 16px",
            background:   T.greenXpale, border: `1px solid ${T.greenPale}`,
            borderRadius: T.radius, marginBottom: 20,
            color:        T.green, fontSize: 13, fontWeight: 500,
          }}>
            <IconLoader /> Memproses batch prediction…
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            display:      "flex", alignItems: "flex-start", gap: 9,
            padding:      "12px 16px",
            background:   T.redPale, border: `1px solid #F5C0C0`,
            borderRadius: T.radius, marginBottom: 20,
            color:        T.red, fontSize: 13,
          }}>
            <span style={{ flexShrink: 0, marginTop: 1 }}><IconAlert /></span>
            <span>{error}</span>
          </div>
        )}

        {/* Results */}
        {result && (
          <>
            {/* Stat cards */}
            <div style={{
              display:             "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap:                 12,
              marginBottom:        24,
            }}>
              <StatCard label="Total baris"    value={result.total_rows}                                            accent={T.green} />
              <StatCard label="Consensus rate" value={`${result.summary.consensus_rate_pct.toFixed(1)}%`} sub="DT & NB sepakat" accent="#378ADD" />
              <StatCard label="OOD warnings"   value={result.summary.ood_rows} sub={`${result.summary.ood_pct.toFixed(1)}% dari total`} accent={T.gold} />
              <StatCard label="Kelas unik (DT)"value={Object.keys(result.summary.class_distribution).length}       accent="#7F77DD" />
            </div>

            {/* Distribution + download */}
            <div style={{
              display:             "grid",
              gridTemplateColumns: "1fr auto",
              gap:                 16,
              alignItems:          "start",
              marginBottom:        24,
            }}>
              <div style={{
                background:   T.surface, border: `1px solid ${T.border}`,
                borderRadius: T.radiusLg, padding: "18px 20px",
              }}>
                <p style={{ fontSize: 13, fontWeight: 700, margin: "0 0 16px", color: T.text }}>
                  Distribusi kelas — Decision Tree
                </p>
                <DonutChart dist={result.summary.class_distribution} />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button onClick={downloadCsv} style={{
                  display: "flex", alignItems: "center", gap: 7,
                  fontSize: 13, padding: "9px 16px", cursor: "pointer",
                  background: T.green, color: "#fff", border: "none",
                  borderRadius: T.radius, fontWeight: 600, fontFamily: T.sans,
                  whiteSpace: "nowrap",
                }}>
                  <IconDownload /> Download CSV
                </button>
                <p style={{ fontSize: 11, color: T.muted, margin: 0, maxWidth: 130 }}>
                  Batch ID:{" "}
                  <code style={{ fontFamily: T.mono, fontSize: 10 }}>{result.batch_id}</code>
                </p>
              </div>
            </div>

            {/* ── CONFUSION MATRIX SECTION ── */}
            {confusion && (
              <div style={{ marginBottom: 28 }}>
                <SectionHeader
                  title="Confusion Matrix & Distribusi Prediksi"
                  sub={confusion.has_true_labels
                    ? "Confusion matrix aktual — prediksi vs label di kolom 'Class'"
                    : "Tidak ada kolom 'Class' — menampilkan distribusi prediksi & agreement matrix"}
                  open={showMatrix}
                  onToggle={() => setShowMatrix(v => !v)}
                  accent={T.green}
                />

                {showMatrix && (
                  <div>
                    {/* Info banner — no true labels */}
                    {!confusion.has_true_labels && (
                      <div style={{
                        background:   T.goldPale, border: `1px solid #F0D09E`,
                        borderRadius: T.radius, padding: "10px 14px",
                        marginBottom: 16, fontSize: 12,
                        display:      "flex", alignItems: "flex-start", gap: 8,
                      }}>
                        <span style={{ flexShrink: 0, marginTop: 1 }}>
                          <svg width={15} height={15} viewBox="0 0 24 24" fill="none"
                            stroke={T.gold} strokeWidth={2} strokeLinecap="round">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                            <line x1="12" y1="9" x2="12" y2="13"/>
                            <line x1="12" y1="17" x2="12.01" y2="17"/>
                          </svg>
                        </span>
                        <span style={{ color: T.text2, lineHeight: 1.6 }}>
                          CSV tidak memiliki kolom <code style={{ fontFamily: T.mono, fontSize: 11 }}>Class</code>.
                          Tab <b>Decision Tree</b> dan <b>Naive Bayes</b> menampilkan distribusi prediksi masing-masing model.
                          Tab <b>DT vs NB</b> menampilkan agreement matrix. Tambahkan kolom{" "}
                          <code style={{ fontFamily: T.mono, fontSize: 11 }}>Class</code> untuk confusion matrix aktual.
                        </span>
                      </div>
                    )}

                    {/* Tab switcher — ALWAYS VISIBLE */}
                    <div style={{
                      display:    "flex", gap: 3,
                      background: T.surfaceAlt,
                      borderRadius: T.radius,
                      padding:    3,
                      marginBottom: 20,
                      width:      "fit-content",
                    }}>
                      {tabs.map(tab => (
                        <button
                          key={tab.key}
                          className="cm-tab"
                          onClick={() => setMatrixTab(tab.key)}
                          style={{
                            display:    "flex", alignItems: "center", gap: 6,
                            fontSize:   12, padding: "6px 16px",
                            cursor:     "pointer", borderRadius: 8,
                            border:     matrixTab === tab.key ? `1px solid ${tab.color}22` : "1px solid transparent",
                            fontFamily: T.sans,
                            background: matrixTab === tab.key ? T.surface : "transparent",
                            color:      matrixTab === tab.key ? T.text : T.muted,
                            fontWeight: matrixTab === tab.key ? 600 : 400,
                            boxShadow:  matrixTab === tab.key ? "0 1px 4px rgba(0,0,0,.08)" : "none",
                            transition: "all .12s",
                          }}
                        >
                          {/* Color dot */}
                          <span style={{
                            width: 7, height: 7, borderRadius: "50%",
                            background: matrixTab === tab.key ? tab.color : T.muted,
                            flexShrink: 0,
                          }} />
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {/* Content per tab */}
                    {matrixTab === "dt" && (
                      confusion.has_true_labels ? (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                          <ConfusionMatrix
                            matrix={confusion.dt_matrix}
                            labels={confusion.labels}
                            title="Confusion Matrix — Decision Tree"
                            subtitle="Prediksi DT vs label aktual dari kolom 'Class'"
                            rowLabel="Aktual"
                            colLabel="Prediksi DT"
                            mode="confusion"
                          />
                          <PerClassMetrics
                            matrix={confusion.dt_matrix}
                            labels={confusion.labels}
                            modelName="Decision Tree"
                          />
                        </div>
                      ) : (
                        <PredictionDistribution results={result.results} model="dt" />
                      )
                    )}

                    {matrixTab === "nb" && (
                      confusion.has_true_labels ? (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                          <ConfusionMatrix
                            matrix={confusion.nb_matrix}
                            labels={confusion.labels}
                            title="Confusion Matrix — Naive Bayes"
                            subtitle="Prediksi NB vs label aktual dari kolom 'Class'"
                            rowLabel="Aktual"
                            colLabel="Prediksi NB"
                            mode="confusion"
                          />
                          <PerClassMetrics
                            matrix={confusion.nb_matrix}
                            labels={confusion.labels}
                            modelName="Naive Bayes"
                          />
                        </div>
                      ) : (
                        <PredictionDistribution results={result.results} model="nb" />
                      )
                    )}

                    {matrixTab === "agree" && (
                      <ConfusionMatrix
                        matrix={confusion.agreement_matrix}
                        labels={confusion.agreement_labels}
                        title="Inter-Model Agreement — Decision Tree vs Naive Bayes"
                        subtitle="Seberapa sering DT dan NB memprediksi kelas yang sama. Diagonal = kedua model sepakat."
                        rowLabel="Decision Tree"
                        colLabel="Naive Bayes"
                        mode="agreement"
                      />
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Filter + search */}
            <div style={{
              display:    "flex", alignItems: "center", gap: 8,
              flexWrap:   "wrap", marginBottom: 12,
            }}>
              <div style={{ display: "flex", gap: 4, background: T.surfaceAlt,
                borderRadius: T.radius, padding: 3 }}>
                {(["all", "ood", "conflict"] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => { setFilter(f); setPage(1); }}
                    style={{
                      fontSize:   12, padding: "5px 12px", cursor: "pointer",
                      borderRadius: 7, border: "none", fontFamily: T.sans,
                      background: filter === f ? T.surface : "transparent",
                      color:      filter === f ? T.text : T.muted,
                      fontWeight: filter === f ? 600 : 400,
                      boxShadow:  filter === f ? "0 1px 3px rgba(0,0,0,.08)" : "none",
                      transition: "all .12s",
                    }}
                  >
                    {f === "all"      && `Semua (${result.total_rows})`}
                    {f === "ood"      && `OOD (${result.summary.ood_rows})`}
                    {f === "conflict" && `Konflik (${result.results.filter(r => !r.consensus).length})`}
                  </button>
                ))}
              </div>

              <input
                type="text"
                placeholder="Cari kelas atau indeks…"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                style={{
                  fontSize: 12, padding: "6px 10px", width: 190,
                  border: `1.5px solid ${T.border}`, borderRadius: T.radius,
                  fontFamily: T.sans, color: T.text, background: T.surface, outline: "none",
                }}
              />

              <span style={{ marginLeft: "auto", fontSize: 12, color: T.muted }}>
                {filteredRows.length} baris
              </span>
            </div>

            {/* Table */}
            <div style={{
              background:   T.surface, border: `1px solid ${T.border}`,
              borderRadius: T.radiusLg, overflow: "hidden", marginBottom: 16,
            }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse",
                  fontSize: 12, tableLayout: "fixed" }}>
                  <thead>
                    <tr style={{ background: T.surfaceAlt }}>
                      <th style={thS(48)}>No.</th>
                      {ABBRS.map(a => <th key={a} style={thS(62)}>{a}</th>)}
                      <th style={thS(110)}>DT prediksi</th>
                      <th style={thS(96)}>DT conf.</th>
                      <th style={thS(110)}>NB prediksi</th>
                      <th style={thS(96)}>NB conf.</th>
                      <th style={thS(70)}>Sepakat</th>
                      <th style={thS(54)}>OOD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.length === 0 ? (
                      <tr>
                        <td colSpan={8 + ABBRS.length} style={{
                          textAlign: "center", padding: "32px 0",
                          color: T.muted, fontSize: 13,
                        }}>
                          Tidak ada data yang cocok dengan filter.
                        </td>
                      </tr>
                    ) : pageRows.map((row, i) => (
                      <tr key={row.row_index} style={{
                        background: i % 2 === 1 ? T.surfaceAlt : T.surface,
                        borderTop:  `1px solid ${T.border}`,
                      }}>
                        <td style={tdS(48, "center")}>
                          <span style={{ fontSize: 11, color: T.muted, fontFamily: T.mono }}>
                            {row.row_index + 1}
                          </span>
                        </td>
                        {ABBRS.map(a => (
                          <td key={a} style={tdS(62, "right")}>
                            <span style={{ fontFamily: T.mono, fontSize: 11 }}>
                              {row[a] != null ? Number(row[a]).toFixed(2) : "—"}
                            </span>
                          </td>
                        ))}
                        <td style={tdS(110, "center")}><ClassBadge cls={row.dt_prediction} /></td>
                        <td style={tdS(96)}><ConfBar value={row.dt_confidence} color="#378ADD" /></td>
                        <td style={tdS(110, "center")}><ClassBadge cls={row.nb_prediction} /></td>
                        <td style={tdS(96)}><ConfBar value={row.nb_confidence} color="#1D9E75" /></td>
                        <td style={tdS(70, "center")}>
                          {row.consensus ? <IconCheck /> : <IconWarn />}
                        </td>
                        <td style={tdS(54, "center")}>
                          {row.ood_warning
                            ? <span title={row.ood_features || "OOD"}><IconRadar /></span>
                            : <span style={{ color: T.muted, fontSize: 11 }}>—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "center" }}>
                <PagBtn onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                  <IconChevLeft />
                </PagBtn>
                {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                  let pg: number;
                  if (totalPages <= 7)                   pg = i + 1;
                  else if (currentPage <= 4)              pg = i + 1;
                  else if (currentPage >= totalPages - 3) pg = totalPages - 6 + i;
                  else                                    pg = currentPage - 3 + i;
                  const active = pg === currentPage;
                  return <PagBtn key={pg} onClick={() => setPage(pg)} active={active}>{pg}</PagBtn>;
                })}
                <PagBtn onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                  <IconChevRight />
                </PagBtn>
                <span style={{ fontSize: 11, color: T.muted, marginLeft: 6 }}>
                  {currentPage} / {totalPages}
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

// ─── Pagination button ────────────────────────────────────────────────────────
function PagBtn({ children, onClick, disabled, active }: {
  children: React.ReactNode;
  onClick:  () => void;
  disabled?: boolean;
  active?:  boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        minWidth: 32, height: 32,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 12, padding: "0 8px", cursor: disabled ? "not-allowed" : "pointer",
        background: active ? T.green : "transparent",
        color:      active ? "#fff" : disabled ? T.border : T.text2,
        border:     `1px solid ${active ? T.green : T.border}`,
        borderRadius: 8, fontWeight: active ? 600 : 400,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        transition: "all .12s", opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  );
}

// ─── Style helpers ────────────────────────────────────────────────────────────
function thS(w: number, align: "left" | "center" | "right" = "left"): React.CSSProperties {
  return {
    width: w, padding: "9px 8px", textAlign: align,
    fontWeight: 600, fontSize: 10.5, color: "#8A9885",
    borderBottom: `1px solid #E0E6DA`, whiteSpace: "nowrap",
    overflow: "hidden", textOverflow: "ellipsis",
    textTransform: "uppercase", letterSpacing: ".05em",
  };
}

function tdS(w: number, align: "left" | "center" | "right" = "left"): React.CSSProperties {
  return {
    width: w, padding: "8px 8px", fontSize: 12,
    textAlign: align, color: "#4A5544",
    whiteSpace: "nowrap", overflow: "hidden",
    textOverflow: "ellipsis", verticalAlign: "middle",
  };
}
