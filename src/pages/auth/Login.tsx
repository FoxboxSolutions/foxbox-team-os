import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAppState } from '@/stores/AppState'
import { PasswordInput } from '@/components/auth/PasswordInput'
import { validateEmail } from '@/lib/auth'
import { Loader2 } from 'lucide-react'

export function LoginPage() {
  const { login, loginWithGoogle, loginWithFacebook, authLoading, authError, clearAuthError } = useAppState()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})

  const validate = (): boolean => {
    const newErrors: { email?: string; password?: string } = {}
    const emailError = validateEmail(email)
    if (emailError) newErrors.email = emailError
    if (!password) newErrors.password = 'Please enter your password.'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearAuthError()
    if (!validate()) return
    const result = await login(email, password)
    if (result.redirect) {
      navigate(result.redirect)
    } else if (!result.success && result.error) {
      setErrors({ password: result.error })
    }
  }

  const handleGoogleLogin = async () => {
    clearAuthError()
    await loginWithGoogle()
    // If loginWithGoogle succeeds, it does window.location.href to Google
    // No need to navigate here - the page will redirect away
    // If it fails, loginWithGoogle sets authError via context (shown above form)
  }

  const handleFacebookLogin = async () => {
    clearAuthError()
    const result = await loginWithFacebook()
    if (result.redirect) {
      navigate(result.redirect)
    } else if (result.success) {
      navigate('/app')
    }
  }

  return (
    <>
      <div className="text-center mb-8">
        <h2 className="text-xl font-serif font-bold text-text-primary mb-2">Welcome to Foxbox Team</h2>
        <p className="text-sm text-text-muted">Your team. Your strategy. Your growth.</p>
      </div>

      {authError && (
        <div className="mb-6 p-3 rounded-xl bg-danger/10 border border-danger/20">
          <p className="text-sm text-danger">{authError}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Email */}
        <div>
          <label htmlFor="email" className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 block">Email</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Enter your email"
            autoComplete="email"
            disabled={authLoading}
            className="input-field w-full"
          />
          {errors.email && <p className="text-xs text-danger mt-1.5">{errors.email}</p>}
        </div>

        {/* Password */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="password" className="text-xs font-semibold text-text-muted uppercase tracking-wider">Password</label>
            <Link to="/forgot-password" className="text-xs text-gold hover:text-gold-light transition-colors">
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            id="password"
            value={password}
            onChange={setPassword}
            disabled={authLoading}
          />
          {errors.password && <p className="text-xs text-danger mt-1.5">{errors.password}</p>}
        </div>

        {/* Remember me */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="remember"
            checked={rememberMe}
            onChange={e => setRememberMe(e.target.checked)}
            className="w-4 h-4 rounded border-border bg-surface text-gold focus:ring-gold/30 cursor-pointer"
          />
          <label htmlFor="remember" className="text-sm text-text-secondary cursor-pointer">Remember me</label>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={authLoading}
          className="btn-primary w-full py-3 text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {authLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Signing in...
            </>
          ) : (
            'SIGN IN'
          )}
        </button>
      </form>

      {/* Divider */}
      <div className="flex items-center gap-4 my-6">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-text-muted">OR</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Social Login */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={handleGoogleLogin}
          disabled={authLoading}
          className="btn-secondary py-3 text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Continue with Google
        </button>
        <button
          onClick={handleFacebookLogin}
          disabled={authLoading}
          className="btn-secondary py-3 text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#1877F2">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
          Continue with Facebook
        </button>
      </div>

      {/* Register link */}
      <p className="text-center mt-6 text-sm text-text-muted">
        Don't have an account?{' '}
        <Link to="/register" className="text-gold hover:text-gold-light transition-colors font-medium">
          Create an account
        </Link>
      </p>
    </>
  )
}
