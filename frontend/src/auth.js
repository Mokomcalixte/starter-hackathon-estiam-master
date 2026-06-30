const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
const TOKEN_KEY = 'hackathon_token'

export async function register(fullName, email, password) {
  const res = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullName, email, password }),
  })

  if (!res.ok) {
    throw new Error('Impossible de créer le compte')
  }

  const data = await res.json()
  localStorage.setItem(TOKEN_KEY, data.accessToken)
  return data.user
}

export async function login(email, password) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  if (!res.ok) {
    throw new Error('Email ou mot de passe invalide')
  }

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