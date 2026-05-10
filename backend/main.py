from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import numpy as np
from sklearn.tree import DecisionTreeClassifier
from sklearn.naive_bayes import GaussianNB
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    confusion_matrix, classification_report,
)
from datetime import datetime

app = FastAPI(title="AgroAI Analytics API", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────
# 1. LOAD & NORMALIZE
# ─────────────────────────────────────────────
df = pd.read_csv("agriculture_iot.csv")

# Collapse all internal whitespace (fixes double-space column names in CSV)
df.columns = [" ".join(c.split()) for c in df.columns]

if "Random" in df.columns:
    df = df.drop(columns=["Random"])

ALL_FEATURES = [c for c in df.columns if c != "Class"]

# ── Helper: find column by substring keywords ─────────────────────────
def find_col(keywords: list) -> str:
    for col in ALL_FEATURES:
        col_l = col.lower()
        if all(k.lower() in col_l for k in keywords):
            return col
    raise KeyError(f"No column matched keywords {keywords}. Available: {ALL_FEATURES}")

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

FEATURE_ABBR = {}
for abbr, kws in _ABBR_MAP.items():
    try:
        FEATURE_ABBR[find_col(kws)] = abbr
    except KeyError:
        pass

print("✓ ALL_FEATURES:", ALL_FEATURES)
print("✓ SELECTED_FEATURES:", SELECTED_FEATURES)

# ─────────────────────────────────────────────
# 2. FEATURE MATRICES & CLASS LABELS
# ─────────────────────────────────────────────
X_all = df[ALL_FEATURES]
X_sel = df[SELECTED_FEATURES]
y     = df["Class"]
classes = sorted(y.unique().tolist())

def _stats(df_feat, cols):
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

# Stats dihitung dari SELURUH data original (untuk referensi EDA & OOD)
stats_all = _stats(X_all, ALL_FEATURES)
stats_sel = _stats(X_sel, SELECTED_FEATURES)

# ─────────────────────────────────────────────
# 3. SPLIT DULU, BARU AUGMENTASI
#
#    URUTAN YANG BENAR:
#    1. Split data ORIGINAL → train_raw / test_raw
#    2. Augmentasi HANYA pada train_raw
#    3. Evaluasi tetap pada test_raw (tidak terkontaminasi noise)
#
#    BUG LAMA: augmentasi dilakukan SEBELUM split → data test
#    mengandung sampel noise yang sangat mirip dengan training,
#    membuat DT bisa fit sempurna (akurasi 100% palsu).
# ─────────────────────────────────────────────
def augment_with_noise(X: pd.DataFrame, y: pd.Series,
                       noise_level: float = 0.20,
                       multiplier: int = 2) -> tuple:
    X_aug = X.copy()
    y_aug = y.copy()
    for _ in range(multiplier - 1):
        noise   = np.random.normal(0, noise_level, X.shape)
        X_noisy = X + (X * noise)
        X_aug   = pd.concat([X_aug, X_noisy], ignore_index=True)
        y_aug   = pd.concat([y_aug, y],        ignore_index=True)
    return X_aug, y_aug

np.random.seed(42)

# ── ALL FEATURES (Before FS) ──────────────────────────────────────────
# Step 1: split data original
X_tr_raw_full, X_te_full, y_tr_raw_full, y_te_full = train_test_split(
    X_all, y, test_size=0.2, random_state=42, stratify=y
)
# Step 2: augmentasi HANYA training
X_tr_full, y_tr_full = augment_with_noise(
    X_tr_raw_full, y_tr_raw_full, noise_level=0.20, multiplier=2
)

# ── SELECTED FEATURES (After FS) ─────────────────────────────────────
# Gunakan indeks split yang sama supaya test set identik
X_tr_raw_sel = X_tr_raw_full[SELECTED_FEATURES]
X_te_sel     = X_te_full[SELECTED_FEATURES]

X_tr_sel, y_tr_sel = augment_with_noise(
    X_tr_raw_sel, y_tr_raw_full, noise_level=0.20, multiplier=2
)
# y_te_sel sama dengan y_te_full (label tidak berubah, hanya kolom berbeda)
y_te_sel = y_te_full.reset_index(drop=True)

# Reset index test sets agar konsisten
X_te_full = X_te_full.reset_index(drop=True)
X_te_sel  = X_te_sel.reset_index(drop=True)
y_te_full = y_te_full.reset_index(drop=True)

print(f"✓ Train (augmented) : {len(X_tr_full)} rows")
print(f"✓ Test  (original)  : {len(X_te_full)} rows")

# ─────────────────────────────────────────────
# 4. TRAIN MODELS
# ─────────────────────────────────────────────
dt_full = DecisionTreeClassifier(random_state=42).fit(X_tr_full, y_tr_full)
nb_full = GaussianNB().fit(X_tr_full, y_tr_full)

dt_sel  = DecisionTreeClassifier(random_state=42).fit(X_tr_sel, y_tr_sel)
nb_sel  = GaussianNB().fit(X_tr_sel, y_tr_sel)

# ─────────────────────────────────────────────
# 5. PRECOMPUTE PERFORMANCE METRICS
# ─────────────────────────────────────────────
def compute_metrics(model, X_test, y_test, model_name):
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

# Evaluasi pada test_raw (data original, tidak terkontaminasi augmentasi)
metrics_dt_before = compute_metrics(dt_full, X_te_full, y_te_full, "Decision Tree (Before FS)")
metrics_nb_before = compute_metrics(nb_full, X_te_full, y_te_full, "Naive Bayes (Before FS)")
metrics_dt_after  = compute_metrics(dt_sel,  X_te_sel,  y_te_sel,  "Decision Tree (After FS)")
metrics_nb_after  = compute_metrics(nb_sel,  X_te_sel,  y_te_sel,  "Naive Bayes (After FS)")

print(f"✓ DT Before FS  accuracy: {metrics_dt_before['accuracy']}%")
print(f"✓ NB Before FS  accuracy: {metrics_nb_before['accuracy']}%")
print(f"✓ DT After  FS  accuracy: {metrics_dt_after['accuracy']}%")
print(f"✓ NB After  FS  accuracy: {metrics_nb_after['accuracy']}%")

# ─────────────────────────────────────────────
# 6. STRESS TEST (Precomputed)
#    Noise ditambahkan pada test_raw, bukan training
# ─────────────────────────────────────────────
NOISE_LEVELS = [0.0, 0.05, 0.10, 0.15, 0.20, 0.30, 0.40, 0.50]

stress_results = []
for level in NOISE_LEVELS:
    np.random.seed(0)
    nf = np.random.normal(0, level, X_te_full.shape)
    ns = np.random.normal(0, level, X_te_sel.shape)
    X_nf = X_te_full + (X_te_full * nf)
    X_ns = X_te_sel  + (X_te_sel  * ns)
    stress_results.append({
        "noise":     f"{int(level * 100)}%",
        "noise_val": level,
        "dt_before": round(accuracy_score(y_te_full, dt_full.predict(X_nf)) * 100, 4),
        "nb_before": round(accuracy_score(y_te_full, nb_full.predict(X_nf)) * 100, 4),
        "dt_after":  round(accuracy_score(y_te_sel,  dt_sel.predict(X_ns))  * 100, 4),
        "nb_after":  round(accuracy_score(y_te_sel,  nb_sel.predict(X_ns))  * 100, 4),
    })

# ─────────────────────────────────────────────
# 7. EDA PRECOMPUTATION
# ─────────────────────────────────────────────
class_dist     = y.value_counts().to_dict()
# Untuk class_dist augmented, hitung dari training augmented
class_dist_aug = pd.Series(y_tr_full).value_counts().to_dict()

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

rfe_ranking = {}
for kws, rank in _RFE_RANK_KEYWORDS:
    try:
        rfe_ranking[find_col(kws)] = rank
    except KeyError:
        pass

corr_matrix = X_sel.corr().round(3)

# ─────────────────────────────────────────────
# 8. PREDICTION LOG
# ─────────────────────────────────────────────
prediction_log = []

# ─────────────────────────────────────────────
# 9. API ENDPOINTS
# ─────────────────────────────────────────────

@app.get("/eda")
def get_eda():
    per_class_stats = {}
    for cls in classes:
        subset = X_sel[y == cls]
        per_class_stats[cls] = {
            col: {
                "mean": round(float(subset[col].mean()), 4),
                "std":  round(float(subset[col].std()),  4),
            }
            for col in SELECTED_FEATURES
        }

    return {
        "dataset_info": {
            "total_rows_original":      int(len(df)),
            "total_rows_augmented":     int(len(X_tr_full)),   # hanya training
            "total_features_before_fs": len(ALL_FEATURES),
            "total_features_after_fs":  len(SELECTED_FEATURES),
            "total_train":              int(len(X_tr_full)),
            "total_test":               int(len(X_te_full)),
            "num_classes":              len(classes),
            "classes":                  classes,
        },
        "class_distribution": {
            "original":  {str(k): int(v) for k, v in class_dist.items()},
            "augmented": {str(k): int(v) for k, v in class_dist_aug.items()},
        },
        "feature_stats_all": {
            col: {k: round(v, 4) for k, v in s.items()}
            for col, s in stats_all.items()
        },
        "feature_stats_selected": {
            col: {k: round(v, 4) for k, v in s.items()}
            for col, s in stats_sel.items()
        },
        "rfe_ranking":     rfe_ranking,
        "per_class_stats": per_class_stats,
        "correlation_matrix": {
            "features": SELECTED_FEATURES,
            "data":     corr_matrix.values.tolist(),
        },
        "feature_abbr": FEATURE_ABBR,
    }


@app.get("/performance")
def get_performance():
    return {
        "metrics": {
            "before_fs": {
                "decision_tree": metrics_dt_before,
                "naive_bayes":   metrics_nb_before,
            },
            "after_fs": {
                "decision_tree": metrics_dt_after,
                "naive_bayes":   metrics_nb_after,
            },
        },
        "stress_test": stress_results,
        "feature_importance_dt": [
            {
                "feature":    feat,
                "abbr":       FEATURE_ABBR.get(feat, feat),
                "importance": round(float(imp) * 100, 3),
            }
            for feat, imp in zip(SELECTED_FEATURES, dt_sel.feature_importances_)
        ],
        "split_info": {
            "method":       "split-before-augment",
            "test_size":    0.2,
            "train_rows":   int(len(X_tr_full)),
            "test_rows":    int(len(X_te_full)),
            "augmentation": "20% Gaussian noise, 2x multiplier (training only)",
            "stratified":   True,
        },
    }


class InputData(BaseModel):
    features: dict


@app.post("/predict")
def predict(data: InputData):
    input_dict = dict(data.features)

    # Fill missing selected features with dataset mean
    for f in SELECTED_FEATURES:
        if f not in input_dict:
            input_dict[f] = stats_sel[f]["mean"]

    input_df = pd.DataFrame([input_dict])[SELECTED_FEATURES]

    # ── OOD Detection (Z-score > 3σ) ──────────────────────────────────
    ood_features = []
    for col in SELECTED_FEATURES:
        val  = input_dict[col]
        mean = stats_sel[col]["mean"]
        std  = stats_sel[col]["std"]
        if std > 0 and abs(val - mean) > 3 * std:
            ood_features.append({
                "feature": col,
                "abbr":    FEATURE_ABBR.get(col, col),
                "value":   round(val,  4),
                "mean":    round(mean, 4),
                "z_score": round((val - mean) / std, 2),
            })
    is_ood = len(ood_features) > 0

    # ── Predictions ───────────────────────────────────────────────────
    pred_dt  = dt_sel.predict(input_df)[0]
    proba_dt = dt_sel.predict_proba(input_df)[0]
    conf_dt  = float(np.max(proba_dt) * 100)

    pred_nb  = nb_sel.predict(input_df)[0]
    proba_nb = nb_sel.predict_proba(input_df)[0]
    conf_nb  = float(np.max(proba_nb) * 100)

    consensus = pred_dt == pred_nb

    # ── XAI: Feature Importance ───────────────────────────────────────
    xai_data = sorted(
        [
            {
                "feature":    FEATURE_ABBR.get(feat, feat),
                "full_name":  feat,
                "importance": round(float(imp) * 100, 3),
            }
            for feat, imp in zip(SELECTED_FEATURES, dt_sel.feature_importances_)
        ],
        key=lambda x: x["importance"],
        reverse=True,
    )

    # ── Benchmark vs Population ───────────────────────────────────────
    benchmark = []
    for col in SELECTED_FEATURES:
        val  = input_dict[col]
        mean = stats_sel[col]["mean"]
        std  = stats_sel[col]["std"]
        z    = (val - mean) / std if std > 0 else 0
        pct  = (val - stats_sel[col]["min"]) / max(
            stats_sel[col]["max"] - stats_sel[col]["min"], 1e-9
        ) * 100
        status = (
            "above_average" if z >  1.5 else
            "below_average" if z < -1.5 else
            "normal"
        )
        benchmark.append({
            "feature":    FEATURE_ABBR.get(col, col),
            "full_name":  col,
            "value":      round(val,  4),
            "mean":       round(mean, 4),
            "std":        round(std,  4),
            "z_score":    round(z,    3),
            "percentile": round(float(pct), 1),
            "status":     status,
        })

    # ── Noise Sensitivity (20 Monte Carlo runs @ 5% noise) ───────────
    np.random.seed(None)   # non-deterministic per call
    sens = []
    for _ in range(20):
        noise = np.random.normal(0, 0.05, input_df.shape)
        p = dt_sel.predict(input_df + (input_df * noise))[0]
        sens.append(1 if p == pred_dt else 0)
    sensitivity_score = round(float(np.mean(sens)) * 100, 1)

    # ── Class Probabilities ───────────────────────────────────────────
    dt_class_proba = {
        cls: round(float(p) * 100, 2)
        for cls, p in zip(dt_sel.classes_, proba_dt)
    }
    nb_class_proba = {
        cls: round(float(p) * 100, 2)
        for cls, p in zip(nb_sel.classes_, proba_nb)
    }

    # ── Audit Log ─────────────────────────────────────────────────────
    log_entry = {
        "timestamp":     datetime.now().isoformat(),
        "session_model": "v2.0-DT-NB-FS7",
        "input":         {k: round(float(v), 4) for k, v in input_dict.items()},
        "predictions":   {
            "dt":        str(pred_dt),
            "nb":        str(pred_nb),
            "consensus": consensus,
        },
        "ood": is_ood,
    }
    prediction_log.append(log_entry)
    if len(prediction_log) > 500:
        prediction_log.pop(0)

    return {
        "status":            "success",
        "timestamp":         log_entry["timestamp"],
        "model_version":     "v2.0-DT-NB-FS7",
        "ood_warning":       is_ood,
        "ood_features":      ood_features,
        "decision_tree":     {
            "prediction":         str(pred_dt),
            "confidence":         round(conf_dt, 2),
            "class_probabilities": dt_class_proba,
        },
        "naive_bayes":       {
            "prediction":         str(pred_nb),
            "confidence":         round(conf_nb, 2),
            "class_probabilities": nb_class_proba,
        },
        "consensus":         consensus,
        "xai_contribution":  xai_data,
        "benchmark":         benchmark,
        "sensitivity_score": sensitivity_score,
        "baseline_stats":    {
            col: {k: round(v, 4) for k, v in s.items()}
            for col, s in stats_sel.items()
        },
    }


@app.get("/audit-log")
def get_audit_log():
    return {"log": prediction_log[-100:], "total": len(prediction_log)}


@app.get("/health")
def health():
    return {
        "status":            "ok",
        "version":           "2.0",
        "selected_features": SELECTED_FEATURES,
        "split_method":      "split-before-augment",
        "train_rows":        int(len(X_tr_full)),
        "test_rows":         int(len(X_te_full)),
    }