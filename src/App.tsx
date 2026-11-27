import { useEffect, useRef, useState } from 'react'
import { Login } from './assets/components/login/login'
import { Registration } from './assets/components/registration/registration'
import PromptPilotDashboard from './assets/components/dashboard/dashboard'
import PromptPilotSettings from './assets/components/settings/settings'
import { restoreSession } from './assets/components/services/authApi'
import './App.css'

type AppPage = 'login' | 'registration' | 'dashboard' | 'settings'

const ACTIVE_PAGE_KEY = 'promptpilot_active_page'

const getSavedProtectedPage = (): 'dashboard' | 'settings' => {
  const path = window.location.pathname.replace(/\/+$/, '')
  if (path === '/settings') return 'settings'
  if (path === '/dashboard') return 'dashboard'
  return sessionStorage.getItem(ACTIVE_PAGE_KEY) === 'settings' ? 'settings' : 'dashboard'
}

const getInitialAuthPage = (): 'login' | 'registration' => {
  const path = window.location.pathname.replace(/\/+$/, '')
  return path === '/registration' ? 'registration' : 'login'
}

const syncUrlPath = (targetPage: AppPage, replace = false) => {
  const nextPath = targetPage === 'dashboard' ? '/' : `/${targetPage}`
  if (window.location.pathname !== nextPath) {
    if (replace) {
      window.history.replaceState({ page: targetPage }, '', nextPath)
    } else {
      window.history.pushState({ page: targetPage }, '', nextPath)
    }
  }
}

function App() {
  const [page, setPage] = useState<AppPage>(getInitialAuthPage)
  const [username, setUsername] = useState('there')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [profilePicture, setProfilePicture] = useState<string>(() =>
    localStorage.getItem('promptpilot_profile_picture') || ''
  )
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() =>
    (localStorage.getItem('promptpilot_theme') as 'light' | 'dark' | 'system') || 'system'
  )
  const [restoringSession, setRestoringSession] = useState(true)
  const [direction, setDirection] = useState<'forward' | 'backward'>('backward')
  const [outgoingPage, setOutgoingPage] = useState<AppPage | null>(null)
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const themeTransitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (transitionTimer.current) clearTimeout(transitionTimer.current)
    if (themeTransitionTimer.current) clearTimeout(themeTransitionTimer.current)
  }, [])

  useEffect(() => {
    let active = true
    void restoreSession()
      .then((result) => {
        if (!active) return
        if (result?.user) {
          const targetPage = getSavedProtectedPage()
          setUsername(result.user.username)
          setIsAuthenticated(true)
          sessionStorage.setItem(ACTIVE_PAGE_KEY, targetPage)
          setPage(targetPage)
          syncUrlPath(targetPage, true)
        } else {
          sessionStorage.removeItem(ACTIVE_PAGE_KEY)
          const authPage = getInitialAuthPage()
          setPage(authPage)
          syncUrlPath(authPage, true)
        }
      })
      .catch(() => {
        if (!active) return
        sessionStorage.removeItem(ACTIVE_PAGE_KEY)
        const authPage = getInitialAuthPage()
        setPage(authPage)
        syncUrlPath(authPage, true)
      })
      .finally(() => {
        if (active) setRestoringSession(false)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const handlePopState = () => {
      setOutgoingPage(null)
      if (isAuthenticated) {
        const nextProtected = getSavedProtectedPage()
        sessionStorage.setItem(ACTIVE_PAGE_KEY, nextProtected)
        setPage(nextProtected)
      } else {
        setPage(getInitialAuthPage())
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [isAuthenticated])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const resolved = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme
      document.documentElement.dataset.theme = resolved
      localStorage.setItem('promptpilot_theme', theme)
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])

  const handleThemeChange = (
    nextTheme: 'light' | 'dark' | 'system',
    origin?: { x: number; y: number }
  ) => {
    if (nextTheme === theme) return

    const root = document.documentElement
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (origin) {
      root.style.setProperty('--theme-origin-x', `${origin.x}px`)
      root.style.setProperty('--theme-origin-y', `${origin.y}px`)
    } else {
      root.style.setProperty('--theme-origin-x', '50vw')
      root.style.setProperty('--theme-origin-y', '50vh')
    }

    const docWithTransition = document as Document & {
      startViewTransition?: (cb: () => void) => { finished: Promise<void> }
    }

    if (!reducedMotion && typeof docWithTransition.startViewTransition === 'function') {
      root.classList.add('theme-view-transitioning')
      const transition = docWithTransition.startViewTransition(() => {
        const media = window.matchMedia('(prefers-color-scheme: dark)')
        const resolved = nextTheme === 'system' ? (media.matches ? 'dark' : 'light') : nextTheme
        root.dataset.theme = resolved
        localStorage.setItem('promptpilot_theme', nextTheme)
        setTheme(nextTheme)
      })
      void transition.finished.finally(() => {
        root.classList.remove('theme-view-transitioning')
      })
      return
    }

    root.classList.add('theme-transitioning')
    setTheme(nextTheme)
    if (themeTransitionTimer.current) clearTimeout(themeTransitionTimer.current)
    themeTransitionTimer.current = setTimeout(() => {
      root.classList.remove('theme-transitioning')
    }, 360)
  }

  const switchPage = (nextPage: 'login' | 'registration', nextDirection: 'forward' | 'backward') => {
    if (transitionTimer.current || nextPage === page) return
    setOutgoingPage(page)
    setDirection(nextDirection)
    setPage(nextPage)
    syncUrlPath(nextPage)
    transitionTimer.current = setTimeout(() => {
      setOutgoingPage(null)
      transitionTimer.current = null
    }, 900)
  }

  const showRegistration = () => {
    switchPage('registration', 'forward')
  }

  const showLogin = () => {
    switchPage('login', 'backward')
  }

  const openDashboard = (authenticatedUsername?: string) => {
    setUsername(authenticatedUsername?.trim() || 'there')
    setIsAuthenticated(true)
    setOutgoingPage(null)
    sessionStorage.setItem(ACTIVE_PAGE_KEY, 'dashboard')
    setPage('dashboard')
    syncUrlPath('dashboard')
  }

  const showDashboardLogin = () => {
    setIsAuthenticated(false)
    setOutgoingPage(null)
    sessionStorage.removeItem(ACTIVE_PAGE_KEY)
    setPage('login')
    syncUrlPath('login')
  }

  const openSettings = () => {
    setOutgoingPage(null)
    sessionStorage.setItem(ACTIVE_PAGE_KEY, 'settings')
    setPage('settings')
    syncUrlPath('settings')
  }

  const openDashboardPage = () => {
    setOutgoingPage(null)
    sessionStorage.setItem(ACTIVE_PAGE_KEY, 'dashboard')
    setPage('dashboard')
    syncUrlPath('dashboard')
  }

  if (restoringSession) {
    return (
      <main className="session-restoring" aria-live="polite">
        <div className="session-restoring-card">
          <span className="session-restoring-dot" aria-hidden="true" />
          <span>Restoring your session...</span>
        </div>
      </main>
    )
  }

  const renderPage = (pageName: AppPage) =>
    pageName === 'login'
      ? <Login onSwitchToRegister={showRegistration} onAuthenticated={openDashboard} />
      : pageName === 'registration'
        ? <Registration onSwitchToLogin={showLogin} onAuthenticated={openDashboard} />
        : pageName === 'dashboard'
          ? <PromptPilotDashboard
              username={username}
              onLogout={showDashboardLogin}
              onOpenSettings={openSettings}
              onOpenDashboard={openDashboardPage}
              profilePicture={profilePicture}
            />
          : <PromptPilotSettings
              username={username}
              onUsernameChanged={(nextUsername) => setUsername(nextUsername)}
              onLogout={showDashboardLogin}
              onOpenDashboard={openDashboardPage}
              profilePicture={profilePicture}
              onProfilePictureChanged={(picture) => {
                setProfilePicture(picture)
                if (picture) {
                  localStorage.setItem('promptpilot_profile_picture', picture)
                } else {
                  localStorage.removeItem('promptpilot_profile_picture')
                }
              }}
              theme={theme}
              onThemeChanged={handleThemeChange}
            />

  return (
    <div className={`auth-page-transition auth-page-transition--${direction}${outgoingPage ? ' auth-page-transition--switching' : ''}`}>
      {outgoingPage && (
        <div className="auth-page-layer auth-page-layer--outgoing" aria-hidden="true">
          {renderPage(outgoingPage)}
        </div>
      )}
      <div className={outgoingPage ? 'auth-page-layer auth-page-layer--incoming' : 'auth-page-layer'} key={page}>
        {renderPage(page)}
      </div>
    </div>
  )
}

export default App