const API_BASE = '/api/auth'
let accessToken: string | null = null
let csrfToken: string | null = null

async function ensureCsrf(): Promise<string> {
  if (csrfToken) return csrfToken
  const response = await fetch(`${API_BASE}/csrf`, { credentials: 'include' })
  const data = await response.json()
  if (!response.ok) throw new Error(data.message ?? 'Could not initialize security session')
  csrfToken = data.csrfToken
  if (!csrfToken) throw new Error('Could not initialize security session')
  return csrfToken
}

async function request(path: string, body?: unknown) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (body !== undefined) headers['X-CSRF-Token'] = await ensureCsrf()
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  const response = await fetch(`${API_BASE}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers,
    credentials: 'include',
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await response.json().catch(() => ({ message: 'The server returned an invalid response.' }))
  if (!response.ok) throw new Error(data.message ?? 'Request failed')
  return data
}

export async function register(input: {
  username: string
  email: string
  password: string
  confirmPassword: string
  termsAccepted: boolean
  syncPrompts: boolean
}) {
  return request('/register', input)
}

export async function verifyRegistration(challengeId: string, code: string) {
  const data = await request('/verify-registration', { challengeId, code })
  accessToken = data.accessToken
  return data
}

export async function login(email: string, password: string) {
  return request('/login', { email, password })
}

export async function verifyLogin(challengeId: string, code: string, rememberMe: boolean) {
  const data = await request('/verify-login', { challengeId, code, rememberMe })
  accessToken = data.accessToken
  return data
}

export async function resendOtp(challengeId: string) {
  return request('/resend-otp', { challengeId })
}

export async function forgotPassword(email: string) {
  return request('/forgot-password', { email })
}

export async function logout() {
  try {
    await request('/logout', {})
  } finally {
    accessToken = null
  }
}
