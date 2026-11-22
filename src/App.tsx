import { useState } from 'react'
import { Login } from './assets/components/login/login'
import { Registration } from './assets/components/registration/registration'
import './App.css'

function App() {
  const [page, setPage] = useState<'login' | 'registration'>('login')
  const [direction, setDirection] = useState<'forward' | 'backward'>('backward')

  const showRegistration = () => {
    setDirection('forward')
    setPage('registration')
  }

  const showLogin = () => {
    setDirection('backward')
    setPage('login')
  }

  return (
    <div className={`auth-page-transition auth-page-transition--${direction}`} key={page}>
      {page === 'login'
        ? <Login onSwitchToRegister={showRegistration} />
        : <Registration onSwitchToLogin={showLogin} />}
    </div>
  )
}

export default App
