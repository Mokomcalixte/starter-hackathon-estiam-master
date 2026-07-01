# ============================================================
#  Lancement du serveur - Pole 3 Sujet A
#  A lancer depuis le dossier engine :
#      .\run.ps1
#  Active l'environnement et demarre l'API + la page de demo.
# ============================================================

# Activer l'environnement Python
.\.venv\Scripts\Activate.ps1

Write-Host "Demarrage du serveur sur http://localhost:8000 ..." -ForegroundColor Magenta
Write-Host "Ouvrez cette adresse dans le navigateur. Ctrl+C pour arreter." -ForegroundColor Cyan

uvicorn api:app --port 8000
