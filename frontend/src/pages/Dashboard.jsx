import { useState } from "react";
import { logout } from "../auth";

export default function Dashboard({ onCreateSession, onJoinSession, session }) {
  const [joinCode, setJoinCode] = useState("");

  function handleJoin() {
    if (!joinCode.trim()) {
      alert("Entre un code de session.");
      return;
    }

    onJoinSession(joinCode.trim());
  }

  return (
    <div className="dashboard-page">
      <aside className="sidebar">
        <div className="brand">TeamStream</div>

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
            <span className="badge">Watch Together</span>
            <h1>Bonjour</h1>
            <p>Créez une session vidéo et regardez-la avec votre équipe en temps réel.</p>
          </div>

          <button className="primary-btn" onClick={onCreateSession}>
            + Créer une session
          </button>
        </header>

        <section className="action-grid">
          <div className="action-card big">
            <h2>Créer une session</h2>
            <p>Lancez une salle vidéo synchronisée avec chat et participants.</p>
            <button onClick={onCreateSession}>Démarrer maintenant</button>
          </div>

          <div className="action-card">
            <h2>Rejoindre</h2>
            <input
              placeholder="Code session ex: TS-2048"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
            />
            <button onClick={handleJoin}>Rejoindre</button>
          </div>
        </section>

        <section className="sessions-panel">
          <h2>Mes sessions récentes</h2>

          {session ? (
            <div className="session-row">
              <div>
                <h3>{session.title}</h3>
                <p>Code : {session.code} · En attente</p>
              </div>
              <button onClick={() => onJoinSession(session.code)}>Ouvrir</button>
            </div>
          ) : (
            <p className="muted">Aucune session créée pour le moment.</p>
          )}
        </section>
      </main>
    </div>
  );
}