import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppState } from '@/stores/AppState'
import { validateEmail } from '@/lib/auth'
import { Loader2, CheckCircle, ArrowLeft } from 'lucide-react'

export function ForgotPasswordPage() {
  const { requestPasswordReset } = useAppState()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const emailError = validateEmail(email)
    if (emailError) {
      setError(emailError)
      return
    }
    setLoading(true)
    const result = await requestPasswordReset(email)
    setLoading(false)
    if (result.success) {
      setSent(true)
    } else if (result.error) {
      setError(result.error)
    }
  }

  if (sent) {
    return (
      <>
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-success" />
          </div>
          <h2 className="text-xl font-serif font-bold text-text-primary mb-2">Check Your Email</h2>
          <p className="text-sm text-text-muted">
            If an account exists with <span className="text-text-secondary">{email}</span>, we've sent a password reset link.
          </p>
        </div>
        <p className="text-xs text-text-muted text-center mb-6">
          Didn't receive the email? Check your spam folder or try again.
        </p>
        <Link
          to="/login"
          className="btn-secondary w-full py-3 text-sm flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Login
        </Link>
      </>
    )
  }

  return (
    <>
      <div className="text-center mb-8">
        <h2 className="text-xl font-serif font-bold text-text-primary mb-2">Forgot Password?</h2>
        <p className="text-sm text-text-muted">
          Enter your email address and we'll send you a link to reset your password.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-3 rounded-xl bg-danger/10 border border-danger/20">
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="email" className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 block">Email</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Enter your email"
            autoComplete="email"
            disabled={loading}
            className="input-field w-full"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full py-3 text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Sending...
            </>
          ) : (
            'SEND RESET LINK'
          )}
        </button>
      </form>

      <p className="text-center mt-6 text-sm text-text-muted">
        <Link to="/login" className="text-gold hover:text-gold-light transition-colors font-medium inline-flex items-center gap-1">
          <ArrowLeft className="w-3 h-3" />
          Back to Login
        </Link>
      </p>
    </>
  )
}
