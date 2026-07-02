# 🏆 TeamStream - Hackathon ESTIAM

Bienvenue dans le dépôt de **TeamStream**, notre solution complète pour la plateforme vidéo collaborative et sécurisée réalisée lors du Hackathon ESTIAM.

## 🚀 Fonctionnalités Principales

Notre solution s'articule autour de trois axes majeurs :

### 1. Application & Collaboration ("Watch Together")
- Espace de projection virtuelle permettant à un présentateur et ses invités de visionner une vidéo de manière **parfaitement synchronisée**.
- Les actions de lecture du présentateur (Play, Pause, Seek) se répercutent instantanément chez tous les invités.
- Frontend moderne, rapide et fluide développé en **React (Vite)**.

### 2. Infrastructure, Sécurité & Anti-Scraping (Notre Focus)
- **Architecture 100% Dockerisée** : L'ensemble des services (Frontend, Backend, Engine, Proxy) est conteneurisé pour une reproductibilité et un déploiement instantanés.
- **Reverse Proxy Nginx** : Point d'entrée unique qui route le trafic de manière sécurisée.
- **Sécurité Avancée** :
  - **Rate Limiting** strict au niveau de l'API (NestJS Throttler) pour prévenir les attaques DDoS et le scraping massif.
  - Détection et blocage de l'**IP Spoofing**.
  - **Authentification JWT** avec tokens à courte durée de vie.
- Un script de test (`scripts/attack1.py`) prouve l'efficacité de nos défenses contre les bots.

### 3. Intelligence Artificielle & Data
- **Engine Python** : Moteur dédié à l'analyse et aux traitements de l'IA.
- Indexation sémantique et analyse d'audience de la vidéo pour améliorer l'expérience utilisateur.

---

## 🏗 Architecture Technique

- **View** (`frontend/`) : React + Vite.
- **Core** (`backend/`) : API NestJS sécurisée, connectée à une base de données SQLite embarquée (`hackathon.db`).
- **Engine** (`engine/`) : API Python rapide sous FastAPI.
- **Gateway** (`nginx.conf`) : Nginx écoutant sur le port 80 pour router le trafic vers le Frontend ou le Backend (sur `/api`).

---

## ⚙️ Installation & Lancement

L'objectif de notre infrastructure est d'être déployable en **une seule commande**, sans configuration manuelle complexe.

### Prérequis
- [Docker](https://www.docker.com/) et [Docker Compose](https://docs.docker.com/compose/) installés sur votre machine.

### Démarrer le projet

1. **Cloner le dépôt** :
   ```bash
   git clone https://github.com/Mokomcalixte/starter-hackathon-estiam-master.git
   cd starter-hackathon-estiam-master
   ```

2. **Lancer les conteneurs en tâche de fond** :
   ```bash
   docker-compose up --build -d
   ```
   *Note: Cette commande va construire les images (Node, Python, Nginx) et purger le cache si nécessaire.*

3. **Accéder à l'application** :
   Ouvrez votre navigateur sur **[http://localhost](http://localhost)**.

### Tester la Sécurité (Anti-Scraping)

Pour vérifier que la plateforme est bien protégée contre l'aspiration automatisée, lancez notre script d'attaque :
```bash
python scripts/attack1.py
```
Le script va simuler un comportement légitime puis basculer en mode "Spam/Scraping". Vous verrez le serveur bloquer instantanément l'attaquant avec des erreurs HTTP `429 Too Many Requests`.

---
*Projet fièrement réalisé par l'équipe TeamStream pour le Hackathon ESTIAM.*
