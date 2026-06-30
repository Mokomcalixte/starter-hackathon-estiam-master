# Frontend — Application React (View)

> Brique **View** de la plateforme. Voir le [README racine](../README.md) pour le
> contexte du hackathon.

## ✅ Prérequis

| Outil | Version | Vérifier |
|---|---|---|
| **Node.js** | **20.19+** ou **22+** (requis par Vite) | `node -v` |
| **npm** | 9+ (livré avec Node) | `npm -v` |

## 🚀 Installer & lancer

```bash
npm install
npm run dev          # → http://localhost:5173
```

> ⚠️ La démo d'authentification appelle le **backend** : lancez aussi le Core
> (`cd ../backend && npm run start:dev`, port 3000).

## ⚙️ Variable d'environnement (optionnelle)

| Variable | Défaut | Rôle |
|---|---|---|
| `VITE_API_URL` | `http://localhost:3000` | URL de l'API (Core) appelée par le front |

Pour la définir : créez un fichier `.env` à la racine de `frontend/` contenant
`VITE_API_URL=http://...`.

## 🧰 Scripts utiles

```bash
npm run dev          # serveur de dev (HMR)
npm run build        # build de production
npm run preview      # prévisualiser le build
npm run lint         # ESLint (corrige avec --fix)
npm run format       # Prettier (écrit)
```

---

<sub>Notes du template Vite ci-dessous.</sub>

# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
