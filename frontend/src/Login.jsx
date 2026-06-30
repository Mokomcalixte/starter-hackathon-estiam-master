import { useState } from 'react'
import { login, logout, getToken, authFetch } from './auth'

// Démo MINIMALE de l'authentification fournie (login + appel d'une route protégée).
// À remplacer par VOTRE interface — c'est juste un point de départ qui prouve que la
// chaîne front ↔ Core fonctionne.
export default function Login() {
  const [username, setUsername] = useState('alice')
  const [password, setPassword] = useState('password')
  const [user, setUser] = useState(null)
  const [me, setMe] = useState(null)
  const [error, setError] = useState(null)

  async function handleLogin(e) {
    e.preventDefault()
    setError(null)
    try {
      setUser(await login(username, password))
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleMe() {
    const res = await authFetch('/auth/me')
    setMe(res.ok ? await res.json() : { erreur: res.status })
  }

  function handleLogout() {
    logout()
    setUser(null)
    setMe(null)
  }

  const connected = Boolean(getToken())

  return (
    <section style={{ maxWidth: 380, margin: '2rem auto', textAlign: 'left' }}>
      <h2>🔐 Authentification (démo fournie)</h2>
      {!connected ? (
        <form onSubmit={handleLogin} style={{ display: 'grid', gap: '.5rem' }}>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="utilisateur"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="mot de passe"
          />
          <button type="submit">Se connecter</button>
          {error && <p style={{ color: 'crimson' }}>{error}</p>}
          <small>Comptes de démo : alice / bob / carol — mot de passe « password »</small>
        </form>
      ) : (
        <div style={{ display: 'grid', gap: '.5rem' }}>
          <p>Connecté{user ? ` : ${user.username} (${user.role})` : ''}.</p>
          <button onClick={handleMe}>Appeler GET /auth/me (route protégée)</button>
          <button onClick={handleLogout}>Se déconnecter</button>
          {me && <pre>{JSON.stringify(me, null, 2)}</pre>}
        </div>
      )}
    </section>
  )
}
