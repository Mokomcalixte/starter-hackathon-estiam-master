#!/usr/bin/env bash
# =============================================================================
#  prefetch.sh — COUP DE POUCE (totalement optionnel)
#
#  Le réseau du lieu peut être lent ou saturé. Ce script PRÉ-TÉLÉCHARGE, AVANT
#  l'événement, des ressources COURANTES pour que tout fonctionne ensuite
#  100 % hors-ligne : dépendances du starter, images Docker, modèles Whisper/Ollama.
#
#  ⚠️ CE N'EST QU'UNE AIDE, ET UNE SUGGESTION. Vous êtes entièrement LIBRES de
#     choisir vos propres outils, bibliothèques, modèles et images : ce script ne
#     présume RIEN de votre solution et ne fait que pré-charger des choix répandus.
#     Chaque étape est indépendante — ce qui échoue, ou ne vous concerne pas, est
#     simplement ignoré (le script ne s'arrête pas).
#
#  🪟 Windows : exécutez ce script via WSL2 ou Git Bash. En PowerShell natif,
#     utilisez plutôt l'équivalent fourni : scripts/prefetch.ps1
#
#  Usage :   ./scripts/prefetch.sh
#  Réglages (variables d'environnement, toutes optionnelles) :
#     OLLAMA_MODEL=llama3.2:1b   WHISPER_MODEL=small
#     SKIP_NPM=1   SKIP_DOCKER=1   SKIP_MODELS=1
# =============================================================================
set -uo pipefail   # volontairement PAS de -e : on continue même si une étape échoue

OLLAMA_MODEL="${OLLAMA_MODEL:-llama3.2:1b}"
WHISPER_MODEL="${WHISPER_MODEL:-small}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

bold() { printf '\n\033[1m%s\033[0m\n' "$*"; }
ok()   { printf '  ✅ %s\n' "$*"; }
warn() { printf '  ⚠️  %s\n' "$*"; }
have() { command -v "$1" >/dev/null 2>&1; }

bold "🎁 prefetch.sh — COUP DE POUCE (optionnel, libre à vous de l'ignorer)"
echo  "   Pré-télécharge des ressources COURANTES pour pouvoir travailler hors-ligne."
echo  "   👉 Vous restez LIBRES de choisir d'autres outils / modèles / images."

# --- 1/4 — Dépendances npm du starter (backend + frontend) -------------------
if [ "${SKIP_NPM:-0}" != "1" ] && have npm; then
  bold "1/4 — Dépendances npm du starter"
  for app in backend frontend; do
    if [ -f "$ROOT/$app/package.json" ]; then
      if ( cd "$ROOT/$app" && npm install ); then
        ok "$app : dépendances installées"
      else
        warn "$app : échec de 'npm install' (à régler AVANT l'événement)"
      fi
    fi
  done
else
  warn "Étape npm ignorée (SKIP_NPM=1 ou npm absent)."
fi

# --- Les étapes suivantes (images + modèles) nécessitent Docker --------------
if [ "${SKIP_DOCKER:-0}" = "1" ] || ! have docker; then
  warn "Docker absent ou ignoré → étapes 2 à 4 sautées (suggestions pour P2 / P3)."
  bold "✅ Terminé."
  exit 0
fi

# --- 2/4 — Images Docker courantes (suggestions P2 / P3) ---------------------
bold "2/4 — Images Docker courantes (suggestions, pas obligatoires)"
for img in \
  nginx:1.27-alpine \
  redis:7-alpine \
  ollama/ollama:latest \
  mwader/static-ffmpeg:latest \
  python:3.11-slim
do
  if docker pull "$img" >/dev/null 2>&1; then ok "$img"; else warn "échec du pull : $img"; fi
done

# --- 3/4 — Modèle LLM local Ollama (suggestion P3-A) -------------------------
if [ "${SKIP_MODELS:-0}" != "1" ]; then
  bold "3/4 — Modèle Ollama : $OLLAMA_MODEL (suggestion P3-A)"
  docker volume create ollama-data >/dev/null 2>&1
  docker rm -f ollama-prefetch >/dev/null 2>&1 || true
  if docker run -d --name ollama-prefetch -v ollama-data:/root/.ollama ollama/ollama >/dev/null 2>&1; then
    sleep 4
    if docker exec ollama-prefetch ollama pull "$OLLAMA_MODEL" >/dev/null 2>&1; then
      ok "Ollama '$OLLAMA_MODEL' en cache (volume Docker 'ollama-data')"
    else
      warn "échec du pull du modèle '$OLLAMA_MODEL'"
    fi
    docker rm -f ollama-prefetch >/dev/null 2>&1 || true
  else
    warn "Ollama n'a pas démarré → modèle non récupéré."
  fi
else
  warn "Étape modèles ignorée (SKIP_MODELS=1)."
fi

# --- 4/4 — Modèle Whisper (suggestion P3-A, ici via faster-whisper) ----------
if [ "${SKIP_MODELS:-0}" != "1" ]; then
  bold "4/4 — Modèle Whisper : $WHISPER_MODEL (suggestion P3-A)"
  docker volume create whisper-cache >/dev/null 2>&1
  if docker run --rm -v whisper-cache:/models python:3.11-slim \
       bash -lc "pip install -q faster-whisper && python -c \"from faster_whisper import WhisperModel; WhisperModel('$WHISPER_MODEL', download_root='/models')\"" >/dev/null 2>&1; then
    ok "Whisper '$WHISPER_MODEL' en cache (volume 'whisper-cache', via faster-whisper)"
  else
    warn "échec du prefetch Whisper (ou utilisez une autre lib : openai-whisper, transformers…)"
  fi
else
  warn "Étape modèles ignorée (SKIP_MODELS=1)."
fi

bold "✅ Terminé — coup de pouce appliqué. Bon hackathon !"
echo  "   Rappel : ce ne sont que des SUGGESTIONS ; choisissez librement vos ressources."
