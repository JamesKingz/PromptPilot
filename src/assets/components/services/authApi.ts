const API_BASE = '/api/auth'
let accessToken: string | null = null
let csrfToken: string | null = null
let restoreSessionPromise: Promise<{ user: { username: string } } | null> | null = null

async function ensureCsrf(): Promise<string> {
  if (csrfToken) return csrfToken
  const response = await fetch(`${API_BASE}/csrf`, { credentials: 'include' })
  const data = await response.json()
  if (!response.ok) throw new Error(data.message ?? 'Could not initialize security session')
  csrfToken = data.csrfToken
  if (!csrfToken) throw new Error('Could not initialize security session')
  return csrfToken
}

async function request(path: string, body?: unknown, method?: 'GET' | 'POST' | 'PATCH' | 'DELETE', allowRefresh = true): Promise<any> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (body !== undefined) headers['X-CSRF-Token'] = await ensureCsrf()
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  const response = await fetch(`${API_BASE}${path}`, {
    method: method ?? (body === undefined ? 'GET' : 'POST'),
    headers,
    credentials: 'include',
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await response.json().catch(() => ({ message: 'The server returned an invalid response.' }))
  if (
    allowRefresh &&
    response.status === 401 &&
    path !== '/refresh' &&
    accessToken &&
    (data.code === 'TOKEN_EXPIRED' || data.code === 'TOKEN_INVALID')
  ) {
    await ensureCsrf()
    const refreshResponse = await fetch(`${API_BASE}/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': await ensureCsrf(),
      },
      credentials: 'include',
      body: '{}',
    })
    const refreshData = await refreshResponse.json().catch(() => ({}))
    if (refreshResponse.ok && refreshData.accessToken) {
      accessToken = refreshData.accessToken
      return request(path, body, method, false)
    }
  }
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

export async function updateUsername(username: string) {
  return request('/account/username', { username }, 'PATCH')
}

export async function changePassword(currentPassword: string, newPassword: string, confirmPassword: string) {
  return request('/account/change-password', { currentPassword, newPassword, confirmPassword }, 'POST')
}

export async function updatePromptHistory(enabled: boolean, retentionDays: number) {
  return request('/account/history', { enabled, retentionDays }, 'PATCH')
}

export async function deleteAccount(password: string) {
  return request('/account', { password }, 'DELETE')
}

export async function getSessions() {
  return request('/sessions')
}

export async function revokeSession(sessionId: string) {
  return request(`/sessions/${sessionId}`, {}, 'DELETE')
}

export async function revokeOtherSessions() {
  return request('/sessions/revoke-others', {}, 'POST')
}

export async function getMe() {
  return request('/me')
}

export function restoreSession() {
  if (restoreSessionPromise) return restoreSessionPromise

  restoreSessionPromise = (async () => {
    try {
      await ensureCsrf()
      const refreshData = await request('/refresh', {}, 'POST')
      accessToken = refreshData.accessToken
      const meData = await getMe()
      return meData
    } catch {
      accessToken = null
      return null
    } finally {
      restoreSessionPromise = null
    }
  })()

  return restoreSessionPromise
}
