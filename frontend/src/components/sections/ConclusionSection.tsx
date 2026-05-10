"use client";

import React, { useState } from "react";
import { SectionWrap } from "../UI";

interface ConclusionProps {
  edaData: any;
  perfData: any;
  predResult: any;
}

export const ConclusionSection: React.FC<ConclusionProps> = ({ edaData, perfData, predResult }) => {
  const [report, setReport] = useState("");
  const [loading, setLoading] = useState(false);

  const generateReport = async () => {
    setLoading(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: `Kamu adalah analis data pertanian IoT. Buat laporan riset singkat dalam Bahasa Indonesia (format markdown) berdasarkan hasil analisis AgroAI berikut:

EDA: ${JSON.stringify(edaData?.dataset_info)}
Performa Model: ${JSON.stringify(perfData?.metrics)}
Prediksi Terkini: ${JSON.stringify(predResult ? { dt: predResult.decision_tree, nb: predResult.naive_bayes, consensus: predResult.consensus } : null)}

Cakup: 1) Ringkasan Dataset & Augmentasi, 2) Hasil RFE Feature Selection, 3) Perbandingan Performa Before/After FS, 4) Interpretasi Prediksi & XAI, 5) Rekomendasi Penggunaan Model.`,
          }],
        }),
      });
      const d = await res.json();
      setReport(d.content?.map((b: any) => b.text || "").join("\n") ?? "");
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SectionWrap>
      {/* Key findings */}
      <div className="card">
        <div className="card-title">Temuan Utama</div>
        <div className="g2">
          {[
            {
              num: "01", color: "#2D6A4F", bg: "var(--green-xpale)",
              title: "RFE Meningkatkan Generalisasi",
              desc: "Reduksi dari 12 ke 7 fitur mengurangi overfitting, terlihat jelas pada perbandingan akurasi sebelum dan sesudah feature selection.",
            },
            {
              num: "02", color: "#40916C", bg: "#F0FAF4",
              title: "Split-Before-Augment Terbukti Valid",
              desc: "Augmentasi noise dilakukan SETELAH split memastikan tidak ada data leakage ke test set — validitas eksperimen terjaga.",
            },
            {
              num: "03", color: "#E9A43A", bg: "#FFFBF0",
              title: "Robustness Naive Bayes",
              desc: "NB menunjukkan degradasi lebih gradual terhadap noise dibanding DT pada level noise >30%, cocok untuk sensor dengan natural noise.",
            },
            {
              num: "04", color: "#3A7BD5", bg: "#EBF2FD",
              title: "Decision Tree Lebih Interpretabel",
              desc: "Feature importance yang jelas memungkinkan identifikasi fitur kritis (ARL, ADWV, PHR) yang paling memengaruhi klasifikasi.",
            },
          ].map(f => (
            <div key={f.num} style={{ background: f.bg, border: "1px solid var(--border)", borderLeft: `3px solid ${f.color}`, borderRadius: 12, padding: 18 }}>
              <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: f.color, fontWeight: 700, marginBottom: 7 }}>{f.num}</div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>{f.title}</div>
              <div style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.7 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Recommendation table */}
      <div className="card">
        <div className="card-title">Rekomendasi Implementasi</div>
        <table className="tbl">
          <thead>
            <tr><th>Skenario</th><th>Model</th><th>Alasan</th><th>Prioritas</th></tr>
          </thead>
          <tbody>
            {[
              { s: "Sensor dengan noise tinggi (lapangan)", m: "Naive Bayes", a: "Degradasi akurasi lebih gradual, lebih stabil", p: "Tinggi" },
              { s: "Greenhouse kontrol presisi", m: "Decision Tree", a: "Aturan keputusan jelas untuk debugging & validasi", p: "Tinggi" },
              { s: "Monitoring IoT masif (edge)", m: "Naive Bayes", a: "Inferensi cepat, memori minimal untuk edge device", p: "Medium" },
              { s: "Penelitian & analisis fitur", m: "Decision Tree", a: "Feature importance membantu identifikasi parameter kritis", p: "Medium" },
              { s: "Produksi validasi tinggi", m: "Ensemble DT+NB", a: "Konsensus kedua model sebagai filter prediksi kritis", p: "Tinggi" },
            ].map((r, i) => (
              <tr key={i}>
                <td className="tbl-main">{r.s}</td>
                <td><span className="badge badge-green">{r.m}</span></td>
                <td style={{ fontSize: 12 }}>{r.a}</td>
                <td><span className={`badge ${r.p === "Tinggi" ? "badge-green" : "badge-gold"}`}>{r.p}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* AI Report */}
      <div className="card">
        <div className="card-title">AI-Generated Research Report</div>
        <div className="card-subtitle">Generate laporan riset otomatis menggunakan Claude AI berdasarkan seluruh data analisis.</div>
        <button
          className="btn btn-primary"
          onClick={generateReport}
          disabled={loading}
          style={{ marginBottom: 24 }}
        >
          {loading
            ? <><span className="spinner">⟳</span> Generating...</>
            : <>✦ Generate Research Report</>
          }
        </button>

        {report ? (
          <div style={{ fontSize: 13.5, lineHeight: 1.85, color: "var(--text-2)" }}
            dangerouslySetInnerHTML={{
              __html: report
                .replace(/^### (.+)$/gm, '<h3 style="font-family:var(--sans);color:var(--green);margin:16px 0 8px;font-weight:700;font-size:14px;">$1</h3>')
                .replace(/^## (.+)$/gm, '<h2 style="font-family:var(--sans);color:var(--text);margin:20px 0 10px;font-weight:800;font-size:16px;">$1</h2>')
                .replace(/^# (.+)$/gm, '<h1 style="font-family:var(--sans);color:var(--text);margin:22px 0 12px;font-weight:800;font-size:18px;">$1</h1>')
                .replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--text);font-weight:700;">$1</strong>')
                .replace(/`(.+?)`/g, '<code style="font-family:var(--mono);background:var(--bg);padding:1px 6px;border-radius:5px;font-size:12px;color:var(--green);">$1</code>')
                .replace(/^- (.+)$/gm, '<li style="margin:4px 0;">$1</li>')
                .replace(/<\/li>\n<li/g, '</li><li')
                .replace(/(<li[^>]*>[\s\S]+?<\/li>)/g, '<ul style="padding-left:20px;margin:8px 0;">$1</ul>')
                .replace(/\n\n/g, '<br/>')
            }}
          />
        ) : (
          <div style={{ textAlign: "center", padding: "32px 20px", color: "var(--muted)" }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>📄</div>
            <div style={{ fontSize: 13 }}>Klik tombol di atas untuk generate laporan riset otomatis.</div>
          </div>
        )}
      </div>
    </SectionWrap>
  );
};
