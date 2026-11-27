import { useState } from 'react'
import type { FormEvent } from 'react'
import brandMark from '../../../Logos/pagelogo2.png'
import googleIcon from '../../../Logos/icons/Google_Symbol_2.webp'
import facebookIcon from '../../../Logos/icons/communication.png'
import { forgotPassword, login as loginAccount, resendOtp, verifyLogin } from '../services/authApi'
import './login.css'

type LoginProps = {
  onSwitchToRegister: () => void
  onAuthenticated?: (username?: string) => void
}

export function Login({ onSwitchToRegister, onAuthenticated }: LoginProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [challengeId, setChallengeId] = useState('')
  const [otp, setOtp] = useState('')
  const [rememberMe, setRememberMe] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setLoading(true)
    setStatus('')
    try {
      const result = await loginAccount(
        String(form.get('email') ?? ''),
        String(form.get('password') ?? ''),
      )
      setChallengeId(result.challengeId)
      setStatus('Enter the 6-digit code sent to your email.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Sign in failed.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setStatus('')
    try {
      const result = await verifyLogin(challengeId, otp, rememberMe)
      setStatus('Signed in successfully.')
      onAuthenticated?.(result.user?.username)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Verification failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-page">
      <section
        className="auth-card auth-card--login auth-card--backward"
        aria-label="PromptPilot authentication"
      >
        <div className="auth-form-side">
          <div className="mobile-brand">
            <img src={brandMark} alt="PromptPilot" />
          </div>

          <div className="auth-form">
            <header className="auth-heading">
              <p className="eyebrow">PROMPTPILOT</p>
              <h1>Welcome Back</h1>
              <p>Sign in to continue crafting better prompts.</p>
            </header>

            <form onSubmit={handleSubmit}>
              <label className="field">
                <span>Email</span>
                <input type="email" name="email" placeholder="you@example.com" required />
              </label>

              <label className="field">
                <span>Password</span>
                <div className="password-wrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    placeholder="Enter your password"
                    minLength={6}
                    required
                  />
                  <button type="button" className="password-toggle" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </label>

              <div className="form-meta">
                <label className="remember"><input type="checkbox" name="remember" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} /><span>Remember me</span></label>
                <button
                  type="button"
                  className="text-button"
                  onClick={async () => {
                    const email = (document.querySelector('input[name="email"]') as HTMLInputElement | null)?.value
                    if (!email) {
                      setStatus('Enter your email address first.')
                      return
                    }
                    try {
                      await forgotPassword(email)
                      setStatus('If that account exists, a password reset code was sent.')
                    } catch (error) {
                      setStatus(error instanceof Error ? error.message : 'Could not send reset code.')
                    }
                  }}
                >
                  Forgot password?
                </button>
              </div>

              {status && <p className="form-status" role="status">{status}</p>}
              <button className="primary-button" type="submit" disabled={loading || Boolean(challengeId)}>
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>

            {challengeId && (
              <form className="otp-form" onSubmit={handleVerify}>
                <label className="field">
                  <span>Verification code</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    placeholder="6-digit code"
                    value={otp}
                    onChange={(event) => setOtp(event.target.value)}
                    required
                  />
                </label>
                <button className="primary-button" type="submit" disabled={loading}>Verify and sign in</button>
                <button
                  type="button"
                  className="text-button otp-resend"
                  onClick={async () => {
                    try {
                      await resendOtp(challengeId)
                      setStatus('A new verification code was sent.')
                    } catch (error) {
                      setStatus(error instanceof Error ? error.message : 'Could not resend code.')
                    }
                  }}
                >
                  Resend code
                </button>
              </form>
            )}

            <div className="divider"><span>or continue with</span></div>
            <div className="social-buttons">
              <button type="button" className="social-button" aria-label="Continue with Google">
                <img className="social-icon" src={googleIcon} alt="" /><span>Google</span>
              </button>
              <button type="button" className="social-button" aria-label="Continue with Facebook">
                <img className="social-icon" src={facebookIcon} alt="" /><span>Facebook</span>
              </button>
            </div>

            <p className="switch-auth">
              Don't have an account?
              <button type="button" onClick={onSwitchToRegister}>Sign up</button>
            </p>
          </div>

          <footer>© 2026 PROMPTPILOT</footer>
        </div>

        <aside className="auth-art" aria-label="PromptPilot brand">
          <div className="art-grid" />
          <div className="art-brand">
            <img src={brandMark} alt="" />
            <span>PromptPilot</span>
          </div>
          <div className="art-content">
            <span className="art-kicker">WELCOME BACK</span>
            <h2>Continue building clearer AI workflows.</h2>
            <p>Pick up where you left off, refine your ideas, and route each prompt to the right AI.</p>
            <div className="workflow-steps" aria-label="PromptPilot workflow">
              <div><span>01</span><strong>Write</strong><small>Start with natural language</small></div>
              <div><span>02</span><strong>Refine</strong><small>Get a structured prompt</small></div>
              <div><span>03</span><strong>Route</strong><small>Find the right AI agent</small></div>
            </div>
          </div>
          <div className="art-glow art-glow-one" />
          <div className="art-glow art-glow-two" />
        </aside>
      </section>
    </main>
  )
}