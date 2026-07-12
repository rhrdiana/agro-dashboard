"use client";

import React from "react";
import { SectionWrap } from "../UI";
// FIX: import AuditEntry (bukan PredictResponse) sesuai page.tsx v3.3.0
import type { AuditEntry } from "../../app/page";

interface AuditProps {
  auditLog:         AuditEntry[];                      // FIX: bukan PredictResponse[]
  onRefresh:        () => Promise<void>;
  onDownloadReport: (logIndex: number) => void;
}

export const AuditSection: React.FC<AuditProps> = ({ auditLog, onRefresh, onDownloadReport }) => (
  <SectionWrap>
    {/* Header */}
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div>
        <h2 style={{ fontSize: 17, fontWeight: 800, color: "var(--text)", letterSpacing: "-.02em" }}>Prediction Audit Log</h2>
        <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 3 }}>
          {auditLog.length} prediksi tercatat dalam sesi ini
        </p>
      </div>
      <button className="btn btn-outline btn-sm" onClick={onRefresh}>
        <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
        </svg>
        Refresh
      </button>
    </div>

    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      {/* Header row */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "160px 1fr 60px 60px 100px 110px",
        gap: 10,
        padding: "10px 18px",
        background: "var(--bg)",
        borderBottom: "1px solid var(--border)",
        fontSize: 11,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: ".07em",
        color: "var(--muted)",
      }}>
        <span>Timestamp</span>
        <span>Model Version</span>
        <span>DT</span>
        <span>NB</span>
        <span>Consensus</span>
        <span>Report</span>
      </div>

      {auditLog.length === 0 ? (
        <div style={{ padding: "48px 20px", textAlign: "center", color: "var(--muted)" }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
          <div style={{ fontSize: 13 }}>Belum ada prediksi. Buka <strong style={{ color: "var(--text)" }}>Live Prediction</strong> dan ubah nilai input.</div>
        </div>
      ) : (
        // FIX: entry bertype AuditEntry — tidak perlu cast ke PredictResponse
        [...auditLog].reverse().map((entry: AuditEntry, i: number) => (
          <div key={i} style={{
            display: "grid",
            gridTemplateColumns: "160px 1fr 60px 60px 100px 110px",
            gap: 10,
            padding: "11px 18px",
            borderBottom: "1px solid var(--border)",
            alignItems: "center",
            fontSize: 12.5,
            transition: "background .1s",
          }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--green-xpale)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--muted)" }}>
              {new Date(entry.timestamp).toLocaleString("id-ID")}
            </span>
            <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--text-2)" }}>
              {entry.model_version}
            </span>
            <span>
              <span className="badge badge-green" style={{ fontFamily: "var(--mono)" }}>
                {entry.decision_tree?.prediction}
              </span>
            </span>
            <span>
              <span className="badge badge-green" style={{ fontFamily: "var(--mono)" }}>
                {entry.naive_bayes?.prediction}
              </span>
            </span>
            <span>
              {entry.consensus
                ? <span className="badge badge-green">✓ Agree</span>
                : <span className="badge badge-red">✗ Diff</span>
              }
            </span>
            <span>
              <button
                className="btn btn-outline btn-sm"
                style={{ fontSize: 11, padding: "3px 10px" }}
                onClick={() => onDownloadReport(entry.log_index)}
              >
                ↓ PDF
              </button>
            </span>
          </div>
        ))
      )}
    </div>

    <div className="card" style={{ background: "var(--green-xpale)", borderColor: "rgba(45,106,79,.15)" }}>
      <div className="card-title" style={{ color: "var(--green)" }}>Tentang Audit Trail</div>
      <p style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.8 }}>
        Log mencatat setiap prediksi: timestamp, versi model, hasil DT &amp; NB, dan status konsensus.
        Berguna untuk audit riset, reproduksibilitas eksperimen, dan pelacakan perubahan keputusan
        model selama sesi berlangsung. Tombol <strong style={{ color: "var(--text)" }}>↓ PDF</strong> mengunduh
        laporan lengkap per prediksi via <code style={{ fontFamily: "var(--mono)", fontSize: 11 }}>/report/&#123;log_index&#125;</code>.
      </p>
    </div>
  </SectionWrap>
);
