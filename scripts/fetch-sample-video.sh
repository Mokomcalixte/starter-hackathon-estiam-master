#!/usr/bin/env bash
# Prépare une vidéo d'exemple dans media/sample.mp4, réutilisable pour P1 (lecteur),
# P2-A (à chiffrer) et P3-A (transcription : il faut de la PAROLE).
#
# 2 façons d'obtenir la vidéo :
#   (a) DÉPÔT MANUEL — place ton fichier sous media/sample.mp4 (ex. la démo 42c
#       téléchargée depuis SharePoint). Le script le détecte et le garde tel quel.
#   (b) TÉLÉCHARGEMENT — sinon, récupère une vidéo libre de droits (défaut : Sintel,
#       Blender Foundation, CC-BY) et la convertit en .mp4 (nécessite ffmpeg).
#
# ⚠️ Vérifie le lien / la LICENCE (voir media/README.md).
# Réglages : VIDEO_URL · CLIP_START (def 0) · CLIP_DURATION (def 120 ; vide = vidéo entière)
#            FORCE=1 pour re-télécharger même si media/sample.mp4 existe déjà.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MEDIA="$ROOT/media"; mkdir -p "$MEDIA"
OUT="$MEDIA/sample.mp4"

# (a) Fichier déjà déposé → on le garde.
if [ -f "$OUT" ] && [ -z "${FORCE:-}" ]; then
  echo "✅ media/sample.mp4 déjà présent — conservé. (FORCE=1 pour re-télécharger.)"
  exit 0
fi

# (b) Téléchargement.
VIDEO_URL="${VIDEO_URL:-https://download.blender.org/durian/movies/Sintel.2010.720p.mkv}"
CLIP_START="${CLIP_START:-0}"
CLIP_DURATION="${CLIP_DURATION:-120}"
EXT="${VIDEO_URL##*.}"
SRC="$MEDIA/source.$EXT"

echo "⬇️  Téléchargement : $VIDEO_URL"
if ! curl -fL --retry 2 -o "$SRC" "$VIDEO_URL"; then
  echo "❌ Échec. Choisis une source dans media/README.md, puis :"
  echo "   VIDEO_URL=\"https://...\" ./scripts/fetch-sample-video.sh"
  exit 1
fi

# (c) Conversion en .mp4 (le lecteur et le packaging HLS préfèrent du .mp4).
if ! command -v ffmpeg >/dev/null 2>&1; then
  KEPT="$MEDIA/sample.$EXT"
  mv "$SRC" "$KEPT"
  echo
  echo "⚠️  ffmpeg n'est pas installé : la vidéo est téléchargée mais PAS convertie en .mp4."
  echo "    Fichier brut : $KEPT"
  echo
  echo "    1) Installe ffmpeg :"
  echo "         macOS   : brew install ffmpeg"
  echo "         Windows : winget install Gyan.FFmpeg     (ou : choco install ffmpeg)"
  echo "         Linux   : sudo apt install ffmpeg"
  echo "    2) Convertis-le en .mp4 :"
  echo "         ffmpeg -i \"$KEPT\" -c:v copy -c:a aac \"$OUT\""
  echo
  echo "    (Sans rien installer, si tu as Docker :"
  echo "       docker run --rm -v \"$MEDIA\":/m mwader/static-ffmpeg \\"
  echo "         -i \"/m/$(basename "$KEPT")\" -c:v copy -c:a aac /m/sample.mp4 )"
  exit 0
fi

if [ -n "$CLIP_DURATION" ]; then
  echo "✂️  Extrait de ${CLIP_DURATION}s (dès ${CLIP_START}s) → sample.mp4"
  ffmpeg -y -ss "$CLIP_START" -t "$CLIP_DURATION" -i "$SRC" \
    -c:v libx264 -preset veryfast -c:a aac "$OUT" || { echo "❌ Conversion ffmpeg échouée."; exit 1; }
else
  echo "🎞️  Conversion en .mp4 (vidéo copiée, audio AAC) → sample.mp4"
  ffmpeg -y -i "$SRC" -c:v copy -c:a aac "$OUT" || { echo "❌ Conversion ffmpeg échouée."; exit 1; }
fi
rm -f "$SRC"                       # nettoie l'intermédiaire (souvent volumineux)
echo "✅ → $OUT"
echo "⚖️  Conserve l'ATTRIBUTION de la licence (voir media/README.md)."
echo "   Pour P3-A : vérifie que l'extrait contient bien de la PAROLE (ajuste CLIP_START)."
