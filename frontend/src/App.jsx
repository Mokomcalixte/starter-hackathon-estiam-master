import { useState } from "react";
import { getToken } from "./auth";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import "./styles/auth.css";

function App() {
  const [page, setPage] = useState("login");
  const connected = Boolean(getToken());

  if (connected) {
    return (
      <Dashboard
        onOpenWatch={() => alert("On fera la page Watch Together après")}
      />
    );
  }

  if (page === "register") {
    return <Register onGoLogin={() => setPage("login")} />;
  }

  return <Login onGoRegister={() => setPage("register")} />;
}

export default App;