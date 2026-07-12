"""
AgroAI Analytics API  –  v3.4.0
Changelog dari v3.3.0:

  v3.4.0:
    [FIX-17] Model caching dengan pickle (.pkl):
             Semua artefak training (model, scaler, stats, dll.) disimpan ke
             'model_cache.pkl' saat pertama kali training.
             Pada restart berikutnya, cache di-load langsung jika ada dan valid,
             sehingga startup jauh lebih cepat (tidak perlu training ulang).
             Cache di-invalidate secara otomatis jika dataset berubah
             (berdasarkan hash CSV) atau versi cache tidak cocok.
    [NEW]   Endpoint POST /batch-predict:
             Terima file CSV (multipart/form-data) dengan kolom fitur yang sama
             seperti inferensi tunggal. Mengembalikan prediksi per-baris
             beserta confidence DT, NB, consensus, dan OOD warning.
             Hasilnya bisa di-download sebagai CSV melalui GET /batch-download/{batch_id}.
    [NOTE]  Semua fix dari v3.3.0 (FIX-1 s/d FIX-16) tetap dipertahankan.
"""

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

import pandas as pd
import numpy as np
import json, os, threading, pickle, hashlib, io, uuid
from datetime import datetime
from pathlib import Path

from sklearn.tree import DecisionTreeClassifier, export_text
from sklearn.naive_bayes import GaussianNB
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    confusion_matrix, classification_report,
)

import shap
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
)

# ──────────────────────────────────────────────────────────────
# CONFIG
# ──────────────────────────────────────────────────────────────
CONFIG = {
    "augment_noise_level":    0.05,
    "augment_multiplier":     2,
    "test_size":              0.2,
    "random_seed":            42,
    "noise_curve_runs":       15,
    "max_audit_entries":      1000,
    "max_reports":            200,
    "dt_tree_excerpt_depth":  5,
    "dt_tree_excerpt_chars":  1500,
    "ood_zscore_threshold":   3.0,
    "benchmark_high_z":       1.5,
    "benchmark_low_z":        -1.5,
    # [FIX-17] Versi cache — ubah ini untuk paksa re-training
    "cache_version":          "3.4.0",
}

NOISE_LEVELS = [0.0, 0.05, 0.10, 0.15, 0.20, 0.30, 0.40, 0.50]

DT_PARAM_GRID = {
    "max_depth":        [5, 8, 10, 15, None],
    "min_samples_split":[10, 20, 50],
    "min_samples_leaf": [5, 10, 20],
    "criterion":        ["gini", "entropy"],
    "max_features":     ["sqrt", None],
    "ccp_alpha":        [0.0, 0.001],
}

# ──────────────────────────────────────────────────────────────
# APP SETUP
# ──────────────────────────────────────────────────────────────
app = FastAPI(title="AgroAI Analytics API", version="3.4.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

AUDIT_FILE    = Path("audit_log.json")
REPORTS_DIR   = Path("reports")
CACHE_FILE    = Path("model_cache.pkl")          # [FIX-17]
BATCH_DIR     = Path("batch_results")            # [NEW] batch result storage
REPORTS_DIR.mkdir(exist_ok=True)
BATCH_DIR.mkdir(exist_ok=True)

_audit_lock = threading.Lock()
_batch_store: dict[str, pd.DataFrame] = {}      # in-memory batch results

# ──────────────────────────────────────────────────────────────
# NUMPY → PYTHON NATIVE TYPE CONVERTER
# ──────────────────────────────────────────────────────────────
def _to_py(obj):
    if isinstance(obj, dict):         return {k: _to_py(v) for k, v in obj.items()}
    if isinstance(obj, list):         return [_to_py(v) for v in obj]
    if isinstance(obj, np.bool_):     return bool(obj)
    if isinstance(obj, np.integer):   return int(obj)
    if isinstance(obj, np.floating):  return float(obj)
    if isinstance(obj, np.ndarray):   return obj.tolist()
    return obj


# ──────────────────────────────────────────────────────────────
# 1. LOAD & NORMALIZE
# ──────────────────────────────────────────────────────────────
df = pd.read_csv("agriculture_iot.csv")
df.columns = [" ".join(c.split()) for c in df.columns]

if "Random" in df.columns:
    df = df.drop(columns=["Random"])

ALL_FEATURES = [c for c in df.columns if c != "Class"]


def find_col(keywords: list) -> str:
    matches = []
    for col in ALL_FEATURES:
        col_l = col.lower()
        if all(k.lower() in col_l for k in keywords):
            matches.append(col)
    if not matches:
        raise KeyError(f"No column matched {keywords}. Available: {ALL_FEATURES}")
    return min(matches, key=len)


SELECTED_FEATURES = [
    find_col(["plant height rate"]),
    find_col(["leaf area"]),
    find_col(["dry matter", "vegetative growth"]),
    find_col(["root diameter"]),
    find_col(["wet weight", "root"]),
    find_col(["dry weight", "vegetative plant"]),
    find_col(["root length"]),
]

_ABBR_MAP = {
    "PHR":   ["plant height rate"],
    "ALAP":  ["leaf area"],
    "PDMVG": ["dry matter", "vegetative growth"],
    "ARD":   ["root diameter"],
    "AWWR":  ["wet weight", "root"],
    "ADWV":  ["dry weight", "vegetative plant"],
    "ARL":   ["root length"],
}

FEATURE_ABBR: dict[str, str] = {}
for abbr, kws in _ABBR_MAP.items():
    try:
        FEATURE_ABBR[find_col(kws)] = abbr
    except KeyError:
        pass

print("✓ SELECTED_FEATURES:", SELECTED_FEATURES)

# ──────────────────────────────────────────────────────────────
# [FIX-17] CACHE HELPERS
# ──────────────────────────────────────────────────────────────
def _csv_hash() -> str:
    """MD5 hash dari file CSV — dipakai untuk invalidasi cache."""
    h = hashlib.md5()
    with open("agriculture_iot.csv", "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _load_cache() -> dict | None:
    """
    Coba load cache dari model_cache.pkl.
    Return None jika tidak ada, versi tidak cocok, atau hash CSV berubah.
    """
    if not CACHE_FILE.exists():
        return None
    try:
        with open(CACHE_FILE, "rb") as f:
            cache = pickle.load(f)
        if cache.get("cache_version") != CONFIG["cache_version"]:
            print("⚠ Cache version mismatch — re-training...")
            return None
        if cache.get("csv_hash") != _csv_hash():
            print("⚠ Dataset changed — re-training...")
            return None
        print("✓ Cache valid — loading from model_cache.pkl (skip training)")
        return cache
    except Exception as e:
        print(f"⚠ Failed to load cache: {e} — re-training...")
        return None


def _save_cache(cache: dict) -> None:
    """Simpan semua artefak training ke model_cache.pkl."""
    try:
        with open(CACHE_FILE, "wb") as f:
            pickle.dump(cache, f, protocol=pickle.HIGHEST_PROTOCOL)
        print(f"✓ Cache saved to {CACHE_FILE} ({CACHE_FILE.stat().st_size // 1024} KB)")
    except Exception as e:
        print(f"⚠ Could not save cache: {e}")


# ──────────────────────────────────────────────────────────────
# 2. FEATURE MATRICES & CLASS LABELS
# ──────────────────────────────────────────────────────────────
X_all = df[ALL_FEATURES]
y     = df["Class"]
classes = sorted(y.unique().tolist())

class_dist_original = y.value_counts().to_dict()


def _stats(df_feat: pd.DataFrame, cols: list) -> dict:
    return {
        col: {
            "mean": float(df_feat[col].mean()),
            "std":  float(df_feat[col].std()),
            "min":  float(df_feat[col].min()),
            "max":  float(df_feat[col].max()),
            "q25":  float(df_feat[col].quantile(0.25)),
            "q75":  float(df_feat[col].quantile(0.75)),
        }
        for col in cols
    }


# ──────────────────────────────────────────────────────────────
# 3. AUGMENTASI
# ──────────────────────────────────────────────────────────────
def augment_relative_noise(X: pd.DataFrame, y: pd.Series,
                            noise_level: float = CONFIG["augment_noise_level"],
                            multiplier: int    = CONFIG["augment_multiplier"]) -> tuple:
    X_aug = X.reset_index(drop=True).copy()
    y_aug = y.reset_index(drop=True).copy()
    for _ in range(multiplier - 1):
        noise   = np.random.normal(0, noise_level, X.shape)
        X_noisy = (X + X * noise).reset_index(drop=True)
        y_copy  = y.reset_index(drop=True)
        X_aug   = pd.concat([X_aug, X_noisy], ignore_index=True)
        y_aug   = pd.concat([y_aug, y_copy],  ignore_index=True)
    return X_aug, y_aug


# ──────────────────────────────────────────────────────────────
# [FIX-17] TRAINING OR CACHE LOAD
# ──────────────────────────────────────────────────────────────
_cache = _load_cache()

if _cache is not None:
    # ── Restore semua artefak dari cache ──────────────────────
    scaler_sel           = _cache["scaler_sel"]
    scaler_full          = _cache["scaler_full"]
    dt_sel               = _cache["dt_sel"]
    dt_full              = _cache["dt_full"]
    nb_sel               = _cache["nb_sel"]
    nb_full              = _cache["nb_full"]
    shap_explainer_sel   = _cache["shap_explainer_sel"]
    stats_all            = _cache["stats_all"]
    stats_sel            = _cache["stats_sel"]
    stats_raw_sel        = _cache["stats_raw_sel"]
    _col_stds_sel_train  = _cache["col_stds_sel_train"]
    _col_stds_full_train = _cache["col_stds_full_train"]
    class_dist_train_raw = _cache["class_dist_train_raw"]
    class_dist_aug       = _cache["class_dist_aug"]
    corr_matrix          = _cache["corr_matrix"]
    per_class_stats_sel  = _cache["per_class_stats_sel"]
    metrics_dt_before    = _cache["metrics_dt_before"]
    metrics_nb_before    = _cache["metrics_nb_before"]
    metrics_dt_after     = _cache["metrics_dt_after"]
    metrics_nb_after     = _cache["metrics_nb_after"]
    stress_results       = _cache["stress_results"]
    rfe_ranking          = _cache["rfe_ranking"]
    _gs_full_best_params = _cache["gs_full_best_params"]
    _gs_sel_best_params  = _cache["gs_sel_best_params"]
    split_info_snapshot  = _cache["split_info_snapshot"]

else:
    # ── Full training pipeline ────────────────────────────────
    print("🔄 Cache tidak ditemukan — memulai training pipeline...")
    np.random.seed(CONFIG["random_seed"])

    # Split
    X_tr_raw_full, X_te_full, y_tr_raw_full, y_te_full = train_test_split(
        X_all, y,
        test_size=CONFIG["test_size"],
        random_state=CONFIG["random_seed"],
        stratify=y,
    )

    X_tr_raw_sel = X_tr_raw_full[SELECTED_FEATURES]
    X_te_sel_raw = X_te_full[SELECTED_FEATURES]

    X_tr_aug_full, y_tr_full = augment_relative_noise(X_tr_raw_full, y_tr_raw_full)
    X_tr_aug_sel,  y_tr_sel  = augment_relative_noise(X_tr_raw_sel,  y_tr_raw_full)

    X_te_full    = X_te_full.reset_index(drop=True)
    X_te_sel_raw = X_te_sel_raw.reset_index(drop=True)
    y_te_full    = y_te_full.reset_index(drop=True)
    y_te_sel     = y_te_full.copy()

    # Scaling
    scaler_sel = StandardScaler()
    scaler_sel.fit(X_tr_raw_sel)

    X_tr_sel_scaled = pd.DataFrame(
        scaler_sel.transform(X_tr_aug_sel), columns=SELECTED_FEATURES)
    X_te_sel_scaled = pd.DataFrame(
        scaler_sel.transform(X_te_sel_raw), columns=SELECTED_FEATURES)

    scaler_full = StandardScaler()
    scaler_full.fit(X_tr_raw_full)

    X_tr_full_scaled = pd.DataFrame(
        scaler_full.transform(X_tr_aug_full), columns=ALL_FEATURES)
    X_te_full_scaled = pd.DataFrame(
        scaler_full.transform(X_te_full), columns=ALL_FEATURES)

    print("✓ Scaling selesai.")

    # Stats
    stats_all = _stats(
        pd.DataFrame(scaler_full.transform(X_tr_raw_full), columns=ALL_FEATURES),
        ALL_FEATURES)
    stats_sel = _stats(
        pd.DataFrame(scaler_sel.transform(X_tr_raw_sel), columns=SELECTED_FEATURES),
        SELECTED_FEATURES)
    stats_raw_sel = _stats(X_tr_raw_sel, SELECTED_FEATURES)

    _col_stds_sel_train  = np.array([stats_sel[c]["std"]  for c in SELECTED_FEATURES])
    _col_stds_full_train = np.array([stats_all[c]["std"]  for c in ALL_FEATURES])

    class_dist_train_raw = y_tr_raw_full.value_counts().to_dict()
    class_dist_aug       = pd.Series(y_tr_full).value_counts().to_dict()

    corr_matrix = X_tr_sel_scaled.corr().round(3)

    X_tr_raw_sel_scaled = pd.DataFrame(
        scaler_sel.transform(X_tr_raw_sel), columns=SELECTED_FEATURES)
    per_class_stats_sel: dict[str, dict] = {}
    for cls in classes:
        mask   = y_tr_raw_full == cls
        subset = X_tr_raw_sel_scaled[mask.values]
        per_class_stats_sel[cls] = {
            col: {
                "mean": round(float(subset[col].mean()), 4),
                "std":  round(float(subset[col].std()),  4),
                "min":  round(float(subset[col].min()),  4),
                "max":  round(float(subset[col].max()),  4),
            }
            for col in SELECTED_FEATURES
        }

    print(f"✓ Train raw      : {len(X_tr_raw_full)} rows")
    print(f"✓ Train augmented: {len(X_tr_aug_full)} rows")
    print(f"✓ Test (original): {len(X_te_full)} rows")

    # Train models
    print("Tuning DT (full features)…")
    _gs_full = GridSearchCV(
        DecisionTreeClassifier(random_state=CONFIG["random_seed"]),
        DT_PARAM_GRID, cv=5, scoring="accuracy", n_jobs=-1)
    _gs_full.fit(
        pd.DataFrame(scaler_full.transform(X_tr_raw_full), columns=ALL_FEATURES),
        y_tr_raw_full)
    print(f"  Best DT (full): {_gs_full.best_params_}")
    _gs_full_best_params = _gs_full.best_params_

    dt_full = DecisionTreeClassifier(
        **_gs_full.best_params_, random_state=CONFIG["random_seed"])
    dt_full.fit(X_tr_full_scaled, y_tr_full)

    print("Tuning DT (selected features)…")
    _gs_sel = GridSearchCV(
        DecisionTreeClassifier(random_state=CONFIG["random_seed"]),
        DT_PARAM_GRID, cv=5, scoring="accuracy", n_jobs=-1)
    _gs_sel.fit(X_tr_raw_sel_scaled, y_tr_raw_full)
    print(f"  Best DT (sel) : {_gs_sel.best_params_}")
    _gs_sel_best_params = _gs_sel.best_params_

    dt_sel = DecisionTreeClassifier(
        **_gs_sel.best_params_, random_state=CONFIG["random_seed"])
    dt_sel.fit(X_tr_sel_scaled, y_tr_sel)

    nb_full = GaussianNB().fit(X_tr_full_scaled, y_tr_full)
    nb_sel  = GaussianNB().fit(X_tr_sel_scaled,  y_tr_sel)

    print("Building SHAP explainer…")
    shap_explainer_sel = shap.TreeExplainer(dt_sel)
    print("✓ SHAP explainer ready")

    # Metrics
    def compute_metrics(model, X_test, y_test, model_name: str) -> dict:
        y_pred = model.predict(X_test)
        acc  = accuracy_score(y_test, y_pred)
        prec = precision_score(y_test, y_pred, average="weighted", zero_division=0)
        rec  = recall_score(y_test, y_pred, average="weighted", zero_division=0)
        f1   = f1_score(y_test, y_pred, average="weighted", zero_division=0)
        cm   = confusion_matrix(y_test, y_pred, labels=classes).tolist()
        cr   = classification_report(y_test, y_pred, output_dict=True, zero_division=0)
        return {
            "model":            model_name,
            "accuracy":         round(acc  * 100, 4),
            "precision":        round(prec * 100, 4),
            "recall":           round(rec  * 100, 4),
            "f1_score":         round(f1   * 100, 4),
            "confusion_matrix": cm,
            "classes":          classes,
            "per_class": {
                cls: {
                    "precision": round(cr[cls]["precision"] * 100, 2),
                    "recall":    round(cr[cls]["recall"]    * 100, 2),
                    "f1":        round(cr[cls]["f1-score"]  * 100, 2),
                    "support":   int(cr[cls]["support"]),
                }
                for cls in classes if cls in cr
            },
        }

    metrics_dt_before = compute_metrics(dt_full, X_te_full_scaled, y_te_full, "Decision Tree (Before FS)")
    metrics_nb_before = compute_metrics(nb_full, X_te_full_scaled, y_te_full, "Naive Bayes (Before FS)")
    metrics_dt_after  = compute_metrics(dt_sel,  X_te_sel_scaled,  y_te_sel,  "Decision Tree (After FS)")
    metrics_nb_after  = compute_metrics(nb_sel,  X_te_sel_scaled,  y_te_sel,  "Naive Bayes (After FS)")

    print(f"✓ DT After FS: {metrics_dt_after['accuracy']}%")
    print(f"✓ NB After FS: {metrics_nb_after['accuracy']}%")

    # Stress test
    stress_results = []
    for level in NOISE_LEVELS:
        np.random.seed(0)
        noise_f = np.random.normal(0, level * _col_stds_full_train, X_te_full_scaled.shape)
        noise_s = np.random.normal(0, level * _col_stds_sel_train,  X_te_sel_scaled.shape)
        X_nf = X_te_full_scaled + noise_f
        X_ns = X_te_sel_scaled  + noise_s
        stress_results.append({
            "noise":     f"{int(level * 100)}%",
            "noise_val": level,
            "dt_before": round(accuracy_score(y_te_full, dt_full.predict(X_nf)) * 100, 4),
            "nb_before": round(accuracy_score(y_te_full, nb_full.predict(X_nf)) * 100, 4),
            "dt_after":  round(accuracy_score(y_te_sel,  dt_sel.predict(X_ns))  * 100, 4),
            "nb_after":  round(accuracy_score(y_te_sel,  nb_sel.predict(X_ns))  * 100, 4),
        })

    # RFE ranking
    _RFE_RANK_KEYWORDS = [
        (["plant height rate"],               1),
        (["leaf area"],                       1),
        (["dry matter", "vegetative growth"], 1),
        (["root diameter"],                   1),
        (["wet weight", "root"],              1),
        (["dry weight", "vegetative plant"],  1),
        (["root length"],                     1),
        (["chlorophyll"],                     2),
        (["wet weight", "growth vegetative"], 3),
        (["dry weight", "root"],              4),
        (["number", "plant leaves"],          5),
        (["dry matter", "root growth"],       6),
    ]
    rfe_ranking: dict[str, int] = {}
    for kws, rank in _RFE_RANK_KEYWORDS:
        try:
            rfe_ranking[find_col(kws)] = rank
        except KeyError:
            pass

    split_info_snapshot = {
        "train_rows_original":  int(len(X_tr_raw_full)),
        "train_rows_augmented": int(len(X_tr_aug_full)),
        "test_rows":            int(len(X_te_full)),
    }

    # ── Simpan semua ke cache ─────────────────────────────────
    _save_cache({
        "cache_version":       CONFIG["cache_version"],
        "csv_hash":            _csv_hash(),
        "scaler_sel":          scaler_sel,
        "scaler_full":         scaler_full,
        "dt_sel":              dt_sel,
        "dt_full":             dt_full,
        "nb_sel":              nb_sel,
        "nb_full":             nb_full,
        "shap_explainer_sel":  shap_explainer_sel,
        "stats_all":           stats_all,
        "stats_sel":           stats_sel,
        "stats_raw_sel":       stats_raw_sel,
        "col_stds_sel_train":  _col_stds_sel_train,
        "col_stds_full_train": _col_stds_full_train,
        "class_dist_train_raw":class_dist_train_raw,
        "class_dist_aug":      class_dist_aug,
        "corr_matrix":         corr_matrix,
        "per_class_stats_sel": per_class_stats_sel,
        "metrics_dt_before":   metrics_dt_before,
        "metrics_nb_before":   metrics_nb_before,
        "metrics_dt_after":    metrics_dt_after,
        "metrics_nb_after":    metrics_nb_after,
        "stress_results":      stress_results,
        "rfe_ranking":         rfe_ranking,
        "gs_full_best_params": _gs_full_best_params,
        "gs_sel_best_params":  _gs_sel_best_params,
        "split_info_snapshot": split_info_snapshot,
    })
    print("✓ Training selesai.")


# ──────────────────────────────────────────────────────────────
# AUDIT LOG
# ──────────────────────────────────────────────────────────────
def _load_audit() -> list:
    if AUDIT_FILE.exists():
        try:
            return json.loads(AUDIT_FILE.read_text())
        except Exception:
            return []
    return []

def _save_audit(log: list) -> None:
    try:
        AUDIT_FILE.write_text(json.dumps(log, indent=2))
    except Exception as e:
        print(f"[WARN] Could not save audit log: {e}")

prediction_log: list = _load_audit()
print(f"✓ Audit log loaded: {len(prediction_log)} existing entries")


# ──────────────────────────────────────────────────────────────
# HELPERS
# ──────────────────────────────────────────────────────────────
def _scale_input(input_dict: dict) -> pd.DataFrame:
    raw_df = pd.DataFrame([input_dict])[SELECTED_FEATURES]
    scaled = pd.DataFrame(
        scaler_sel.transform(raw_df), columns=SELECTED_FEATURES)
    return scaled


def _extract_decision_path(model: DecisionTreeClassifier,
                            input_df: pd.DataFrame,
                            feature_names: list) -> dict:
    tree_          = model.tree_
    node_indicator = model.decision_path(input_df)
    node_ids       = node_indicator.indices[
        node_indicator.indptr[0]: node_indicator.indptr[1]]

    path_nodes = []
    for node_id in node_ids:
        is_leaf   = bool(tree_.children_left[node_id] == -1)
        node_info: dict = {
            "node_id":  int(node_id),
            "is_leaf":  is_leaf,
            "samples":  int(tree_.n_node_samples[node_id]),
            "impurity": round(float(tree_.impurity[node_id]), 4),
        }
        if not is_leaf:
            feat_idx   = int(tree_.feature[node_id])
            threshold  = float(tree_.threshold[node_id])
            feat_name  = feature_names[feat_idx]
            input_val  = float(input_df.iloc[0, feat_idx])
            went_left  = bool(input_val <= threshold)
            node_info.update({
                "feature":     FEATURE_ABBR.get(feat_name, feat_name),
                "full_name":   feat_name,
                "threshold":   round(threshold, 4),
                "input_value": round(input_val, 4),
                "direction":   "left (≤)" if went_left else "right (>)",
            })
        else:
            class_idx = int(np.argmax(tree_.value[node_id]))
            node_info["predicted_class"] = str(model.classes_[class_idx])
        path_nodes.append(node_info)

    tree_text = export_text(model, feature_names=[
        FEATURE_ABBR.get(f, f) for f in feature_names
    ], max_depth=CONFIG["dt_tree_excerpt_depth"])

    return {
        "path_length":        len(path_nodes),
        "nodes":              path_nodes,
        "tree_rules_excerpt": tree_text[:CONFIG["dt_tree_excerpt_chars"]],
    }


def _shap_contribution(input_df_scaled: pd.DataFrame) -> list:
    shap_values    = shap_explainer_sel.shap_values(input_df_scaled)
    pred_class_idx = int(np.argmax(dt_sel.predict_proba(input_df_scaled)[0]))
    if isinstance(shap_values, list):
        sv = np.array(shap_values[pred_class_idx])
    else:
        sv = np.array(shap_values)
        if sv.ndim == 3:
            sv = sv[:, :, pred_class_idx]
    sv_row = np.array(sv[0]).flatten()
    result = []
    for i, feat in enumerate(SELECTED_FEATURES):
        val = float(sv_row[i])
        result.append({
            "feature":    FEATURE_ABBR.get(feat, feat),
            "full_name":  feat,
            "shap_value": round(val, 5),
            "direction":  "positive" if val >= 0 else "negative",
            "abs_impact": round(abs(val), 5),
        })
    result.sort(key=lambda x: x["abs_impact"], reverse=True)
    return result


def _noise_curve_for_input(input_df_scaled: pd.DataFrame,
                            pred_dt: str,
                            n_runs: int = CONFIG["noise_curve_runs"]) -> list:
    col_stds = _col_stds_sel_train
    base_arr = input_df_scaled.values
    curve = []
    consecutive_zero = 0
    for level in NOISE_LEVELS:
        if level == 0.0:
            curve.append({"noise": "0%", "noise_val": 0.0, "stability": 100.0})
            continue
        hits = 0
        for _ in range(n_runs):
            noise = np.random.normal(0, level * col_stds, base_arr.shape)
            noisy = pd.DataFrame(base_arr + noise, columns=SELECTED_FEATURES)
            if dt_sel.predict(noisy)[0] == pred_dt:
                hits += 1
        stability = round(float(hits) / n_runs * 100, 1)
        curve.append({"noise": f"{int(level * 100)}%", "noise_val": float(level), "stability": stability})
        consecutive_zero = consecutive_zero + 1 if stability == 0.0 else 0
        if consecutive_zero >= 2:
            for remaining in NOISE_LEVELS[len(curve):]:
                curve.append({"noise": f"{int(remaining * 100)}%", "noise_val": float(remaining), "stability": 0.0})
            break
    return curve


# ──────────────────────────────────────────────────────────────
# PDF REPORT GENERATOR
# ──────────────────────────────────────────────────────────────
def _cleanup_old_reports() -> None:
    pdfs = sorted(REPORTS_DIR.glob("*.pdf"), key=lambda p: p.stat().st_mtime)
    while len(pdfs) > CONFIG["max_reports"]:
        pdfs.pop(0).unlink(missing_ok=True)


def _generate_pdf(entry: dict, filepath: Path) -> None:
    doc    = SimpleDocTemplate(str(filepath), pagesize=A4,
                               leftMargin=2*cm, rightMargin=2*cm,
                               topMargin=2*cm, bottomMargin=2*cm)
    styles = getSampleStyleSheet()
    H1  = ParagraphStyle("H1",  parent=styles["Heading1"],  fontSize=16, spaceAfter=6,   textColor=colors.HexColor("#1a1a2e"))
    H2  = ParagraphStyle("H2",  parent=styles["Heading2"],  fontSize=12, spaceBefore=12, spaceAfter=4, textColor=colors.HexColor("#16213e"))
    NRM = ParagraphStyle("NRM", parent=styles["Normal"],    fontSize=9,  spaceAfter=3,   leading=13)
    story = []

    story.append(Paragraph("AgroAI Analytics — Prediction Report", H1))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#4a90d9")))
    story.append(Spacer(1, 0.3*cm))

    meta = [
        ["Timestamp",     entry.get("timestamp", "-")],
        ["Model Version", entry.get("model_version", "-")],
        ["Report Index",  str(entry.get("log_index", "-"))],
        ["OOD Warning",   "YES ⚠" if entry.get("ood_warning") else "No"],
    ]
    story.append(Paragraph("Metadata", H2))
    t = Table(meta, colWidths=[5*cm, 11*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0),(0,-1), colors.HexColor("#eef2ff")),
        ("FONTSIZE",   (0,0),(-1,-1), 9),
        ("GRID",       (0,0),(-1,-1), 0.5, colors.HexColor("#cccccc")),
        ("ROWBACKGROUNDS",(0,0),(-1,-1),[colors.white, colors.HexColor("#f8f9ff")]),
    ]))
    story.append(t)
    story.append(Spacer(1, 0.4*cm))

    story.append(Paragraph("Input Features (Raw, sebelum scaling)", H2))
    feat_rows = [["Feature", "Abbreviation", "Value (Raw)"]]
    for feat, val in entry.get("input_features_raw", {}).items():
        feat_rows.append([feat, FEATURE_ABBR.get(feat, feat), str(round(val, 4))])
    t2 = Table(feat_rows, colWidths=[8*cm, 3*cm, 5*cm])
    t2.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,0), colors.HexColor("#4a90d9")),
        ("TEXTCOLOR", (0,0),(-1,0), colors.white),
        ("FONTSIZE",  (0,0),(-1,-1), 9),
        ("GRID",      (0,0),(-1,-1), 0.5, colors.HexColor("#cccccc")),
        ("ROWBACKGROUNDS",(0,1),(-1,-1),[colors.white, colors.HexColor("#f0f4ff")]),
    ]))
    story.append(t2)
    story.append(Spacer(1, 0.4*cm))

    story.append(Paragraph("Prediction Results", H2))
    dt_pred = entry.get("decision_tree", {})
    nb_pred = entry.get("naive_bayes", {})
    cons    = entry.get("consensus_label", "-")
    pred_rows = [
        ["Model", "Prediction", "Confidence"],
        ["Decision Tree", dt_pred.get("prediction","-"), f"{dt_pred.get('confidence',0):.2f}%"],
        ["Naive Bayes",   nb_pred.get("prediction","-"), f"{nb_pred.get('confidence',0):.2f}%"],
        ["Consensus", cons, ""],
    ]
    t3 = Table(pred_rows, colWidths=[5*cm, 7*cm, 4*cm])
    t3.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,0), colors.HexColor("#16213e")),
        ("TEXTCOLOR", (0,0),(-1,0), colors.white),
        ("FONTSIZE",  (0,0),(-1,-1), 9),
        ("GRID",      (0,0),(-1,-1), 0.5, colors.HexColor("#cccccc")),
        ("ROWBACKGROUNDS",(0,1),(-1,-1),[colors.white, colors.HexColor("#f0f4ff")]),
        ("FONTNAME",  (0,3),(-1,3), "Helvetica-Bold"),
    ]))
    story.append(t3)
    story.append(Spacer(1, 0.4*cm))

    story.append(Paragraph("Feature Contribution (SHAP)", H2))
    shap_rows = [["Feature","Full Name","SHAP Value","Direction"]]
    for s in entry.get("xai_shap", []):
        shap_rows.append([s["feature"], s["full_name"], str(s["shap_value"]), s["direction"]])
    t4 = Table(shap_rows, colWidths=[3*cm, 8*cm, 3*cm, 3*cm])
    t4.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,0), colors.HexColor("#0f3460")),
        ("TEXTCOLOR", (0,0),(-1,0), colors.white),
        ("FONTSIZE",  (0,0),(-1,-1), 9),
        ("GRID",      (0,0),(-1,-1), 0.5, colors.HexColor("#cccccc")),
        ("ROWBACKGROUNDS",(0,1),(-1,-1),[colors.white, colors.HexColor("#f8f8ff")]),
    ]))
    story.append(t4)
    story.append(Spacer(1, 0.4*cm))

    story.append(Paragraph("Model Performance (After Feature Selection)", H2))
    acc_rows = [
        ["Metric","Decision Tree","Naive Bayes"],
        ["Accuracy",  f"{metrics_dt_after['accuracy']}%",  f"{metrics_nb_after['accuracy']}%"],
        ["Precision", f"{metrics_dt_after['precision']}%", f"{metrics_nb_after['precision']}%"],
        ["Recall",    f"{metrics_dt_after['recall']}%",    f"{metrics_nb_after['recall']}%"],
        ["F1 Score",  f"{metrics_dt_after['f1_score']}%",  f"{metrics_nb_after['f1_score']}%"],
    ]
    t5 = Table(acc_rows, colWidths=[5*cm, 5.5*cm, 5.5*cm])
    t5.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,0), colors.HexColor("#533483")),
        ("TEXTCOLOR", (0,0),(-1,0), colors.white),
        ("FONTSIZE",  (0,0),(-1,-1), 9),
        ("GRID",      (0,0),(-1,-1), 0.5, colors.HexColor("#cccccc")),
        ("ROWBACKGROUNDS",(0,1),(-1,-1),[colors.white, colors.HexColor("#f5f0ff")]),
    ]))
    story.append(t5)
    story.append(Spacer(1, 0.4*cm))

    dp = entry.get("decision_path", {})
    if dp:
        story.append(Paragraph("Decision Path (Decision Tree)", H2))
        story.append(Paragraph(f"Total nodes traversed: {dp.get('path_length', 0)}", NRM))
        for node in dp.get("nodes", []):
            if node.get("is_leaf"):
                txt = (f"<b>Leaf Node {node['node_id']}</b>: "
                       f"Predicted class = <b>{node.get('predicted_class','?')}</b>, "
                       f"samples = {node['samples']}")
            else:
                txt = (f"Node {node['node_id']}: <b>{node.get('feature','?')}</b> "
                       f"{node.get('direction','?')} threshold {node.get('threshold','?')} "
                       f"(input = {node.get('input_value','?')})")
            story.append(Paragraph(txt, NRM))

    story.append(Spacer(1, 0.5*cm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cccccc")))
    story.append(Paragraph(
        f"Generated by AgroAI Analytics API v3.4.0 · {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        ParagraphStyle("footer", parent=styles["Normal"], fontSize=7, textColor=colors.grey, spaceAfter=0)
    ))
    doc.build(story)
    _cleanup_old_reports()


# ──────────────────────────────────────────────────────────────
# API ENDPOINTS
# ──────────────────────────────────────────────────────────────

@app.get("/eda")
def get_eda():
    return _to_py({
        "dataset_info": {
            "total_rows_original":        int(len(df)),
            "total_rows_train_augmented": int(split_info_snapshot["train_rows_augmented"]),
            "total_features_before_fs":   len(ALL_FEATURES),
            "total_features_after_fs":    len(SELECTED_FEATURES),
            "total_train_original":       int(split_info_snapshot["train_rows_original"]),
            "total_train_augmented":      int(split_info_snapshot["train_rows_augmented"]),
            "total_test":                 int(split_info_snapshot["test_rows"]),
            "num_classes":                len(classes),
            "classes":                    classes,
            "augmentation_method": (
                f"relative Gaussian noise "
                f"(X + X * N(0, {CONFIG['augment_noise_level']})), "
                f"{CONFIG['augment_multiplier']}x multiplier (training only)"
            ),
            "scaling_method":     "StandardScaler, fit on train original only",
            "split_method":       "split-before-augment-before-scale (no leakage)",
            "corr_matrix_source": "training set scaled only (no leakage)",
            "per_class_source":   "training set scaled only (no leakage)",
        },
        "class_distribution": {
            "original_full_dataset": {str(k): int(v) for k, v in class_dist_original.items()},
            "train_raw":             {str(k): int(v) for k, v in class_dist_train_raw.items()},
            "train_augmented":       {str(k): int(v) for k, v in class_dist_aug.items()},
        },
        "feature_stats_all": {
            col: {k: round(v, 4) for k, v in s.items()} for col, s in stats_all.items()
        },
        "feature_stats_selected": {
            col: {k: round(v, 4) for k, v in s.items()} for col, s in stats_sel.items()
        },
        "feature_stats_raw_sel": {
            col: {k: round(v, 4) for k, v in s.items()} for col, s in stats_raw_sel.items()
        },
        "rfe_ranking":     rfe_ranking,
        "per_class_stats": per_class_stats_sel,
        "correlation_matrix": {
            "features": SELECTED_FEATURES,
            "data":     corr_matrix.values.tolist(),
            "source":   "training set scaled only",
        },
        "feature_abbr": FEATURE_ABBR,
        "scaler_params": {
            col: {
                "mean_":  round(float(scaler_sel.mean_[i]),  6),
                "scale_": round(float(scaler_sel.scale_[i]), 6),
            }
            for i, col in enumerate(SELECTED_FEATURES)
        },
    })


@app.get("/performance")
def get_performance():
    return _to_py({
        "metrics": {
            "before_fs": {"decision_tree": metrics_dt_before, "naive_bayes": metrics_nb_before},
            "after_fs":  {"decision_tree": metrics_dt_after,  "naive_bayes": metrics_nb_after},
        },
        "stress_test": stress_results,
        "feature_importance_dt": sorted([
            {
                "feature":    feat,
                "abbr":       FEATURE_ABBR.get(feat, feat),
                "importance": round(float(imp) * 100, 3),
            }
            for feat, imp in zip(SELECTED_FEATURES, dt_sel.feature_importances_)
        ], key=lambda x: x["importance"], reverse=True),
        "best_dt_params_full": _gs_full_best_params,
        "best_dt_params_sel":  _gs_sel_best_params,
        "split_info": {
            "method":               "split → augment → scale (no leakage)",
            "test_size":            CONFIG["test_size"],
            "train_rows_original":  int(split_info_snapshot["train_rows_original"]),
            "train_rows_augmented": int(split_info_snapshot["train_rows_augmented"]),
            "test_rows":            int(split_info_snapshot["test_rows"]),
            "augmentation": (
                f"relative Gaussian noise "
                f"(X + X * N(0, {CONFIG['augment_noise_level']})), "
                f"{CONFIG['augment_multiplier']}x (training only)"
            ),
            "scaling":             "StandardScaler fit on train original only",
            "gridsearch_on":       "scaled original training data (no CV leakage)",
            "model_final_fit_on":  "scaled augmented training data",
            "corr_matrix_source":  "training set scaled only",
            "per_class_source":    "training set scaled only",
            "stratified":          True,
        },
    })


class InputData(BaseModel):
    features: dict


@app.post("/predict")
def predict(data: InputData):
    input_dict_raw = dict(data.features)

    mean_raw = scaler_sel.inverse_transform(np.zeros((1, len(SELECTED_FEATURES))))[0]
    for i, f in enumerate(SELECTED_FEATURES):
        if f not in input_dict_raw:
            input_dict_raw[f] = float(mean_raw[i])

    input_df_scaled = _scale_input(input_dict_raw)

    ood_features = []
    for i, col in enumerate(SELECTED_FEATURES):
        val_scaled = float(input_df_scaled.iloc[0, i])
        mean = stats_sel[col]["mean"]
        std  = stats_sel[col]["std"]
        if std > 0 and abs(val_scaled - mean) > CONFIG["ood_zscore_threshold"] * std:
            ood_features.append({
                "feature":      col,
                "abbr":         FEATURE_ABBR.get(col, col),
                "value_raw":    round(float(input_dict_raw[col]), 4),
                "value_scaled": round(val_scaled, 4),
                "mean_scaled":  round(mean, 4),
                "z_score":      round((val_scaled - mean) / std, 2),
            })
    is_ood = bool(len(ood_features) > 0)

    pred_dt  = str(dt_sel.predict(input_df_scaled)[0])
    proba_dt = dt_sel.predict_proba(input_df_scaled)[0]
    conf_dt  = round(float(np.max(proba_dt)) * 100, 2)

    pred_nb  = str(nb_sel.predict(input_df_scaled)[0])
    proba_nb = nb_sel.predict_proba(input_df_scaled)[0]
    conf_nb  = round(float(np.max(proba_nb)) * 100, 2)

    consensus = bool(pred_dt == pred_nb)
    consensus_label = (
        f"✓ Verified Consensus — Both models predict: {pred_dt}"
        if consensus else
        f"⚠ Conflicting Predictions — "
        f"Decision Tree: {pred_dt} vs Naive Bayes: {pred_nb}. "
        f"Please recheck input data."
    )

    decision_path = _extract_decision_path(dt_sel, input_df_scaled, SELECTED_FEATURES)
    xai_shap      = _shap_contribution(input_df_scaled)

    xai_global = sorted([
        {
            "feature":    FEATURE_ABBR.get(feat, feat),
            "full_name":  feat,
            "importance": round(float(imp) * 100, 3),
        }
        for feat, imp in zip(SELECTED_FEATURES, dt_sel.feature_importances_)
    ], key=lambda x: x["importance"], reverse=True)

    benchmark = []
    for i, col in enumerate(SELECTED_FEATURES):
        val_scaled = float(input_df_scaled.iloc[0, i])
        mean = stats_sel[col]["mean"]
        std  = stats_sel[col]["std"]
        z    = (val_scaled - mean) / std if std > 0 else 0.0
        pct  = (val_scaled - stats_sel[col]["min"]) / max(
            stats_sel[col]["max"] - stats_sel[col]["min"], 1e-9) * 100
        status = (
            "above_average" if z >  CONFIG["benchmark_high_z"] else
            "below_average" if z <  CONFIG["benchmark_low_z"]  else
            "normal"
        )
        benchmark.append({
            "feature":      FEATURE_ABBR.get(col, col),
            "full_name":    col,
            "value_raw":    round(float(input_dict_raw[col]), 4),
            "value_scaled": round(val_scaled, 4),
            "mean":         round(mean, 4),
            "std":          round(std, 4),
            "z_score":      round(z, 3),
            "percentile":   round(float(pct), 1),
            "status":       status,
        })

    predicted_class_stats = per_class_stats_sel.get(pred_dt, {})
    benchmark_per_class   = []
    for i, col in enumerate(SELECTED_FEATURES):
        val_scaled = float(input_df_scaled.iloc[0, i])
        cls_mean   = predicted_class_stats.get(col, {}).get("mean", None)
        cls_std    = predicted_class_stats.get(col, {}).get("std",  None)
        if cls_mean is not None and cls_std is not None and cls_std > 0:
            z_cls      = (val_scaled - cls_mean) / cls_std
            status_cls = (
                "above_class_avg" if z_cls >  CONFIG["benchmark_high_z"] else
                "below_class_avg" if z_cls <  CONFIG["benchmark_low_z"]  else
                "normal"
            )
        else:
            z_cls, status_cls = 0.0, "normal"
        benchmark_per_class.append({
            "feature":          FEATURE_ABBR.get(col, col),
            "full_name":        col,
            "value_scaled":     round(val_scaled, 4),
            "class_mean":       round(cls_mean, 4) if cls_mean is not None else None,
            "class_std":        round(cls_std,  4) if cls_std  is not None else None,
            "z_score_in_class": round(z_cls, 3),
            "status":           status_cls,
        })

    noise_curve       = _noise_curve_for_input(input_df_scaled, pred_dt)
    sensitivity_score = next(
        (n["stability"] for n in noise_curve if n["noise_val"] == 0.10), 100.0)

    dt_class_proba = {str(cls): round(float(p)*100, 2) for cls, p in zip(dt_sel.classes_, proba_dt)}
    nb_class_proba = {str(cls): round(float(p)*100, 2) for cls, p in zip(nb_sel.classes_, proba_nb)}

    with _audit_lock:
        log_index = len(prediction_log)
        log_entry = _to_py({
            "log_index":          log_index,
            "timestamp":          datetime.now().isoformat(),
            "model_version":      "v3.4.0-DT-NB-FS7-SHAP-SCALED-PKL",
            "input_features_raw": {col: round(float(input_dict_raw[col]), 4) for col in SELECTED_FEATURES},
            "decision_tree":      {"prediction": pred_dt, "confidence": conf_dt, "class_probabilities": dt_class_proba},
            "naive_bayes":        {"prediction": pred_nb, "confidence": conf_nb, "class_probabilities": nb_class_proba},
            "consensus":          consensus,
            "consensus_label":    consensus_label,
            "ood_warning":        is_ood,
            "ood_features":       ood_features,
            "xai_shap":           xai_shap,
            "decision_path":      decision_path,
            "sensitivity_score":  sensitivity_score,
            "noise_curve":        noise_curve,
        })
        prediction_log.append(log_entry)
        if len(prediction_log) > CONFIG["max_audit_entries"]:
            prediction_log.pop(0)
        _save_audit(prediction_log)

    return _to_py({
        "status":              "success",
        "timestamp":           log_entry["timestamp"],
        "model_version":       "v3.4.0-DT-NB-FS7-SHAP-SCALED-PKL",
        "log_index":           log_index,
        "ood_warning":         is_ood,
        "ood_features":        ood_features,
        "decision_tree":       log_entry["decision_tree"],
        "naive_bayes":         log_entry["naive_bayes"],
        "consensus":           consensus,
        "consensus_label":     consensus_label,
        "decision_path":       decision_path,
        "xai_shap":            xai_shap,
        "xai_global":          xai_global,
        "benchmark":           benchmark,
        "benchmark_per_class": benchmark_per_class,
        "sensitivity_score":   sensitivity_score,
        "noise_curve":         noise_curve,
        "baseline_stats": {
            col: {k: round(v, 4) for k, v in s.items()} for col, s in stats_sel.items()
        },
    })


# ──────────────────────────────────────────────────────────────
# [NEW] BATCH PREDICT ENDPOINT
# ──────────────────────────────────────────────────────────────
@app.post("/batch-predict")
async def batch_predict(file: UploadFile = File(...)):
    """
    Upload file CSV dengan kolom fitur yang sama seperti input inferensi tunggal.
    Kolom bisa berupa nama fitur lengkap (full name) atau abbreviasi (PHR, ALAP, dll.).
    Mengembalikan batch_id yang bisa dipakai untuk download hasil CSV.

    Kolom output:
      row_index, <input features raw>, dt_prediction, dt_confidence,
      nb_prediction, nb_confidence, consensus, ood_warning, ood_feature_list
    """
    # Baca file CSV
    content = await file.read()
    try:
        batch_df = pd.read_csv(io.StringIO(content.decode("utf-8")))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Gagal membaca CSV: {e}")

    # Normalisasi kolom — coba mapping abbr → full name
    abbr_to_full = {v: k for k, v in FEATURE_ABBR.items()}
    rename_map = {}
    for col in batch_df.columns:
        if col in abbr_to_full:
            rename_map[col] = abbr_to_full[col]
    if rename_map:
        batch_df = batch_df.rename(columns=rename_map)

    # Cek apakah minimal ada 1 fitur yang dikenal
    found_features = [f for f in SELECTED_FEATURES if f in batch_df.columns]
    if len(found_features) == 0:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Tidak ada kolom yang cocok dengan fitur model. "
                f"Fitur yang dibutuhkan (nama lengkap atau abbr): "
                f"{list(FEATURE_ABBR.values())}. "
                f"Kolom yang ditemukan: {list(batch_df.columns)}"
            )
        )

    # Mean fallback untuk fitur yang tidak ada di CSV
    mean_raw = scaler_sel.inverse_transform(np.zeros((1, len(SELECTED_FEATURES))))[0]
    mean_fallback = {f: float(mean_raw[i]) for i, f in enumerate(SELECTED_FEATURES)}

    results = []
    for row_idx, row in batch_df.iterrows():
        # Buat input dict
        input_dict_raw: dict[str, float] = {}
        for i, feat in enumerate(SELECTED_FEATURES):
            if feat in batch_df.columns:
                val = row[feat]
                input_dict_raw[feat] = float(val) if pd.notna(val) else mean_fallback[feat]
            else:
                input_dict_raw[feat] = mean_fallback[feat]

        # Scale
        input_df_scaled = _scale_input(input_dict_raw)

        # OOD
        ood_list = []
        for i, col in enumerate(SELECTED_FEATURES):
            val_scaled = float(input_df_scaled.iloc[0, i])
            mean = stats_sel[col]["mean"]
            std  = stats_sel[col]["std"]
            if std > 0 and abs(val_scaled - mean) > CONFIG["ood_zscore_threshold"] * std:
                ood_list.append(FEATURE_ABBR.get(col, col))

        # Predict
        pred_dt  = str(dt_sel.predict(input_df_scaled)[0])
        proba_dt = dt_sel.predict_proba(input_df_scaled)[0]
        conf_dt  = round(float(np.max(proba_dt)) * 100, 2)

        pred_nb  = str(nb_sel.predict(input_df_scaled)[0])
        proba_nb = nb_sel.predict_proba(input_df_scaled)[0]
        conf_nb  = round(float(np.max(proba_nb)) * 100, 2)

        consensus = bool(pred_dt == pred_nb)

        result_row: dict = {"row_index": int(row_idx)}
        # Sertakan nilai input raw (abbr) agar CSV output informatif
        for feat in SELECTED_FEATURES:
            abbr = FEATURE_ABBR.get(feat, feat)
            result_row[abbr] = round(input_dict_raw[feat], 4)

        result_row.update({
            "dt_prediction": pred_dt,
            "dt_confidence": conf_dt,
            "nb_prediction": pred_nb,
            "nb_confidence": conf_nb,
            "consensus":     consensus,
            "ood_warning":   len(ood_list) > 0,
            "ood_features":  "|".join(ood_list) if ood_list else "",
        })
        results.append(result_row)

    result_df = pd.DataFrame(results)

    # Simpan ke memory store dan disk
    batch_id  = str(uuid.uuid4())[:8].upper()
    _batch_store[batch_id] = result_df

    batch_path = BATCH_DIR / f"batch_{batch_id}.csv"
    result_df.to_csv(batch_path, index=False)

    # Ringkasan distribusi kelas
    class_summary = result_df["dt_prediction"].value_counts().to_dict()
    consensus_rate = round(result_df["consensus"].mean() * 100, 1)
    ood_count      = int(result_df["ood_warning"].sum())

    return _to_py({
        "batch_id":      batch_id,
        "total_rows":    len(results),
        "results":       results,
        "summary": {
            "class_distribution": class_summary,
            "consensus_rate_pct": consensus_rate,
            "ood_rows":           ood_count,
            "ood_pct":            round(ood_count / max(len(results), 1) * 100, 1),
        },
    })


@app.get("/batch-download/{batch_id}")
def batch_download(batch_id: str):
    """Download hasil batch prediksi sebagai CSV."""
    batch_path = BATCH_DIR / f"batch_{batch_id}.csv"
    if not batch_path.exists():
        raise HTTPException(status_code=404, detail=f"Batch ID '{batch_id}' tidak ditemukan.")
    return FileResponse(
        path=str(batch_path),
        media_type="text/csv",
        filename=f"agroai_batch_{batch_id}.csv",
    )


# ──────────────────────────────────────────────────────────────
# What-If Analysis Endpoint
# ──────────────────────────────────────────────────────────────
class WhatIfRequest(BaseModel):
    features:     dict
    vary_feature: str
    range_min:    float
    range_max:    float
    steps:        int = 20


@app.post("/whatif")
def what_if(req: WhatIfRequest):
    abbr_to_full = {v: k for k, v in FEATURE_ABBR.items()}
    vary_col     = abbr_to_full.get(req.vary_feature, req.vary_feature)

    if vary_col not in SELECTED_FEATURES:
        raise HTTPException(
            status_code=400,
            detail=(f"Feature '{req.vary_feature}' not found. "
                    f"Valid: {list(FEATURE_ABBR.values()) + SELECTED_FEATURES}"),
        )

    mean_raw = scaler_sel.inverse_transform(np.zeros((1, len(SELECTED_FEATURES))))[0]
    base = dict(req.features)
    for i, f in enumerate(SELECTED_FEATURES):
        if f not in base:
            base[f] = float(mean_raw[i])

    steps  = max(2, min(req.steps, 100))
    values = np.linspace(req.range_min, req.range_max, steps)

    results = []
    for val in values:
        base[vary_col] = float(val)
        row_scaled = _scale_input(base)
        p_dt  = str(dt_sel.predict(row_scaled)[0])
        pr_dt = dt_sel.predict_proba(row_scaled)[0]
        p_nb  = str(nb_sel.predict(row_scaled)[0])
        pr_nb = nb_sel.predict_proba(row_scaled)[0]
        results.append({
            "vary_value":    round(float(val), 5),
            "dt_prediction": p_dt,
            "dt_confidence": round(float(np.max(pr_dt)) * 100, 2),
            "nb_prediction": p_nb,
            "nb_confidence": round(float(np.max(pr_nb)) * 100, 2),
            "consensus":     bool(p_dt == p_nb),
        })

    return _to_py({
        "vary_feature":      req.vary_feature,
        "vary_feature_full": vary_col,
        "range":             {"min": req.range_min, "max": req.range_max, "steps": steps},
        "results":           results,
    })


# ──────────────────────────────────────────────────────────────
# PDF Report Endpoint
# ──────────────────────────────────────────────────────────────
@app.get("/report/{log_index}")
def get_report(log_index: int):
    with _audit_lock:
        total = len(prediction_log)
        if log_index < 0 or log_index >= total:
            raise HTTPException(
                status_code=404,
                detail=f"Log index {log_index} not found. Total logs: {total}",
            )
        entry = prediction_log[log_index]
    ts_safe  = entry["timestamp"].replace(":", "-").replace(".", "-")
    filename = f"agroai_report_{log_index}_{ts_safe}.pdf"
    filepath = REPORTS_DIR / filename
    if not filepath.exists():
        _generate_pdf(entry, filepath)
    return FileResponse(path=str(filepath), media_type="application/pdf", filename=filename)


@app.get("/audit-log")
def get_audit_log():
    with _audit_lock:
        log_snapshot = prediction_log[-100:]
        total        = len(prediction_log)
    return _to_py({"log": log_snapshot, "total": total, "persistent": True, "file": str(AUDIT_FILE)})


@app.get("/health")
def health():
    with _audit_lock:
        audit_count = len(prediction_log)
    return _to_py({
        "status":              "ok",
        "version":             "3.4.0",
        "cache_file":          str(CACHE_FILE),
        "cache_exists":        CACHE_FILE.exists(),
        "cache_size_kb":       int(CACHE_FILE.stat().st_size // 1024) if CACHE_FILE.exists() else 0,
        "selected_features":   SELECTED_FEATURES,
        "pipeline_order":      "split → augment → scale → gridsearch → refit",
        "dt_best_params_sel":  _gs_sel_best_params,
        "shap_ready":          True,
        "audit_entries":       audit_count,
        "reports_dir":         str(REPORTS_DIR),
        "batch_dir":           str(BATCH_DIR),
        "scaler_sel_mean":     [round(float(m), 6) for m in scaler_sel.mean_],
        "scaler_sel_scale":    [round(float(s), 6) for s in scaler_sel.scale_],
    })