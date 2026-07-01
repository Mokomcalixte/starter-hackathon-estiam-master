"""
Pole 3 - Sujet A : API d'indexation semantique (brique ENGINE)
==============================================================
Bibliotheque multi-videos + recherche semantique globale.
Appelable par le Core (NestJS) et par la page de demo web.

Lancement :
    uvicorn api:app --reload --port 8000

Endpoints :
    GET  /health                  -> etat du service
    POST /index   (multipart)     -> indexe une video, l'ajoute a la bibliotheque
    GET  /videos                  -> liste des videos indexees (resumes legers)
    GET  /videos/{vid}            -> metadonnees completes d'une video
    GET  /search?q=...            -> cherche un terme dans TOUTES les videos
    GET  /          (page demo)    -> interface web

La bibliotheque est persistee dans library.json (survit aux redemarrages).
"""

import os
import json
import uuid
import tempfile
import shutil

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

import semantic_indexing as si

app = FastAPI(title="Engine - Indexation semantique (P3-A)", version="2.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])

MODEL_SIZE = os.environ.get("WHISPER_MODEL", "small")
TARGET_LANGS = ("en", "es", "zh")
LIBRARY_FILE = "library.json"
LIBRARY = {}  # vid -> metadata complet


def load_library():
    global LIBRARY
    if os.path.exists(LIBRARY_FILE):
        with open(LIBRARY_FILE, encoding="utf-8") as f:
            LIBRARY = json.load(f)


def save_library():
    with open(LIBRARY_FILE, "w", encoding="utf-8") as f:
        json.dump(LIBRARY, f, ensure_ascii=False, indent=2)


load_library()


@app.get("/health")
def health():
    return {"status": "ok", "engine": "semantic-indexing",
            "model": MODEL_SIZE, "videos": len(LIBRARY)}


@app.post("/index")
async def index(file: UploadFile = File(...)):
    """Indexe une video et l'ajoute a la bibliotheque."""
    if not file.filename:
        raise HTTPException(400, "Aucun fichier recu.")

    suffix = os.path.splitext(file.filename)[1] or ".mp4"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    try:
        shutil.copyfileobj(file.file, tmp)
        tmp.close()

        wav = si.extract_audio(tmp.name, tmp.name + ".wav")
        language, segments, transcript = si.transcribe(wav, MODEL_SIZE)
        meta = si.build_metadata(file.filename, language, segments,
                                 transcript, si._duration(tmp.name), TARGET_LANGS)

        vid = uuid.uuid4().hex[:8]
        meta["id"] = vid
        LIBRARY[vid] = meta
        save_library()
        return JSONResponse(meta)
    except Exception as e:
        raise HTTPException(500, f"Erreur pipeline : {e}")
    finally:
        for p in (tmp.name, tmp.name + ".wav"):
            if os.path.exists(p):
                os.remove(p)


@app.get("/videos")
def list_videos():
    """Liste legere de la bibliotheque (sans le transcript complet)."""
    return [
        {"id": v["id"], "video": v["video"], "language": v["language"],
         "duration_sec": v["duration_sec"], "keywords": v.get("keywords", []),
         "summary": v.get("summary", "")}
        for v in LIBRARY.values()
    ]


@app.get("/videos/{vid}")
def get_video(vid: str):
    if vid not in LIBRARY:
        raise HTTPException(404, "Video inconnue.")
    return LIBRARY[vid]


@app.get("/search")
def search(q: str):
    """Recherche un terme dans les segments de TOUTES les videos."""
    q = q.strip().lower()
    if not q:
        return []
    hits = []
    for v in LIBRARY.values():
        for s in v["segments"]:
            if q in s["text"].lower():
                hits.append({
                    "video_id": v["id"], "video": v["video"],
                    "start": s["start"], "end": s["end"], "text": s["text"],
                })
    hits.sort(key=lambda h: (h["video"], h["start"]))
    return hits


@app.delete("/videos/{vid}")
def delete_video(vid: str):
    if vid in LIBRARY:
        del LIBRARY[vid]
        save_library()
    return {"deleted": vid}


@app.get("/", response_class=HTMLResponse)
def demo_page():
    with open("demo.html", encoding="utf-8") as f:
        return f.read()
