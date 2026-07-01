# Pole 3 - Sujet A : Indexation semantique & sous-titres multilingues

Transforme une video en metadonnees textuelles : transcription horodatee,
resume, chapitres, mots-cles, et **sous-titres traduits synchronises**
(Francais, English, Espanol, Chinois) - le tout 100% en local.

## Installation (une seule fois)

### Windows (PowerShell)
```powershell
.\install.ps1
```

### Mac / Linux
```bash
bash install.sh
```

Le script installe : environnement Python, dependances, modele Whisper,
et les paquets de traduction. (ffmpeg doit etre installe au prealable :
`winget install Gyan.FFmpeg` sur Windows, `brew install ffmpeg` sur Mac.)

## Lancement

### Windows
```powershell
.\run.ps1
```
### Mac / Linux
```bash
source .venv/bin/activate && uvicorn api:app --port 8000
```

Puis ouvrir **http://localhost:8000** dans le navigateur.

## Utilisation

1. Cliquer "Choisir un fichier", selectionner une video, "Indexer la video".
2. Attendre la transcription + traduction (1-3 min selon la duree).
3. Choisir la langue des sous-titres dans le menu deroulant.
4. Les sous-titres defilent sur la video ; les chapitres sont cliquables.

## Fichiers

| Fichier | Role |
|---|---|
| `semantic_indexing.py` | Pipeline : audio, transcription, traduction, resume, chapitres, mots-cles |
| `api.py` | API FastAPI (Engine) + bibliotheque multi-videos |
| `demo.html` | Page web de demonstration |
| `prefetch_translation.py` | Telecharge les paquets de traduction |
| `requirements-A.txt` | Dependances Python |
| `install.ps1` / `install.sh` | Installation automatique |
| `run.ps1` | Lancement du serveur |

## Note technique

Le chinois utilise un pivot par l'anglais (fr -> en -> zh) car la traduction
directe n'existe pas dans argostranslate. Resume et mots-cles sont produits
en NLP classique (TF-IDF), sans LLM lourd : rapide et reproductible sur CPU.
