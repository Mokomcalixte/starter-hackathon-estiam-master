# 🐍 Mise en place Python (Pôle 3) — suggestion, optionnelle

> **Coup de pouce, pas une obligation.** Vous êtes **libres** de votre stack. Voici un
> point de départ qui tourne **en local**, sans clé API payante.

## Environnement virtuel

```bash
python3 -m venv .venv
source .venv/bin/activate          # Windows : .venv\Scripts\activate
pip install -U pip
```

## P3-A — Indexation / NLP (suggestion)

```
faster-whisper          # transcription (CPU, léger)
ollama                  # client LLM local : résumé / traduction / chapitres / mots-clés
fastapi
uvicorn[standard]
# optionnels : keybert, scikit-learn  (mots-clés sans LLM)
```
`ffmpeg` est requis (extraction audio) : via Docker (`mwader/static-ffmpeg`) ou installé sur le poste.

## P3-B — Analyse d'audience (suggestion)

```
pandas
scikit-learn
streamlit
matplotlib
```

## Installer

Copiez les lignes voulues dans un `requirements.txt`, puis :

```bash
pip install -r requirements.txt
```

> Modèles **légers** conseillés (Whisper `tiny`/`base`/`small`, LLM 1B) — pré-téléchargeables
> avec [`scripts/prefetch.sh`](../scripts/prefetch.sh).
