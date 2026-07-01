import { useEffect, useState } from "react";
import { logout } from "../auth";

const ENGINE_URL = import.meta.env.VITE_ENGINE_URL ?? "http://localhost:8000";
const API = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export default function Dashboard({ onCreateSession, onJoinSession, session }) {
  const [joinCode, setJoinCode] = useState("");
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    loadSessions();
  }, [session?.code]);

  async function loadSessions() {
    try {
      const res = await fetch(`${API}/sessions`);

      if (!res.ok) return;

      const data = await res.json();
      setSessions(data);
    } catch {
      setSessions([]);
    }
  }

  function handleJoin() {
    if (!joinCode.trim()) {
      alert("Entre un code de session.");
      return;
    }

    onJoinSession(joinCode.trim());
  }

  async function deleteSession(code) {
    if (!window.confirm("Supprimer cette session ?")) return;

    try {
      const res = await fetch(`${API}/sessions/${code}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        alert("Impossible de supprimer la session.");
        return;
      }

      setSessions((prev) => prev.filter((item) => item.code !== code));
    } catch {
      alert("Erreur lors de la suppression.");
    }
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

        <section className="sessions-panel past-sessions-panel">
          <div className="panel-title-row">
            <h2>Sessions passées</h2>
            <button onClick={loadSessions}>Actualiser</button>
          </div>

          {sessions.length ? (
            sessions.map((pastSession) => (
              <div className="session-row" key={pastSession.code}>
                <div>
                  <h3>{pastSession.title}</h3>
                  <p>
                    Code : {pastSession.code}
                    {pastSession.presenterName
                      ? ` · Présentateur : ${pastSession.presenterName}`
                      : ""}
                  </p>
                </div>

                <div className="session-actions">
                  <button onClick={() => onJoinSession(pastSession.code)}>
                    Ouvrir
                  </button>
                  <button
                    className="delete-session-btn"
                    onClick={() => deleteSession(pastSession.code)}
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="muted">Aucune session enregistrée.</p>
          )}
        </section>

        <section className="sessions-panel engine-panel">
          <div>
            <h2>Engine IA / Data</h2>
            <p className="muted">Ouvrir l'interface Engine dans un nouvel onglet.</p>
          </div>

          <button onClick={() => window.open(ENGINE_URL, "_blank", "noopener,noreferrer")}>
            Ouvrir Engine
          </button>
        </section>
      </main>
    </div>
  );
}
