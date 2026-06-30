# =============================================================================
#  prefetch.ps1 - COUP DE POUCE (totalement optionnel) - version Windows / PowerShell
#
#  Equivalent de scripts/prefetch.sh pour Windows EN NATIF (sans WSL ni Git Bash).
#  Pre-telecharge, AVANT l'evenement, des ressources COURANTES pour travailler
#  ensuite hors-ligne : dependances du starter, images Docker, modeles Whisper/Ollama.
#
#  /!\ CE N'EST QU'UNE AIDE, ET UNE SUGGESTION. Vous etes entierement LIBRES de
#      choisir vos propres outils, modeles et images : ce script ne presume RIEN de
#      votre solution. Chaque etape est independante (ce qui echoue est ignore).
#
#  Usage :   .\scripts\prefetch.ps1
#    Si l'execution est bloquee par la politique de scripts :
#      powershell -ExecutionPolicy Bypass -File scripts\prefetch.ps1
#  Reglages (variables d'environnement, optionnelles) :
#    $env:OLLAMA_MODEL  $env:WHISPER_MODEL  $env:SKIP_NPM  $env:SKIP_DOCKER  $env:SKIP_MODELS
# =============================================================================

$OllamaModel  = if ($env:OLLAMA_MODEL)  { $env:OLLAMA_MODEL }  else { 'llama3.2:1b' }
$WhisperModel = if ($env:WHISPER_MODEL) { $env:WHISPER_MODEL } else { 'small' }
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

function Bold($m) { Write-Host ""; Write-Host $m -ForegroundColor White }
function Ok($m)   { Write-Host "  [OK] $m" -ForegroundColor Green }
function Warn($m) { Write-Host "  [!]  $m" -ForegroundColor Yellow }
function Have($c) { $null -ne (Get-Command $c -ErrorAction SilentlyContinue) }

Bold "prefetch.ps1 - COUP DE POUCE (optionnel, libre a vous de l'ignorer)"
Write-Host "   Pre-telecharge des ressources COURANTES pour travailler hors-ligne."
Write-Host "   -> Vous restez LIBRES de choisir d'autres outils / modeles / images."

# --- 1/4 - Dependances npm du starter (backend + frontend) ---
if ($env:SKIP_NPM -ne '1' -and (Have 'npm')) {
  Bold "1/4 - Dependances npm du starter"
  foreach ($app in @('backend', 'frontend')) {
    if (Test-Path (Join-Path $Root "$app\package.json")) {
      Push-Location (Join-Path $Root $app)
      npm install
      if ($LASTEXITCODE -eq 0) { Ok "$app : dependances installees" }
      else { Warn "$app : echec de 'npm install' (a regler AVANT l'evenement)" }
      Pop-Location
    }
  }
}
else {
  Warn "Etape npm ignoree (SKIP_NPM=1 ou npm absent)."
}

# --- Les etapes suivantes (images + modeles) necessitent Docker ---
if ($env:SKIP_DOCKER -eq '1' -or -not (Have 'docker')) {
  Warn "Docker absent ou ignore -> etapes 2 a 4 sautees (suggestions P2 / P3)."
  Bold "Termine."
  return
}

# --- 2/4 - Images Docker courantes (suggestions P2 / P3) ---
Bold "2/4 - Images Docker courantes (suggestions, pas obligatoires)"
foreach ($img in @('nginx:1.27-alpine', 'redis:7-alpine', 'ollama/ollama:latest', 'mwader/static-ffmpeg:latest', 'python:3.11-slim')) {
  docker pull $img 2>&1 | Out-Null
  if ($LASTEXITCODE -eq 0) { Ok $img } else { Warn "echec du pull : $img" }
}

# --- 3/4 - Modele LLM local Ollama (suggestion P3-A) ---
if ($env:SKIP_MODELS -ne '1') {
  Bold "3/4 - Modele Ollama : $OllamaModel (suggestion P3-A)"
  docker volume create ollama-data 2>&1 | Out-Null
  docker rm -f ollama-prefetch 2>&1 | Out-Null
  docker run -d --name ollama-prefetch -v ollama-data:/root/.ollama ollama/ollama 2>&1 | Out-Null
  if ($LASTEXITCODE -eq 0) {
    Start-Sleep -Seconds 4
    docker exec ollama-prefetch ollama pull $OllamaModel 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { Ok "Ollama '$OllamaModel' en cache (volume 'ollama-data')" }
    else { Warn "echec du pull du modele '$OllamaModel'" }
    docker rm -f ollama-prefetch 2>&1 | Out-Null
  }
  else {
    Warn "Ollama n'a pas demarre -> modele non recupere."
  }
}
else {
  Warn "Etape modeles ignoree (SKIP_MODELS=1)."
}

# --- 4/4 - Modele Whisper (suggestion P3-A, ici via faster-whisper) ---
if ($env:SKIP_MODELS -ne '1') {
  Bold "4/4 - Modele Whisper : $WhisperModel (suggestion P3-A)"
  docker volume create whisper-cache 2>&1 | Out-Null
  $py = "pip install -q faster-whisper && python -c `"from faster_whisper import WhisperModel; WhisperModel('$WhisperModel', download_root='/models')`""
  docker run --rm -v whisper-cache:/models python:3.11-slim bash -lc $py 2>&1 | Out-Null
  if ($LASTEXITCODE -eq 0) { Ok "Whisper '$WhisperModel' en cache (volume 'whisper-cache', via faster-whisper)" }
  else { Warn "echec du prefetch Whisper (ou utilisez une autre lib : openai-whisper, transformers...)" }
}
else {
  Warn "Etape modeles ignoree (SKIP_MODELS=1)."
}

Bold "Termine - coup de pouce applique. Bon hackathon !"
Write-Host "   Rappel : ce ne sont que des SUGGESTIONS ; choisissez librement vos ressources."
