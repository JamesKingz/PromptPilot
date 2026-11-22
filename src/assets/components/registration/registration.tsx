import { useState } from 'react'
import type { FormEvent } from 'react'
import brandMark from '../../../Logos/pagelogo2.png'
import { register as createAccount, resendOtp, verifyRegistration } from '../services/authApi'
import './registration.css'

type RegistrationProps = {
  onSwitchToLogin: () => void
}

export function Registration({ onSwitchToLogin }: RegistrationProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [status, setStatus] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [challengeId, setChallengeId] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const password = String(form.get('password') ?? '')
    const confirmPassword = String(form.get('confirmPassword') ?? '')

    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match.')
      return
    }

    setPasswordError('')
    setLoading(true)
    setStatus('')
    try {
      const result = await createAccount({
        username: String(form.get('name') ?? ''),
        email: String(form.get('email') ?? ''),
        password,
        confirmPassword,
        termsAccepted: form.get('terms') === 'on',
        syncPrompts: form.get('syncPrompts') === 'on',
      })
      setChallengeId(result.challengeId)
      setStatus('Enter the 6-digit code sent to your email.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Registration failed.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setStatus('')
    try {
      await verifyRegistration(challengeId, otp)
      setStatus('Account verified. You are now signed in.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Verification failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card auth-card--register auth-card--forward" aria-label="PromptPilot registration">
        <div className="auth-form-side">
          <div className="mobile-brand">
            <img src={brandMark} alt="PromptPilot" />
          </div>

          <div className="auth-form">
            <header className="auth-heading">
              <p className="eyebrow">PROMPTPILOT</p>
              <h1>Create Account</h1>
              <p>A better prompt workflow begins with your account.</p>
            </header>

            <form onSubmit={handleSubmit}>
              <label className="field">
                <span>Username</span>
                <input type="text" name="name" placeholder="Choose a username" minLength={2} required />
              </label>

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
                    placeholder="Create a strong password"
                    minLength={8}
                    required
                    onChange={() => setPasswordError('')}
                  />
                  <button type="button" className="password-toggle" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </label>

              <label className="field">
                <span>Re-enter Password</span>
                <div className="password-wrap">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    placeholder="Re-enter your password"
                    minLength={8}
                    required
                    onChange={() => setPasswordError('')}
                  />
                  <button type="button" className="password-toggle" onClick={() => setShowConfirmPassword((visible) => !visible)} aria-label={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'}>
                    {showConfirmPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </label>

              {passwordError && <p className="field-error" role="alert">{passwordError}</p>}
              <label className="terms"><input type="checkbox" name="terms" required /><span>I agree to the Terms and Privacy Policy</span></label>
              <label className="terms"><input type="checkbox" name="syncPrompts" /><span>Sync my prompts to my account for 30 days</span></label>

              {status && <p className="form-status" role="status">{status}</p>}
              <button className="primary-button" type="submit" disabled={loading || Boolean(challengeId)}>
                {loading ? 'Creating account...' : 'Create account'}
              </button>
            </form>

            {challengeId && (
              <form className="otp-form" onSubmit={handleVerify}>
                <label className="field">
                  <span>Verification code</span>
                  <input
                    type="text"
                    name="otp"
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
                <button className="primary-button" type="submit" disabled={loading}>Verify email</button>
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

            <p className="switch-auth">
              Already have an account?
              <button type="button" onClick={onSwitchToLogin}>Sign in</button>
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
            <span className="art-kicker">GET STARTED</span>
            <h2>Make every AI workflow start with more clarity.</h2>
            <p>Create a private workspace for better prompts, clearer outputs, and every kind of task.</p>
          </div>
          <div className="art-glow art-glow-one" />
          <div className="art-glow art-glow-two" />
        </aside>
      </section>
    </main>
  )
}