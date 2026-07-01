"""
Pôle 3 — Sujet B : Analyse d'audience & prédiction de rétention
================================================================
Module cœur (logique métier réutilisable par le dashboard et par une API).

Trois briques :
  1. compute_retention()       -> cible (rétention par vidéo) + courbes
  2. build_features()          -> features SANS fuite de cible
  3. train_retention_model()   -> modèle + métriques honnêtes (LOO CV)
  4. detect_hotspots()         -> zones d'ennui (validées contre le corrigé)

Règle d'or respectée : la rétention et ground_truth_hotspots.csv servent
UNIQUEMENT à valider, jamais à nourrir le modèle.
"""

from __future__ import annotations
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import LeaveOneOut, cross_val_predict
from sklearn.metrics import mean_absolute_error, r2_score

EVENT_DIFFICULTY = ["pause", "seek_back", "abandon"]


# ----------------------------------------------------------------------
# Chargement
# ----------------------------------------------------------------------
def load_data(data_dir: str = "../data"):
    logs = pd.read_csv(f"{data_dir}/viewing_logs.csv")
    videos = pd.read_csv(f"{data_dir}/videos.csv")
    gt = pd.read_csv(f"{data_dir}/ground_truth_hotspots.csv")
    return logs, videos, gt


# ----------------------------------------------------------------------
# 1. CIBLE — rétention (sert à valider, jamais en feature)
# ----------------------------------------------------------------------
def compute_retention(logs: pd.DataFrame) -> pd.DataFrame:
    """Rétention par vidéo = moyenne sur les sessions de position_max / durée."""
    pos_max = (
        logs.groupby(["session_id", "video_id", "video_duration_sec"])["position_sec"]
        .max()
        .reset_index()
    )
    pos_max["retention_session"] = (
        pos_max["position_sec"] / pos_max["video_duration_sec"]
    )
    ret = (
        pos_max.groupby("video_id")["retention_session"]
        .mean()
        .rename("retention")
        .reset_index()
    )
    return ret


def retention_curve(logs: pd.DataFrame, video_id: str, n_points: int = 50):
    """Courbe de rétention : % de sessions encore présentes à chaque position."""
    vl = logs[logs.video_id == video_id]
    dur = vl["video_duration_sec"].iloc[0]
    sess_max = vl.groupby("session_id")["position_sec"].max()
    n = len(sess_max)
    positions = np.linspace(0, dur, n_points)
    survival = [(sess_max >= p).sum() / n for p in positions]
    return positions, np.array(survival), dur


# ----------------------------------------------------------------------
# 2. FEATURES — strictement SANS fuite de cible
# ----------------------------------------------------------------------
def build_features(logs: pd.DataFrame, videos: pd.DataFrame) -> pd.DataFrame:
    """
    Signaux disponibles AVANT de connaître le dénouement :
      - category, duration_sec        (caractéristiques vidéo)
      - early_engage                  (% présents après 10% de la vidéo)
      - pauses_per_sess, seekback_per_sess  (signes de difficulté)
    AUCUNE feature ne recopie la rétention.
    """
    feat = videos.set_index("video_id")[["category", "duration_sec"]].copy()

    # engagement précoce : % de sessions encore là après les 10 premiers %
    def early(g):
        dur = g["video_duration_sec"].iloc[0]
        sess = g.groupby("session_id")["position_sec"].max()
        return (sess >= 0.10 * dur).mean()

    feat["early_engage"] = logs.groupby("video_id").apply(early, include_groups=False)

    nsess = logs.groupby("video_id")["session_id"].nunique()
    ev = logs[logs.event_type.isin(["pause", "seek_back"])]
    cnt = ev.groupby(["video_id", "event_type"]).size().unstack(fill_value=0)
    feat["pauses_per_sess"] = (cnt.get("pause", 0) / nsess).fillna(0)
    feat["seekback_per_sess"] = (cnt.get("seek_back", 0) / nsess).fillna(0)
    return feat.reset_index()


# ----------------------------------------------------------------------
# 3. MODÈLE — métriques honnêtes par Leave-One-Out (25 vidéos = petit jeu)
# ----------------------------------------------------------------------
def train_retention_model(features: pd.DataFrame, retention: pd.DataFrame):
    df = features.merge(retention, on="video_id")
    X = pd.get_dummies(
        df.drop(columns=["video_id", "retention"]), columns=["category"]
    )
    y = df["retention"]

    model = LinearRegression()
    # LOO : chaque vidéo prédite par un modèle entraîné sur les 24 autres
    pred = cross_val_predict(model, X, y, cv=LeaveOneOut())
    metrics = {
        "MAE": mean_absolute_error(y, pred),
        "R2": r2_score(y, pred),
        "MAE_baseline": mean_absolute_error(y, [y.mean()] * len(y)),
    }
    model.fit(X, y)  # modèle final sur tout
    coefs = dict(zip(X.columns, model.coef_))

    result = df[["video_id", "retention"]].copy()
    result["retention_pred"] = pred
    return model, metrics, coefs, result, list(X.columns)


# ----------------------------------------------------------------------
# 4. DÉTECTION zones d'ennui + validation contre le corrigé
# ----------------------------------------------------------------------
def detect_hotspots(logs, video_id, duration, bucket=10, z_thresh=1.0):
    """Zones où pauses/seek_back/abandons sont anormalement concentrés."""
    bins = np.arange(0, duration + bucket, bucket)
    sub = logs[
        (logs.video_id == video_id)
        & (logs.event_type.isin(EVENT_DIFFICULTY))
    ]
    if len(sub) == 0:
        return [], bins, np.zeros(len(bins) - 1)
    h, _ = np.histogram(sub["position_sec"], bins=bins)
    if h.std() == 0:
        return [], bins, h
    z = (h - h.mean()) / h.std()
    hot = np.where(z >= z_thresh)[0]
    spans = []
    for b in hot:
        s, e = int(bins[b]), int(bins[b + 1])
        if spans and s <= spans[-1][1] + bucket:
            spans[-1] = (spans[-1][0], e)
        else:
            spans.append((s, e))
    return spans, bins, h


def _overlap(a, b):
    return max(0, min(a[1], b[1]) - max(a[0], b[0]))


def validate_detection(logs, videos, gt, **kw):
    """Précision / rappel / F1 mesurés contre ground_truth_hotspots.csv."""
    tp = fp = fn = 0
    per_video = []
    for vid in videos.video_id:
        dur = videos.loc[videos.video_id == vid, "duration_sec"].iloc[0]
        detected, _, _ = detect_hotspots(logs, vid, dur, **kw)
        truth = list(
            gt[gt.video_id == vid][["hotspot_start", "hotspot_end"]].itertuples(
                index=False, name=None
            )
        )
        matched = set()
        v_tp = v_fp = 0
        for d in detected:
            hit = [i for i, t in enumerate(truth) if _overlap(d, t) > 0]
            if hit:
                v_tp += 1
                matched.update(hit)
            else:
                v_fp += 1
        v_fn = len(truth) - len(matched)
        tp += v_tp; fp += v_fp; fn += v_fn
        per_video.append({"video_id": vid, "TP": v_tp, "FP": v_fp, "FN": v_fn})

    prec = tp / (tp + fp) if tp + fp else 0
    rec = tp / (tp + fn) if tp + fn else 0
    f1 = 2 * prec * rec / (prec + rec) if prec + rec else 0
    return {
        "precision": prec, "recall": rec, "f1": f1,
        "TP": tp, "FP": fp, "FN": fn,
    }, pd.DataFrame(per_video)


# ----------------------------------------------------------------------
# Démo CLI
# ----------------------------------------------------------------------
if __name__ == "__main__":
    logs, videos, gt = load_data()
    ret = compute_retention(logs)
    feat = build_features(logs, videos)
    model, metrics, coefs, result, cols = train_retention_model(feat, ret)

    print("=== MODÈLE DE RÉTENTION (Leave-One-Out) ===")
    print(f"  MAE            : {metrics['MAE']:.4f}")
    print(f"  R²             : {metrics['R2']:.3f}")
    print(f"  MAE baseline   : {metrics['MAE_baseline']:.4f}  (prédire la moyenne)")
    print(f"  -> gain        : {(1-metrics['MAE']/metrics['MAE_baseline'])*100:.0f}% mieux que la baseline\n")

    det, per_video = validate_detection(logs, videos, gt)
    print("=== DÉTECTION ZONES D'ENNUI (vs corrigé) ===")
    print(f"  Précision={det['precision']:.2f}  Rappel={det['recall']:.2f}  F1={det['f1']:.2f}")
    print(f"  TP={det['TP']} FP={det['FP']} FN={det['FN']}")
