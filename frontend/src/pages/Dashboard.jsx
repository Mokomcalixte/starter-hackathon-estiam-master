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
          <a className="active">Accueil</a>
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
            <h1>Bienvenue</h1>
            <p>Créez ou rejoignez une session vidéo synchronisée.</p>
          </div>
        </header>

        <section className="action-grid">
          <div className="action-card big">
            <h2>Créer une session</h2>
            <p>Importez une vidéo et devenez présentateur.</p>
            <button onClick={onCreateSession}>Créer une session</button>
          </div>

          <div className="action-card">
            <h2>Rejoindre une session</h2>
            <p>Entrez le code envoyé par le présentateur.</p>

            <input
              placeholder="Ex : TS-2048"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
            />

            <button onClick={handleJoin}>Rejoindre</button>
          </div>
        </section>

        <section className="sessions-panel">
          <h2>Session en cours</h2>

          {session ? (
            <div className="session-row">
              <div>
                <h3>{session.title}</h3>
                <p>Code : {session.code}</p>
              </div>

              <button onClick={() => onJoinSession(session.code)}>
                Ouvrir
              </button>
            </div>
          ) : (
            <p className="muted">Aucune session active pour le moment.</p>
          )}
        </section>
      </main>
    </div>
  );
}