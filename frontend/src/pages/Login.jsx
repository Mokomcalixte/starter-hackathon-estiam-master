import { useState } from "react";
import { login } from "../auth";
import "../styles/auth.css";

export default function Login({ onGoRegister }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleLogin(e) {
    e.preventDefault();
    setError("");

    try {
      await login(email, password);
      window.location.reload();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleLogin}>
        <h1>Connexion</h1>
        <p>Accédez à votre espace TeamStream.</p>

        <input
          placeholder="Adresse email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <span className="error">{error}</span>}

        <button type="submit">Se connecter</button>

        <small>
          Pas encore de compte ?{" "}
          <button type="button" className="link" onClick={onGoRegister}>
            Créer un compte
          </button>
        </small>
      </form>
    </div>
  );
}
