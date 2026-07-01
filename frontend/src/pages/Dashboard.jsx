import { useEffect, useMemo, useState } from "react";
import { getUser, logout } from "../auth";

const ENGINE_URL = import.meta.env.VITE_ENGINE_URL ?? "http://localhost:8000";
const API = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

const STATUS_LABELS = {
  created: "Préparée",
  active: "En cours",
  ended: "Terminée",
};

function hiddenSessionsKey() {
  const user = getUser();
  return `teamstream_hidden_sessions_${user?.id || user?.email || "anonymous"}`;
}

function readHiddenSessions() {
  try {
    return JSON.parse(localStorage.getItem(hiddenSessionsKey()) || "[]");
  } catch {
    return [];
  }
}

export default function Dashboard({ refreshKey, onCreateSession, onJoinSession }) {
  const [joinCode, setJoinCode] = useState("");
  const [sessions, setSessions] = useState([]);
  const [hiddenSessions, setHiddenSessions] = useState(readHiddenSessions);

  const visibleSessions = useMemo(
    () => sessions.filter((item) => !hiddenSessions.includes(item.code)),
    [sessions, hiddenSessions]
  );

  useEffect(() => {
    loadSessions();
  }, [refreshKey]);

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

  function removeFromMyList(code) {
    if (!window.confirm("Retirer cette session de votre liste ?")) return;

    setHiddenSessions((prev) => {
      const next = [...new Set([...prev, code])];
      localStorage.setItem(hiddenSessionsKey(), JSON.stringify(next));
      return next;
    });
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

        <section className="sessions-panel past-sessions-panel">
          <div className="panel-title-row">
            <h2>Sessions enregistrées</h2>
            <button onClick={loadSessions}>Actualiser</button>
          </div>

          {visibleSessions.length ? (
            visibleSessions.map((item) => (
              <div className="session-row" key={item.code}>
                <div>
                  <div className="session-title-line">
                    <h3>{item.title}</h3>
                    <span className={`session-status ${item.status || "created"}`}>
                      {STATUS_LABELS[item.status] || STATUS_LABELS.created}
                    </span>
                  </div>
                  <p>
                    Code : {item.code}
                    {item.presenterName
                      ? ` · Présentateur : ${item.presenterName}`
                      : ""}
                  </p>
                </div>

                <div className="session-actions">
                  <button onClick={() => onJoinSession(item.code)}>
                    Ouvrir
                  </button>
                  <button
                    className="delete-session-btn"
                    onClick={() => removeFromMyList(item.code)}
                  >
                    Retirer
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="muted">Aucune session enregistrée dans votre liste.</p>
          )}
        </section>

        <section className="sessions-panel engine-panel">
          <div>
            <h2>Engine IA / Data</h2>
            <p className="muted">Ouvrir l'interface Engine dans un nouvel onglet.</p>
          </div>

          <button
            onClick={() =>
              window.open(ENGINE_URL, "_blank", "noopener,noreferrer")
            }
          >
            Ouvrir Engine
          </button>
        </section>
      </main>
    </div>
  );
}
