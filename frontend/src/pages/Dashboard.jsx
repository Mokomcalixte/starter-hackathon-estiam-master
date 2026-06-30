import { logout } from "../auth";

export default function Dashboard({ onOpenWatch }) {
  return (
    <div className="dashboard-page">
      <aside className="sidebar">
        <div className="brand">▶ TeamStream</div>

        <nav>
          <a className="active">🏠 Dashboard</a>
          <a>🎥 Mes sessions</a>
          <a>🔗 Rejoindre</a>
          <a>👥 Participants</a>
          <a>⚙️ Paramètres</a>
        </nav>

        <button
          className="logout-btn"
          onClick={() => {
            logout();
            window.location.reload();
          }}
        >
          Déconnexion
        </button>
      </aside>

      <main className="dashboard-main">
        <header className="dashboard-header">
          <div>
            <span className="badge">Watch Together · Sujet B</span>
            <h1>Bonjour 👋</h1>
            <p>Créez une session vidéo et regardez-la avec votre équipe en temps réel.</p>
          </div>

          <button className="primary-btn" onClick={onOpenWatch}>
            + Créer une session
          </button>
        </header>

        <section className="action-grid">
          <div className="action-card big">
            <h2>Créer une session</h2>
            <p>Lancez une salle vidéo synchronisée avec chat et participants.</p>
            <button onClick={onOpenWatch}>Démarrer maintenant</button>
          </div>

          <div className="action-card">
            <h2>Rejoindre</h2>
            <input placeholder="Code session ex: TS-2048" />
            <button onClick={onOpenWatch}>Rejoindre</button>
          </div>
        </section>

        <section className="sessions-panel">
          <h2>Mes sessions récentes</h2>

          <div className="session-row">
            <div>
              <h3>Démo produit TeamStream</h3>
              <p>En attente · 4 participants</p>
            </div>
            <button onClick={onOpenWatch}>Ouvrir</button>
          </div>

          <div className="session-row">
            <div>
              <h3>Formation React interne</h3>
              <p>Terminée · résumé IA disponible</p>
            </div>
            <button onClick={onOpenWatch}>Voir</button>
          </div>

          <div className="session-row">
            <div>
              <h3>Présentation client</h3>
              <p>Aujourd’hui · 15h00</p>
            </div>
            <button onClick={onOpenWatch}>Rejoindre</button>
          </div>
        </section>
      </main>
    </div>
  );
}