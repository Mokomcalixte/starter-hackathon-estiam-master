import { useState } from "react";
import { getToken, getUser } from "./auth";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import CreateSession from "./pages/CreateSession";
import WatchRoom from "./pages/WatchRoom";
import "./styles/auth.css";

function App() {
  const [page, setPage] = useState("login");
  const [session, setSession] = useState(null);

  const connected = Boolean(getToken());
  const currentUser = getUser();

  async function handleJoinSession(code) {
    try {
      const res = await fetch(`http://localhost:3000/sessions/${code}`);

      if (!res.ok) {
        alert("Session introuvable.");
        return;
      }

      const foundSession = await res.json();

      setSession({
        ...foundSession,
        videoUrl: `http://localhost:3000/uploads/${foundSession.videoPath}`,
        presenterName: "Présentateur",
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
        onCreate={(newSession) => {
          setSession({
            ...newSession,
            presenterName: currentUser?.fullName || "Présentateur",
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