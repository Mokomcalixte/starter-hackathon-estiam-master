"""
Pôle 3 — Sujet B : Dashboard d'analyse d'audience & rétention
=============================================================
Lancement :  streamlit run dashboard.py

Quatre onglets :
  1. Vue d'ensemble  — comparaison des vidéos, classement rétention
  2. Détail vidéo    — courbe de rétention + zones d'ennui détectées
  3. Modèle          — prédiction de rétention, métriques, features
  4. Validation      — précision/rappel de la détection vs corrigé
"""

import numpy as np
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
import streamlit as st

import retention_analysis as ra

st.set_page_config(page_title="Audience & Rétention — 42c × ESTIAM",
                   layout="wide", page_icon="🎬")

ACCENT = "#e0218a"
INK = "#1a1030"


@st.cache_data
def load():
    logs, videos, gt = ra.load_data("data")
    ret = ra.compute_retention(logs)
    feat = ra.build_features(logs, videos)
    model, metrics, coefs, result, cols = ra.train_retention_model(feat, ret)
    det, per_video = ra.validate_detection(logs, videos, gt)
    cat = videos.merge(ret, on="video_id")
    return logs, videos, gt, ret, feat, metrics, coefs, result, det, per_video, cat


logs, videos, gt, ret, feat, metrics, coefs, result, det, per_video, cat = load()

st.title("🎬 Analyse d'audience & prédiction de rétention")
st.caption("Pôle 3 · Sujet B — V-Secure & Collaborate · 42c × ESTIAM 2026")

# KPI row
c1, c2, c3, c4 = st.columns(4)
c1.metric("Vidéos analysées", len(videos))
c2.metric("Sessions", logs["session_id"].nunique())
c3.metric("Rétention moyenne", f"{ret['retention'].mean():.0%}")
c4.metric("MAE du modèle", f"{metrics['MAE']:.3f}",
          f"-{(1-metrics['MAE']/metrics['MAE_baseline'])*100:.0f}% vs baseline",
          delta_color="inverse")

tab1, tab2, tab3, tab4 = st.tabs(
    ["📊 Vue d'ensemble", "🎯 Détail vidéo", "🤖 Modèle", "✅ Validation détection"]
)

# ----------------------------------------------------------------------
# TAB 1 — Vue d'ensemble
# ----------------------------------------------------------------------
with tab1:
    st.subheader("Quelles vidéos retiennent le mieux ?")
    df = cat.sort_values("retention")
    fig = px.bar(df, x="retention", y="title", orientation="h",
                 color="category", text=df["retention"].map("{:.0%}".format),
                 labels={"retention": "Taux de rétention", "title": ""})
    fig.update_layout(height=650, legend_title="Catégorie")
    st.plotly_chart(fig, use_container_width=True)

    col1, col2 = st.columns(2)
    with col1:
        st.markdown("**Rétention moyenne par catégorie**")
        bycat = cat.groupby("category")["retention"].mean().sort_values()
        st.plotly_chart(
            px.bar(bycat, labels={"value": "Rétention", "category": ""})
            .update_layout(showlegend=False, height=320),
            use_container_width=True)
    with col2:
        st.markdown("**Rétention vs durée de la vidéo**")
        st.plotly_chart(
            px.scatter(cat, x="duration_sec", y="retention", color="category",
                       hover_name="title",
                       labels={"duration_sec": "Durée (s)", "retention": "Rétention"})
            .update_layout(height=320),
            use_container_width=True)

    st.info("💡 **Lecture business** : les vidéos courtes type *Onboarding* et "
            "*Tutoriel* retiennent mieux. Les longues *Produit/Conférence* perdent "
            "l'audience — à raccourcir ou découper en chapitres.")

# ----------------------------------------------------------------------
# TAB 2 — Détail vidéo
# ----------------------------------------------------------------------
with tab2:
    vid = st.selectbox("Choisir une vidéo",
                       videos["video_id"],
                       format_func=lambda v: f"{v} — {videos.loc[videos.video_id==v,'title'].iloc[0]} "
                                             f"({videos.loc[videos.video_id==v,'category'].iloc[0]})")
    dur = int(videos.loc[videos.video_id == vid, "duration_sec"].iloc[0])
    positions, survival, _ = ra.retention_curve(logs, vid)
    spans, bins, hist = ra.detect_hotspots(logs, vid, dur)
    truth = list(gt[gt.video_id == vid][["hotspot_start", "hotspot_end"]]
                 .itertuples(index=False, name=None))

    fig = go.Figure()
    fig.add_trace(go.Scatter(x=positions, y=survival*100, mode="lines",
                             name="% audience présente", line=dict(color=ACCENT, width=3),
                             fill="tozeroy", fillcolor="rgba(224,33,138,0.12)"))
    for i, (s, e) in enumerate(spans):
        fig.add_vrect(x0=s, x1=e, fillcolor="orange", opacity=0.22, line_width=0,
                      annotation_text="ennui détecté" if i == 0 else None)
    for i, (s, e) in enumerate(truth):
        fig.add_vrect(x0=s, x1=e, line=dict(color="red", dash="dot", width=2),
                      fillcolor="rgba(0,0,0,0)",
                      annotation_text="corrigé" if i == 0 else None,
                      annotation_position="bottom")
    fig.update_layout(height=420, xaxis_title="Position dans la vidéo (s)",
                      yaxis_title="% d'audience encore présente",
                      title=f"Courbe de rétention — {vid}")
    st.plotly_chart(fig, use_container_width=True)

    cc1, cc2, cc3 = st.columns(3)
    cc1.metric("Rétention", f"{ret.loc[ret.video_id==vid,'retention'].iloc[0]:.0%}")
    cc2.metric("Zones d'ennui détectées", len(spans))
    cc3.metric("Zones dans le corrigé", len(truth))
    st.caption("🟧 zones détectées par notre méthode · ⌐ rouge pointillé = corrigé "
               "fourni (sert uniquement à valider).")

# ----------------------------------------------------------------------
# TAB 3 — Modèle
# ----------------------------------------------------------------------
with tab3:
    st.subheader("Prédiction de rétention — sans fuite de cible")
    m1, m2, m3 = st.columns(3)
    m1.metric("MAE (Leave-One-Out)", f"{metrics['MAE']:.4f}")
    m2.metric("R²", f"{metrics['R2']:.3f}")
    m3.metric("MAE baseline", f"{metrics['MAE_baseline']:.4f}",
              "prédire la moyenne", delta_color="off")

    st.markdown("**Prédit vs réel** (chaque point = une vidéo, validée hors échantillon)")
    fig = px.scatter(result, x="retention", y="retention_pred", hover_name="video_id",
                     labels={"retention": "Rétention réelle", "retention_pred": "Rétention prédite"})
    lim = [result[["retention", "retention_pred"]].min().min(),
           result[["retention", "retention_pred"]].max().max()]
    fig.add_trace(go.Scatter(x=lim, y=lim, mode="lines", name="parfait",
                             line=dict(dash="dash", color="gray")))
    fig.update_layout(height=420)
    st.plotly_chart(fig, use_container_width=True)

    st.markdown("**Features utilisées** (toutes indépendantes du dénouement)")
    cf = pd.DataFrame({"feature": list(coefs.keys()),
                       "poids": list(coefs.values())}).sort_values("poids")
    st.plotly_chart(
        px.bar(cf, x="poids", y="feature", orientation="h",
               color="poids", color_continuous_scale="RdBu")
        .update_layout(height=380, showlegend=False),
        use_container_width=True)

    st.warning("🚫 **Anti-fuite de cible** : on n'utilise PAS la rétention, ni "
               "« position moyenne atteinte », ni le corrigé. Uniquement : catégorie, "
               "durée, engagement précoce (% présents à 10%), nb de pauses & retours arrière.")

# ----------------------------------------------------------------------
# TAB 4 — Validation détection
# ----------------------------------------------------------------------
with tab4:
    st.subheader("Détection des zones d'ennui — mesurée, pas affirmée")
    v1, v2, v3 = st.columns(3)
    v1.metric("Précision", f"{det['precision']:.0%}")
    v2.metric("Rappel", f"{det['recall']:.0%}")
    v3.metric("F1-score", f"{det['f1']:.2f}")

    st.markdown(f"**TP={det['TP']} · FP={det['FP']} · FN={det['FN']}** "
                f"(overlap avec `ground_truth_hotspots.csv`)")
    st.dataframe(
        per_video[per_video[["FP", "FN"]].sum(axis=1) > 0]
        .rename(columns={"video_id": "vidéo (erreurs)"}),
        use_container_width=True, hide_index=True)
    st.caption("Le corrigé sert seulement à mesurer la qualité de la détection — "
               "il n'est jamais utilisé pour produire les zones.")
