# ============================================================
#  Installation complete - Pole 3 Sujet A (Indexation semantique)
#  A lancer UNE FOIS dans PowerShell, depuis le dossier engine :
#      .\install.ps1
#  Prepare : environnement Python, dependances, ffmpeg, modele
#  Whisper, et paquets de traduction (sous-titres en/es/zh).
# ============================================================

$ErrorActionPreference = "Stop"
Write-Host "==== Installation Pole 3 - Sujet A ====" -ForegroundColor Magenta

# --- 0. Verifier Python ---
Write-Host "`n[0/6] Verification de Python..." -ForegroundColor Cyan
try { python --version } catch {
    Write-Host "Python introuvable. Installez-le : winget install Python.Python.3.12" -ForegroundColor Red
    exit 1
}

# --- 1. Verifier / installer ffmpeg ---
Write-Host "`n[1/6] Verification de ffmpeg..." -ForegroundColor Cyan
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
    Write-Host "ffmpeg absent, installation via winget..." -ForegroundColor Yellow
    winget install Gyan.FFmpeg
    Write-Host "!! Fermez et rouvrez PowerShell apres l'install de ffmpeg, puis relancez ce script." -ForegroundColor Yellow
    exit 0
} else { Write-Host "ffmpeg present." -ForegroundColor Green }

# --- 2. Environnement virtuel ---
Write-Host "`n[2/6] Creation de l'environnement Python (.venv)..." -ForegroundColor Cyan
if (-not (Test-Path ".venv")) { python -m venv .venv }
.\.venv\Scripts\Activate.ps1
python -m pip install -U pip

# --- 3. Dependances Python ---
Write-Host "`n[3/6] Installation des dependances (peut prendre quelques minutes)..." -ForegroundColor Cyan
pip install -r requirements-A.txt

# --- 4. Modele Whisper (transcription) ---
Write-Host "`n[4/6] Telechargement du modele Whisper 'small'..." -ForegroundColor Cyan
python -c "from faster_whisper import WhisperModel; WhisperModel('small', device='cpu', compute_type='int8'); print('Modele Whisper pret.')"

# --- 5. Paquets de traduction (sous-titres) ---
Write-Host "`n[5/6] Installation des paquets de traduction (fr-en, en-es, en-zh)..." -ForegroundColor Cyan
python -c "import argostranslate.package as p; p.update_package_index(); a=p.get_available_packages(); [p.install_from_path(next(x for x in a if x.from_code==s and x.to_code==t).download()) for s,t in [('fr','en'),('en','es'),('en','zh')]]; print('Paquets de traduction installes.')"

# --- 6. Verification finale ---
Write-Host "`n[6/6] Verification..." -ForegroundColor Cyan
python -c "import faster_whisper, sklearn, fastapi, argostranslate.translate as a; print('Langues installees :', [l.code for l in a.get_installed_languages()])"

Write-Host "`n==== Installation terminee ! ====" -ForegroundColor Green
Write-Host "Pour lancer le serveur : .\run.ps1  (ou : uvicorn api:app --port 8000)" -ForegroundColor Green
Write-Host "Puis ouvrez http://localhost:8000 dans le navigateur." -ForegroundColor Green
