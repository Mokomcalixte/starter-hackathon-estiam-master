import { useState } from "react";
import { register } from "../auth";
import "../styles/auth.css";

export default function Register({ onGoLogin }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleRegister(e) {
    e.preventDefault();
    setError("");

    try {
      await register(fullName, email, password);
      window.location.reload();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleRegister}>
        <h1>Créer un compte</h1>
        <p>Rejoignez votre espace Watch Together.</p>

        <input
          placeholder="Nom complet"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />

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

        <button type="submit">Créer mon compte</button>

        <small>
          Déjà un compte ?{" "}
          <button type="button" className="link" onClick={onGoLogin}>
            Se connecter
          </button>
        </small>
      </form>
    </div>
  );
}
