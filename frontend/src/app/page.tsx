"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";

// Components
import { Sidebar, type NavId } from "../components/Sidebar";
import { Topbar } from "../components/Topbar";

// Sections
import { OverviewSection }    from "../components/sections/OverviewSection";
import { EdaSection }         from "../components/sections/EdaSection";
import { StressSection }      from "../components/sections/SressSection";
import { PerformanceSection } from "../components/sections/PerformanceSection";
import { PredictionSection }  from "../components/sections/PredictionSection";
import { XaiSection }         from "../components/sections/XaiSection";
import { ConclusionSection }  from "../components/sections/ConclusionSection";
import { AuditSection }       from "../components/sections/AuditSection";

// Styles
import "./globals.css";

// ─── Constants ───────────────────────────────────────────────────────────────
const API = "http://127.0.0.1:8000";

const FEATURE_DEFAULTS: Record<string, number> = {
  "Plant height rate (PHR)": 45.0,
  "Average leaf area of the plant (ALAP)": 30.0,
  "Percentage of dry matter for vegetative growth (PDMVG)": 15.0,
  "Average root diameter (ARD)": 5.0,
  "Average wet weight of the root (AWWR)": 20.0,
  "Average dry weight of vegetative plants (ADWV)": 10.0,
  "Average root length (ARL)": 25.0,
};

// ─── Root layout ─────────────────────────────────────────────────────────────
export default function Dashboard() {
  // Navigation
  const [tab, setTab]       = useState<NavId>("overview");

  // Data states
  const [inputs, setInputs]       = useState<Record<string, number>>(FEATURE_DEFAULTS);
  const [predResult, setPredResult] = useState<any>(null);
  const [edaData, setEdaData]       = useState<any>(null);
  const [perfData, setPerfData]     = useState<any>(null);
  const [auditLog, setAuditLog]     = useState<any[]>([]);

  // Loading states
  const [predLoading, setPredLoading] = useState(false);
  const [edaLoading, setEdaLoading]   = useState(false);
  const [perfLoading, setPerfLoading] = useState(false);

  // Noise toggle
  const [addNoise, setAddNoise]     = useState(false);
  const [noiseLevel, setNoiseLevel] = useState(0.05);

  // Session ID
  const [sessionId] = useState(() => Math.random().toString(36).slice(2, 8).toUpperCase());

  // Debounce ref for prediction
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Data fetching ──────────────────────────────────────────────────────────
  const applyNoise = useCallback((vals: Record<string, number>) => {
    if (!addNoise) return vals;
    const out: Record<string, number> = {};
    for (const k in vals) {
      out[k] = vals[k] + (Math.random() * 2 - 1) * noiseLevel * vals[k];
    }
    return out;
  }, [addNoise, noiseLevel]);

  const fetchPred = useCallback(async () => {
    setPredLoading(true);
    try {
      const r = await axios.post(`${API}/predict`, { features: applyNoise(inputs) });
      setPredResult(r.data);
    } catch (e) { console.error(e); } finally { setPredLoading(false); }
  }, [inputs, applyNoise]);

  const fetchEDA = async () => {
    setEdaLoading(true);
    try { const r = await axios.get(`${API}/eda`); setEdaData(r.data); }
    catch (e) { console.error(e); } finally { setEdaLoading(false); }
  };

  const fetchPerf = async () => {
    setPerfLoading(true);
    try { const r = await axios.get(`${API}/performance`); setPerfData(r.data); }
    catch (e) { console.error(e); } finally { setPerfLoading(false); }
  };

  const fetchAudit = async () => {
    try { const r = await axios.get(`${API}/audit-log`); setAuditLog(r.data.log ?? []); }
    catch (e) { console.error(e); }
  };

  const refreshAll = () => { fetchEDA(); fetchPerf(); fetchPred(); };

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => { fetchEDA(); fetchPerf(); }, []);

  useEffect(() => {
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(fetchPred, 600);
    return () => { if (debRef.current) clearTimeout(debRef.current); };
  }, [inputs, addNoise, noiseLevel]);

  useEffect(() => { if (tab === "audit") fetchAudit(); }, [tab]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar activeTab={tab} onTabChange={setTab} sessionId={sessionId} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
        <Topbar activeTab={tab} onRefresh={refreshAll} />

        <main style={{ flex: 1, padding: "22px 24px", overflowY: "auto" }}>
          {tab === "overview"    && <OverviewSection    edaData={edaData} perfData={perfData} edaLoading={edaLoading} perfLoading={perfLoading} />}
          {tab === "eda"         && <EdaSection          edaData={edaData} loading={edaLoading} />}
          {tab === "stress"      && <StressSection       perfData={perfData} loading={perfLoading} />}
          {tab === "performance" && <PerformanceSection  perfData={perfData} loading={perfLoading} />}
          {tab === "prediction"  && <PredictionSection
            inputs={inputs} setInputs={setInputs}
            predResult={predResult} predLoading={predLoading}
            addNoise={addNoise} setAddNoise={setAddNoise}
            noiseLevel={noiseLevel} setNoiseLevel={setNoiseLevel}
          />}
          {tab === "xai"         && <XaiSection          perfData={perfData} predResult={predResult} perfLoading={perfLoading} predLoading={predLoading} />}
          {tab === "conclusion"  && <ConclusionSection   edaData={edaData} perfData={perfData} predResult={predResult} />}
          {tab === "audit"       && <AuditSection        auditLog={auditLog} onRefresh={fetchAudit} />}
        </main>
      </div>
    </div>
  );
}
