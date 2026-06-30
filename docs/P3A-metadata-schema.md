# 📐 P3-A — Format de sortie attendu (contrat JSON)

> Le pipeline d'indexation produit un **JSON structuré et documenté**. Voici le format
> *attendu* — un **contrat**, pas une solution : adaptez les noms si vous le justifiez,
> mais gardez une sortie **structurée, complète et reproductible**.

## Exemple

```json
{
  "video": "demo.mp4",
  "language": "fr",
  "duration_sec": 212.4,
  "transcript": "Texte intégral de la parole…",
  "segments": [
    { "start": 0.0, "end": 4.2, "text": "Bonjour et bienvenue." },
    { "start": 4.2, "end": 9.8, "text": "Aujourd'hui, parlons de sécurité." }
  ],
  "translation": { "lang": "en", "text": "Hello and welcome. Today, let's talk about security…" },
  "summary": "Résumé court (2-3 phrases) du contenu.",
  "chapters": [
    { "title": "Introduction", "start": 0.0 },
    { "title": "Chiffrement du flux", "start": 95.0 }
  ],
  "keywords": ["sécurité", "chiffrement", "vidéo"],
  "generated_at": "2026-06-30T10:00:00Z"
}
```

## Champs

| Champ | Type | Description |
|---|---|---|
| `video` | string | nom / identifiant de la source |
| `language` | string | langue détectée (ISO, ex. `fr`) |
| `duration_sec` | number | durée de la vidéo (secondes) |
| `transcript` | string | transcription complète |
| `segments[]` | array | `{ start, end, text }` — **horodatés** (secondes) |
| `translation` | object | `{ lang, text }` — traduction du transcript |
| `summary` | string | résumé court |
| `chapters[]` | array | `{ title, start }` — chapitres thématiques + timecode |
| `keywords[]` | string[] | mots-clés |
| `generated_at` | string | horodatage ISO de génération |

> ✅ **Ce qui compte** (barème) : tous les champs **réellement remplis** (pas seulement
> `transcript`), pertinents, et une sortie **structurée + documentée** — le tout **local**,
> sans clé API payante.
