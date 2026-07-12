"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";

// Components
import { Sidebar, type NavId } from "../components/Sidebar";
import { Topbar }              from "../components/Topbar";

// Sections
import { OverviewSection }    from "../components/sections/OverviewSection";
import { EdaSection }         from "../components/sections/EdaSection";
import { StressSection }      from "../components/sections/SressSection";        // FIX: nama file "StressSection" (bukan "SressSection")
import { PerformanceSection } from "../components/sections/PerformanceSection";
import { PredictionSection }  from "../components/sections/PredictionSection";
import { XaiSection }         from "../components/sections/XaiSection";
import { ConclusionSection }  from "../components/sections/ConclusionSection";
import { AuditSection }       from "../components/sections/AuditSection";
import { BatchSection } from "../components/sections/Batchsection";

import "./globals.css";

// ─── API Base URL ─────────────────────────────────────────────────────────────
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

// ─── Types — diselaraskan dengan main.py v3.3.0 ───────────────────────────────

// /predict → OodFeature
// FIX-3: v3.3.0 memisahkan value menjadi value_raw + value_scaled,
//        dan mean menjadi mean_scaled (bukan "mean")
export interface OodFeature {
  feature:      string;
  abbr:         string;
  value_raw:    number;   // nilai mentah sebelum scaling
  value_scaled: number;   // nilai setelah StandardScaler
  mean_scaled:  number;   // mean training set dalam ruang scaled
  z_score:      number;
}

export interface ClassProba {
  [cls: string]: number;
}

export interface ModelPred {
  prediction:          string;
  confidence:          number;
  class_probabilities: ClassProba;
}

export interface ShapItem {
  feature:    string;
  full_name:  string;
  shap_value: number;
  direction:  "positive" | "negative";
  abs_impact: number;
}

export interface XaiGlobalItem {
  feature:    string;
  full_name:  string;
  importance: number;
}

export interface DecisionPathNode {
  node_id:  number;
  is_leaf:  boolean;
  samples:  number;
  impurity: number;
  // non-leaf fields
  feature?:      string;
  full_name?:    string;
  threshold?:    number;
  input_value?:  number;
  direction?:    string;
  // leaf fields
  predicted_class?: string;
}

export interface DecisionPath {
  path_length:        number;
  nodes:              DecisionPathNode[];
  tree_rules_excerpt: string;
}

// /predict → BenchmarkItem
// FIX-4: v3.3.0 memisahkan value menjadi value_raw + value_scaled
export interface BenchmarkItem {
  feature:      string;
  full_name:    string;
  value_raw:    number;   // nilai mentah
  value_scaled: number;   // nilai setelah scaling
  mean:         number;   // mean training scaled
  std:          number;
  z_score:      number;
  percentile:   number;
  status:       "above_average" | "below_average" | "normal";
}

// /predict → BenchmarkPerClassItem
// FIX-5: v3.3.0 mengganti "value" → "value_scaled"
export interface BenchmarkPerClassItem {
  feature:          string;
  full_name:        string;
  value_scaled:     number;   // nilai setelah scaling (bukan "value")
  class_mean:       number | null;
  class_std:        number | null;
  z_score_in_class: number;
  status:           "above_class_avg" | "below_class_avg" | "normal";
}

export interface NoiseCurvePoint {
  noise:      string;
  noise_val:  number;
  stability:  number;
}

export interface FeatureStat {
  mean: number;
  std:  number;
  min:  number;
  max:  number;
  q25:  number;
  q75:  number;
}

export interface PredictResponse {
  status:              string;
  timestamp:           string;
  model_version:       string;   // v3.3.0: "v3.3.0-DT-NB-FS7-SHAP-SCALED"
  log_index:           number;
  ood_warning:         boolean;
  ood_features:        OodFeature[];
  decision_tree:       ModelPred;
  naive_bayes:         ModelPred;
  consensus:           boolean;
  consensus_label:     string;
  decision_path:       DecisionPath;
  xai_shap:            ShapItem[];
  xai_global:          XaiGlobalItem[];
  benchmark:           BenchmarkItem[];
  benchmark_per_class: BenchmarkPerClassItem[];
  sensitivity_score:   number;
  noise_curve:         NoiseCurvePoint[];
  baseline_stats:      Record<string, FeatureStat>;
}

// /eda → EdaResponse
// FIX-1: class_distribution v3.3.0 punya 3 level (bukan 2)
export interface EdaResponse {
  dataset_info:           Record<string, number | string | string[]>;
  class_distribution: {
    original_full_dataset: Record<string, number>;   // seluruh dataset (EDA info)
    train_raw:             Record<string, number>;   // training set sebelum augmentasi
    train_augmented:       Record<string, number>;   // training set setelah augmentasi
  };
  feature_stats_all:      Record<string, FeatureStat>;
  feature_stats_selected: Record<string, FeatureStat>;
  feature_stats_raw_sel?: Record<string, FeatureStat>; 
  rfe_ranking:            Record<string, number>;
  per_class_stats:        Record<string, Record<string, { mean: number; std: number; min: number; max: number }>>;
  correlation_matrix:     { features: string[]; data: number[][]; source: string };
  feature_abbr:           Record<string, string>;
  // v3.3.0 tambahan: parameter scaler (dari /eda endpoint)
  scaler_params:          Record<string, { mean_: number; scale_: number }>;
}

// /performance → PerfResponse
// FIX-2: best_dt_params v3.3.0 dipisah menjadi best_dt_params_full & best_dt_params_sel
export interface PerfResponse {
  metrics: {
    before_fs: { decision_tree: MetricBlock; naive_bayes: MetricBlock };
    after_fs:  { decision_tree: MetricBlock; naive_bayes: MetricBlock };
  };
  stress_test:           StressPoint[];
  feature_importance_dt: { feature: string; abbr: string; importance: number }[];
  best_dt_params_full:   Record<string, unknown>;   // FIX-2: full features
  best_dt_params_sel:    Record<string, unknown>;   // FIX-2: selected features
  split_info:            Record<string, unknown>;
}

export interface MetricBlock {
  model:            string;
  accuracy:         number;
  precision:        number;
  recall:           number;
  f1_score:         number;
  confusion_matrix: number[][];
  classes:          string[];
  per_class:        Record<string, { precision: number; recall: number; f1: number; support: number }>;
}

export interface StressPoint {
  noise:     string;
  noise_val: number;
  dt_before: number;
  nb_before: number;
  dt_after:  number;
  nb_after:  number;
}

// What-If types
export interface WhatIfPoint {
  vary_value:    number;
  dt_prediction: string;
  dt_confidence: number;
  nb_prediction: string;
  nb_confidence: number;
  consensus:     boolean;
}

export interface WhatIfResponse {
  vary_feature:      string;
  vary_feature_full: string;
  range:             { min: number; max: number; steps: number };
  results:           WhatIfPoint[];
}

// Audit log entry — v3.3.0 memakai "input_features_raw" (bukan "input_features")
// FIX-7: definisikan type eksplisit agar AuditSection bisa render dengan benar
export interface AuditEntry {
  log_index:          number;
  timestamp:          string;
  model_version:      string;
  input_features_raw: Record<string, number>;   // FIX-7: bukan "input_features"
  decision_tree:      ModelPred;
  naive_bayes:        ModelPred;
  consensus:          boolean;
  consensus_label:    string;
  ood_warning:        boolean;
  ood_features:       OodFeature[];
  xai_shap:           ShapItem[];
  decision_path:      DecisionPath;
  sensitivity_score:  number;
  noise_curve:        NoiseCurvePoint[];
}

// Error state
interface FetchErrors {
  eda:     string | null;
  perf:    string | null;
  predict: string | null;
  whatif:  string | null;
  audit:   string | null;
  batch: string | null;   
}

// ─── Root layout ──────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [tab, setTab] = useState<NavId>("overview");

  // ── Data states ──────────────────────────────────────────────────────────────
  const [inputs, setInputs]         = useState<Record<string, number>>({});
  const [predResult, setPredResult] = useState<PredictResponse | null>(null);
  const [edaData, setEdaData]       = useState<EdaResponse | null>(null);
  const [perfData, setPerfData]     = useState<PerfResponse | null>(null);
  const [auditLog, setAuditLog]     = useState<AuditEntry[]>([]);   // FIX-7: typed
  const [whatIfData, setWhatIfData] = useState<WhatIfResponse | null>(null);

  // ── Loading states ────────────────────────────────────────────────────────────
  const [predLoading, setPredLoading]     = useState(false);
  const [edaLoading, setEdaLoading]       = useState(false);
  const [perfLoading, setPerfLoading]     = useState(false);
  const [whatIfLoading, setWhatIfLoading] = useState(false);

  // ── Error states ──────────────────────────────────────────────────────────────
  const [errors, setErrors] = useState<FetchErrors>({
    eda: null, perf: null, predict: null, whatif: null, audit: null, batch: null
  });

  const setError = (key: keyof FetchErrors, msg: string | null) =>
    setErrors(prev => ({ ...prev, [key]: msg }));

  // ── Session ID ────────────────────────────────────────────────────────────────
  const [sessionId] = useState(() =>
    Math.random().toString(36).slice(2, 8).toUpperCase()
  );

  // ── Debounce ref ──────────────────────────────────────────────────────────────
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch functions ───────────────────────────────────────────────────────────

  const fetchEDA = useCallback(async () => {
    setEdaLoading(true);
    setError("eda", null);
    try {
      const r = await axios.get<EdaResponse>(`${API}/eda`);
      setEdaData(r.data);

      // Inisialisasi inputs dari mean backend (hanya sekali saat pertama load)
      // Key diambil persis dari feature_stats_selected agar cocok dengan nama kolom CSV
      if (Object.keys(inputs).length === 0) {
        const defaults: Record<string, number> = {};
        for (const [col, stat] of Object.entries(r.data.feature_stats_selected)) {
          // FIX-12: mean dari stats_sel adalah mean dalam ruang SCALED (≈0).
          // Untuk nilai default input yang meaningful, gunakan inverse dari scaler:
          // scaler_params tersedia di /eda sebagai { mean_, scale_ } per fitur.
          // raw_default = scaled_mean * scale_ + mean_  → tapi scaled_mean ≈ 0
          // sehingga raw_default ≈ scaler_params[col].mean_  (mean training raw)
          const scalerParam = r.data.scaler_params?.[col];
          defaults[col] = scalerParam
            ? scalerParam.mean_          // mean training raw — nilai paling representatif
            : stat.mean;                 // fallback: mean scaled (≈0, kurang ideal)
        }
        setInputs(defaults);
      }
    } catch (e) {
      setError("eda", "Gagal memuat data EDA. Pastikan API server berjalan di " + API);
      console.error(e);
    } finally {
      setEdaLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchPerf = useCallback(async () => {
    setPerfLoading(true);
    setError("perf", null);
    try {
      const r = await axios.get<PerfResponse>(`${API}/performance`);
      setPerfData(r.data);
    } catch (e) {
      setError("perf", "Gagal memuat data performa model.");
      console.error(e);
    } finally {
      setPerfLoading(false);
    }
  }, []);

  const fetchPred = useCallback(async () => {
    if (Object.keys(inputs).length === 0) return;

    setPredLoading(true);
    setError("predict", null);
    try {
      // Kirim nilai RAW (sebelum scaling) — backend yang mengurus StandardScaler
      const r = await axios.post<PredictResponse>(`${API}/predict`, { features: inputs });
      setPredResult(r.data);
    } catch (e) {
      setError("predict", "Gagal melakukan prediksi. Periksa koneksi ke API.");
      console.error(e);
    } finally {
      setPredLoading(false);
    }
  }, [inputs]);

  // What-If fetch — varyFeature adalah ABBR (e.g. "PHR"), bukan nama kolom penuh
  const fetchWhatIf = useCallback(async (
    varyFeature: string,
    rangeMin:    number,
    rangeMax:    number,
    steps:       number = 30,
  ) => {
    if (Object.keys(inputs).length === 0) return;

    setWhatIfLoading(true);
    setError("whatif", null);
    try {
      const r = await axios.post<WhatIfResponse>(`${API}/whatif`, {
        features:     inputs,   // nilai RAW — backend scale sendiri
        vary_feature: varyFeature,
        range_min:    rangeMin,
        range_max:    rangeMax,
        steps,
      });
      setWhatIfData(r.data);
    } catch (e) {
      setError("whatif", "Gagal memuat data What-If Analysis.");
      console.error(e);
    } finally {
      setWhatIfLoading(false);
    }
  }, [inputs]);

  const fetchAudit = useCallback(async () => {
    setError("audit", null);
    try {
      // FIX-7: response log bertype AuditEntry[] (bukan PredictResponse[])
      const r = await axios.get<{ log: AuditEntry[]; total: number }>(`${API}/audit-log`);
      setAuditLog(r.data.log ?? []);
    } catch (e) {
      setError("audit", "Gagal memuat audit log.");
      console.error(e);
    }
  }, []);

  // Download PDF via log_index
  const downloadReport = useCallback((logIndex: number) => {
    window.open(`${API}/report/${logIndex}`, "_blank");
  }, []);

  const refreshAll = useCallback(() => {
    fetchEDA();
    fetchPerf();
    fetchPred();
  }, [fetchEDA, fetchPerf, fetchPred]);

  // ── Effects ───────────────────────────────────────────────────────────────────

  // Initial load
  useEffect(() => {
    fetchEDA();
    fetchPerf();
  }, [fetchEDA, fetchPerf]);

  // Auto-predict saat inputs berubah (debounced 600ms)
  useEffect(() => {
    if (Object.keys(inputs).length === 0) return;
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(fetchPred, 600);
    return () => { if (debRef.current) clearTimeout(debRef.current); };
  }, [inputs, fetchPred]);

  // Fetch audit log saat tab audit dibuka
  useEffect(() => {
    if (tab === "audit") fetchAudit();
  }, [tab, fetchAudit]);

  // ── Global error banner ───────────────────────────────────────────────────────
  const activeError =
    errors.eda ?? errors.perf ?? errors.predict ?? errors.whatif ?? errors.audit;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar activeTab={tab} onTabChange={setTab} sessionId={sessionId} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
        <Topbar activeTab={tab} onRefresh={refreshAll} />

        {activeError && (
          <div style={{
            background: "#FCEBEB",
            color: "#A32D2D",
            fontSize: 13,
            padding: "8px 24px",
            borderBottom: "1px solid #F7C1C1",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}>
            <span>⚠</span>
            <span>{activeError}</span>
            <button
              onClick={() => setErrors({ eda: null, perf: null, predict: null, whatif: null, audit: null, batch: null })}
              style={{
                marginLeft: "auto",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#A32D2D",
                fontSize: 16,
              }}
            >
              ×
            </button>
          </div>
        )}

        <main style={{ flex: 1, padding: "22px 24px", overflowY: "auto" }}>

          {tab === "overview" && (
            <OverviewSection
              edaData={edaData}
              perfData={perfData}
              edaLoading={edaLoading}
              perfLoading={perfLoading}
            />
          )}

          {tab === "eda" && (
            <EdaSection
              edaData={edaData}
              loading={edaLoading}
            />
          )}

          {tab === "stress" && (
            <StressSection
              perfData={perfData}
              loading={perfLoading}
            />
          )}

          {tab === "performance" && (
            <PerformanceSection
              perfData={perfData}
              loading={perfLoading}
            />
          )}

          {tab === "prediction" && (
            <PredictionSection
              inputs={inputs}
              setInputs={setInputs}
              edaData={edaData}
              predResult={predResult}
              predLoading={predLoading}
              whatIfData={whatIfData}
              whatIfLoading={whatIfLoading}
              onFetchWhatIf={fetchWhatIf}
              onDownloadReport={downloadReport}
            />
          )}

          {tab === "xai" && (
            <XaiSection
              perfData={perfData}
              predResult={predResult}
              perfLoading={perfLoading}
              predLoading={predLoading}
              decisionPath={predResult?.decision_path ?? null}
              xaiShap={predResult?.xai_shap ?? null}
              xaiGlobal={predResult?.xai_global ?? null}
              consensusLabel={predResult?.consensus_label ?? null}
            />
          )}

          {tab === "conclusion" && (
            <ConclusionSection
              edaData={edaData}
              perfData={perfData}
              predResult={predResult}
            />
          )}

          {tab === "audit" && (
            <AuditSection
              auditLog={auditLog}
              onRefresh={fetchAudit}
              // FIX: teruskan download handler agar AuditSection
              // bisa tampilkan tombol "Download Report" per entri
              onDownloadReport={downloadReport}
            />
          )}

          {tab === "batch" && (
            <BatchSection apiBase={API} />
          )}
 

        </main>
      </div>
    </div>
  );
}




          