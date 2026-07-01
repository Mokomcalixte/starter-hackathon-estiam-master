"""
Pôle 3 — Sujet A : Indexation & analyse sémantique
===================================================
Pipeline 100 % local : VIDÉO  ->  JSON structuré (contrat docs/P3A-metadata-schema.md)

Chaîne :
  1. extract_audio()    ffmpeg : vidéo -> wav 16 kHz mono
  2. transcribe()       faster-whisper : audio -> langue + transcript + segments horodatés
  3. translate()        traduction du transcript (argos local, sinon best-effort)
  4. summarize()        résumé extractif (TextRank-like, sans LLM)
  5. make_chapters()    chapitres thématiques par regroupement de segments
  6. extract_keywords() mots-clés via TF-IDF (sans LLM)
  7. build_metadata()   assemble le JSON final

Aucune clé API payante. Modèles légers (CPU).
"""

from __future__ import annotations
import json, subprocess, re, datetime, os, shutil
import numpy as np


def _ffmpeg_exe():
    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg:
        return ffmpeg

    try:
        import imageio_ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception as exc:
        raise RuntimeError(
            "ffmpeg est introuvable. Installez ffmpeg ou la dependance "
            "Python imageio-ffmpeg."
        ) from exc

# ----------------------------------------------------------------------
# 1. Extraction audio (ffmpeg)
# ----------------------------------------------------------------------
def extract_audio(video_path: str, wav_path: str = "audio.wav") -> str:
    """Isole la piste audio en wav 16 kHz mono (format attendu par Whisper)."""
    subprocess.run(
        [_ffmpeg_exe(), "-y", "-i", video_path, "-vn", "-ac", "1", "-ar", "16000",
         wav_path, "-loglevel", "error"],
        check=True,
    )
    return wav_path


# ----------------------------------------------------------------------
# 2. Transcription (faster-whisper)
# ----------------------------------------------------------------------
def transcribe(wav_path: str, model_size: str = "small"):
    """
    Renvoie (language, segments, full_text).
    segments = [{start, end, text}]  -> horodatés, cœur du livrable.
    model_size : 'tiny'/'base'/'small' (CPU). 'small' = bon compromis qualité/temps.
    """
    from faster_whisper import WhisperModel
    model = WhisperModel(model_size, device="cpu", compute_type="int8")
    segments_gen, info = model.transcribe(wav_path, vad_filter=True)

    segments, parts = [], []
    for s in segments_gen:
        txt = s.text.strip()
        segments.append({"start": round(s.start, 2), "end": round(s.end, 2), "text": txt})
        parts.append(txt)
    return info.language, segments, " ".join(parts)


# ----------------------------------------------------------------------
# 3. Traduction multilingue (local, argostranslate)
# ----------------------------------------------------------------------
def _ensure_argos_pair(src: str, target: str) -> bool:
    """Installe la paire de langue src->target si elle est déjà téléchargée
    en local. Renvoie True si la traduction est possible."""
    try:
        import argostranslate.package, argostranslate.translate
        installed = argostranslate.translate.get_installed_languages()
        codes = {l.code for l in installed}
        return src in codes and target in codes
    except Exception:
        return False


def translate_one(text: str, src: str, target: str):
    """Traduit text de src vers target (direct ou pivot via anglais). Renvoie
    un dict {lang, text} ou un marqueur explicite si non installée."""
    if src == target:
        return {"lang": target, "text": text}
    try:
        if not _route_ok(src, target):
            return {"lang": target,
                    "text": f"[paire {src}->{target} non installée]",
                    "note": "lancer prefetch_translation.py pour activer"}
        return {"lang": target, "text": _translate_pivot(text, src, target)}
    except Exception as e:
        return {"lang": target, "text": f"[traduction indisponible: {e}]"}


def translate(text: str, src: str, targets=("en", "es")):
    """Traduit vers plusieurs langues cibles. Renvoie une liste de {lang, text}."""
    if isinstance(targets, str):
        targets = [targets]
    return [translate_one(text, src, t) for t in targets]


# Langues proposées pour les sous-titres (code -> libellé).
SUBTITLE_LANGS = {
    "en": "English",
    "es": "Español",
    "zh": "中文",
    "de": "Deutsch",
    "it": "Italiano",
    "pt": "Português",
    "ar": "العربية",
}


def _has_direct(src, target):
    """Vérifie qu'une traduction directe existe entre deux langues installées."""
    try:
        import argostranslate.translate as at
        langs = {l.code: l for l in at.get_installed_languages()}
        if src not in langs or target not in langs:
            return False
        return langs[src].get_translation(langs[target]) is not None
    except Exception:
        return False


def _translate_pivot(text, src, target, pivot="en"):
    """Traduit src->target. Si pas de route directe, tente src->pivot->target
    (utile pour le chinois : fr->en->zh)."""
    import argostranslate.translate as at
    if _has_direct(src, target):
        return at.translate(text, src, target)
    if (src != pivot and target != pivot
            and _has_direct(src, pivot) and _has_direct(pivot, target)):
        mid = at.translate(text, src, pivot)
        return at.translate(mid, pivot, target)
    raise RuntimeError(f"aucune route {src}->{target}")


def _route_ok(src, target, pivot="en"):
    """Une traduction (directe ou pivot) est-elle possible ?"""
    if src == target:
        return True
    if _has_direct(src, target):
        return True
    return _has_direct(src, pivot) and _has_direct(pivot, target)


def translate_segments(segments, src, targets):
    """
    Traduit CHAQUE segment horodaté vers chaque langue cible.
    Renvoie un dict { code_langue: [textes alignés sur segments] }.
    Permet des sous-titres synchronisés (comme YouTube).
    """
    out = {}
    for tgt in targets:
        if tgt == src:
            out[tgt] = [s["text"] for s in segments]
            continue
        if not _route_ok(src, tgt):
            out[tgt] = [f"[{src}->{tgt} non installée]"] * len(segments)
            continue
        try:
            out[tgt] = [_translate_pivot(s["text"], src, tgt) for s in segments]
        except Exception as e:
            out[tgt] = [f"[err: {e}]"] * len(segments)
    return out


# ----------------------------------------------------------------------
# 4. Résumé extractif (sans LLM) — TextRank simplifié
# ----------------------------------------------------------------------
def _split_sentences(text: str):
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if len(s.strip()) > 15]


def summarize(text: str, n_sentences: int = 3) -> str:
    """
    Résumé extractif : on garde les phrases les plus 'centrales' (celles dont
    les mots reviennent le plus dans tout le texte). Pas de LLM, 100 % local.
    """
    from sklearn.feature_extraction.text import TfidfVectorizer
    sents = _split_sentences(text)
    if len(sents) <= n_sentences:
        return " ".join(sents)
    vec = TfidfVectorizer()
    M = vec.fit_transform(sents)
    scores = np.asarray(M.sum(axis=1)).ravel()          # poids global de chaque phrase
    top = sorted(sorted(range(len(sents)), key=lambda i: -scores[i])[:n_sentences])
    return " ".join(sents[i] for i in top)


# ----------------------------------------------------------------------
# 5. Chapitres thématiques
# ----------------------------------------------------------------------
def make_chapters(segments, target_chapters: int = 4):
    """
    Découpe la timeline en N chapitres de durée équilibrée, et titre chaque
    bloc avec ses mots-clés saillants (TF-IDF par bloc vs le reste).
    """
    if not segments:
        return []
    from sklearn.feature_extraction.text import TfidfVectorizer
    n = min(target_chapters, len(segments))
    # blocs équilibrés en nombre de segments
    idx = np.array_split(range(len(segments)), n)
    blocks = [[segments[i] for i in part] for part in idx if len(part)]
    block_texts = [" ".join(s["text"] for s in b) for b in blocks]

    # TF-IDF inter-blocs : les mots distinctifs de chaque bloc font le titre
    try:
        vec = TfidfVectorizer(stop_words=FR_STOP, ngram_range=(1, 2),
                              token_pattern=r"[A-Za-zÀ-ÿ]{4,}")
        M = vec.fit_transform(block_texts).toarray()
        terms = np.array(vec.get_feature_names_out())
    except Exception:
        M, terms = None, None

    chapters = []
    for i, b in enumerate(blocks):
        title = "Chapitre"
        if M is not None and M[i].max() > 0:
            top = M[i].argsort()[::-1][:2]
            words = [terms[j] for j in top if M[i][j] > 0]
            if words:
                title = " · ".join(w.capitalize() for w in words)
        chapters.append({"title": title, "start": b[0]["start"]})
    return chapters


# ----------------------------------------------------------------------
# 6. Mots-clés (TF-IDF, sans LLM)
# ----------------------------------------------------------------------
FR_STOP = """au aux avec ce ces dans de des du elle en et eux il je la le leur lui ma
mais me meme mes moi mon ne nos notre nous on ou par pas pour qu que qui sa se ses son
sur ta te tes toi ton tu un une vos votre vous c d j l a à m n s t y est été être plus
très bien fait faire cette comme aussi donc alors si oui non ici là chose petit grand
ça cela ceci celui celle ceux celles dont où quoi quel quelle quels quelles ne pas plus
jamais toujours encore déjà puis ensuite enfin avant après pendant depuis vers chez
sans sous entre avec contre selon malgré sauf hormis car parce puisque comme tandis
lorsque quand dès afin pourtant cependant néanmoins toutefois ainsi voilà voici
peux peut peuvent pouvez pouvons pouvait pourrait avoir avait avaient ont avons avez
sera serai seront étaient était suis sommes êtes sont fais fait faites font allait
va vais vont allons allez aller dit dire disait avait vraiment beaucoup trop peu
chaque tout toute tous toutes autre autres même mêmes tel telle quelque quelques
choses gens fois moment moments part parts façon manière truc trucs voir vu voit
deux trois première deuxième troisième dernier dernière """.split()


def extract_keywords(text: str, k: int = 8):
    """Mots-clés = termes au plus fort TF-IDF (hors mots vides), dédoublonnés."""
    from sklearn.feature_extraction.text import TfidfVectorizer
    vec = TfidfVectorizer(stop_words=FR_STOP, ngram_range=(1, 2),
                          token_pattern=r"[A-Za-zÀ-ÿ]{4,}")
    M = vec.fit_transform([text])
    scores = np.asarray(M.todense()).ravel()
    terms = np.array(vec.get_feature_names_out())
    order = scores.argsort()[::-1]

    kept = []
    for i in order:
        if scores[i] <= 0:
            break
        term = terms[i]
        # éviter qu'un mot déjà retenu soit contenu dans un n-gram redondant
        if any(term in k2 or k2 in term for k2 in kept):
            continue
        kept.append(term)
        if len(kept) >= k:
            break
    return kept


# ----------------------------------------------------------------------
# 7. Assemblage du JSON (contrat P3A)
# ----------------------------------------------------------------------
def build_metadata(video_path, language, segments, transcript,
                   duration_sec, target_langs=("en", "es", "zh")):
    # sous-titres : chaque segment traduit dans chaque langue (synchronisé)
    seg_translations = translate_segments(segments, language, target_langs)
    # on attache à chaque segment ses versions traduites
    enriched_segments = []
    for i, s in enumerate(segments):
        item = {"start": s["start"], "end": s["end"], "text": s["text"]}
        item["translations"] = {lang: seg_translations[lang][i]
                                for lang in target_langs}
        enriched_segments.append(item)

    return {
        "video": os.path.basename(video_path),
        "language": language,
        "duration_sec": round(duration_sec, 2),
        "available_subtitle_langs": [language] + list(target_langs),
        "transcript": transcript,
        "segments": enriched_segments,
        "translations": translate(transcript, language, target_langs),
        "summary": summarize(transcript),
        "chapters": make_chapters(segments),
        "keywords": extract_keywords(transcript),
        "generated_at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }


def _duration(path):
    ffprobe = shutil.which("ffprobe")
    if ffprobe:
        out = subprocess.run(
            [ffprobe, "-v", "error", "-show_entries", "format=duration",
             "-of", "csv=p=0", path], capture_output=True, text=True)
        try:
            return float(out.stdout.strip())
        except ValueError:
            return 0.0

    try:
        import imageio_ffmpeg

        _, duration = imageio_ffmpeg.count_frames_and_secs(path)
        return float(duration)
    except Exception:
        return 0.0


def index_video(video_path, out_json="metadata.json",
                model_size="small", target_langs=("en", "es", "zh")):
    """Pipeline complet : vidéo -> metadata.json."""
    wav = extract_audio(video_path)
    language, segments, transcript = transcribe(wav, model_size)
    meta = build_metadata(video_path, language, segments, transcript,
                          _duration(video_path), target_langs)
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    return meta


# ----------------------------------------------------------------------
if __name__ == "__main__":
    import sys
    video = sys.argv[1] if len(sys.argv) > 1 else "sample.mp4"
    print(f"Indexation de {video} …")
    meta = index_video(video)
    print(f"✅ {len(meta['segments'])} segments · langue={meta['language']}")
    print(f"   résumé : {meta['summary'][:120]}…")
    print(f"   mots-clés : {meta['keywords']}")
    print("   -> metadata.json")
