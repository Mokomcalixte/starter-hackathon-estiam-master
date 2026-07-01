import { useState } from "react";
import { getToken, getUser } from "./auth";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import CreateSession from "./pages/CreateSession";
import WatchRoom from "./pages/WatchRoom";
import "./styles/auth.css";

const CURRENT_SESSION_KEY = "teamstream_current_session";

function getStoredSession() {
  const storedSession = localStorage.getItem(CURRENT_SESSION_KEY);

  if (!storedSession) {
    return null;
  }

  try {
    return JSON.parse(storedSession);
  } catch {
    localStorage.removeItem(CURRENT_SESSION_KEY);
    return null;
  }
}

function App() {
  const [page, setPage] = useState("login");
  const [session, setSession] = useState(getStoredSession);

  const connected = Boolean(getToken());
  const currentUser = getUser();

  function saveSession(nextSession) {
    setSession(nextSession);
    localStorage.setItem(CURRENT_SESSION_KEY, JSON.stringify(nextSession));
  }

  async function handleJoinSession(code) {
    try {
      const res = await fetch(`http://localhost:3000/sessions/${code}`);

      if (!res.ok) {
        alert("Session introuvable.");
        return;
      }

      const foundSession = await res.json();

      saveSession({
        ...foundSession,
        videoUrl: `http://localhost:3000/uploads/${foundSession.videoPath}`,
        presenterName: foundSession.presenterName || "Présentateur",
        currentUserName: currentUser?.fullName || "Participant",
        isPresenter: false,
      });

      setPage("watch");
    } catch (error) {
      alert("Erreur lors de la recherche de la session.");
    }
  }

  if (connected && page === "create") {
    return (
      <CreateSession
        onCancel={() => setPage("dashboard")}
        currentUser={currentUser}
        onCreate={(newSession) => {
          saveSession({
            ...newSession,
            presenterName:
              newSession.presenterName || currentUser?.fullName || "Présentateur",
            currentUserName: currentUser?.fullName || "Vous",
            isPresenter: true,
          });

          setPage("watch");
        }}
      />
    );
  }

  if (connected && page === "watch") {
    return <WatchRoom session={session} onBack={() => setPage("dashboard")} />;
  }

  if (connected) {
    return (
      <Dashboard
        session={session}
        onCreateSession={() => setPage("create")}
        onJoinSession={handleJoinSession}
      />
    );
  }

  if (page === "register") {
    return <Register onGoLogin={() => setPage("login")} />;
  }

  return <Login onGoRegister={() => setPage("register")} />;
}

export default App;
