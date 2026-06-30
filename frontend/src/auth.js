// Petit helper d'authentification (point de départ — adaptez-le à votre app).
// Il parle au Core NestJS (`backend/`) : login, stockage du token, fetch authentifié.

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
const TOKEN_KEY = 'hackathon_token'

export async function login(username, password) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) throw new Error('Identifiants invalides')
  const data = await res.json()
  localStorage.setItem(TOKEN_KEY, data.accessToken)
  return data.user
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY)
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

// fetch authentifié : ajoute automatiquement `Authorization: Bearer <token>`.
export async function authFetch(path, options = {}) {
  const token = getToken()
  return fetch(`${API}${path}`, {
    ...options,
    headers: {
      ...(options.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
}
