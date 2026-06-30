# 🎬 Vidéo d'exemple

Le fichier vidéo n'est **pas versionné** (`.gitignore` ignore `*.mp4`). Une **seule**
vidéo couvre **P1** (lecteur), **P2-A** (à chiffrer) et **P3-A** (transcription). Pour
P3-A il faut de la **parole** (pas une vidéo muette).

## ✅ Option recommandée — démo interne (vraie parole)

Une vidéo d'une **vraie démo 42c**, avec des gens qui parlent :

> https://42consultingon-my.sharepoint.com/:v:/g/personal/guillaume_lemaire_42c_fr/IQAAp7MoJ_zuQbW8E4te38wPAX69Lj_MK8CRbp7iryLxjK8?e=woSXPK

1. Ouvre le lien → bouton **Télécharger**.
2. Enregistre le fichier sous **`media/sample.mp4`**.
3. `./scripts/fetch-sample-video.sh` **détecte ce fichier et le garde** (pas de re-téléchargement).

> ⚠️ Avant de la diffuser aux ~20 équipes : le lien doit être partagé en **« Tout le
> monde avec le lien »** (sinon les étudiants hors 42c n'y accèdent pas), le **jeton de
> partage** (`?e=…`) peut expirer (régénère-le au besoin), et assure-toi que les
> **personnes filmées** acceptent cette diffusion.

## 🌐 Sinon — télécharger une vidéo libre de droits

```bash
./scripts/fetch-sample-video.sh                       # défaut : Sintel (CC-BY) → sample.mp4
VIDEO_URL="https://..." CLIP_START=90 CLIP_DURATION=120 ./scripts/fetch-sample-video.sh
```
Le script convertit en **`.mp4`** (Sintel est distribué en `.mkv`) et nettoie l'intermédiaire.

> 🔧 **ffmpeg est requis** pour cette conversion. S'il est absent, le script télécharge
> quand même la vidéo (`.mkv`) et **affiche la marche à suivre**. Installer :
> `brew install ffmpeg` (macOS) · `winget install Gyan.FFmpeg` (Windows) ·
> `sudo apt install ffmpeg` (Linux). Puis convertir manuellement :
> ```bash
> ffmpeg -i media/sample.mkv -c:v copy -c:a aac media/sample.mp4
> ```

## Sources libres de droits (à valider + créditer)

| Source | Licence | Parole ? | Note |
|---|---|---|---|
| **Blender open movies** — Sintel, Tears of Steel, Elephants Dream (download.blender.org) | **CC-BY** | ✅ dialogues | créditer « © Blender Foundation » |
| **NASA** — images.nasa.gov | **Domaine public** | ✅ narration EN | idéal pour une transcription propre |
| **Wikimedia Commons** (filtrer CC-BY / domaine public) | CC-BY / PD | variable | discours, conférences |

> ⚠️ **CC = Creative Commons = licence libre, PAS des sous-titres.** En **CC-BY**, tu dois
> **créditer l'auteur**. N'utilise **pas** de contenu sous copyright (illégal à
> redistribuer aux équipes). **Pas besoin de sous-titres** : la transcription est
> **générée** par le pipeline P3-A.
