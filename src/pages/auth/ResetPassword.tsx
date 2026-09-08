import { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { useAppState } from '@/stores/AppState'
import { PasswordInput } from '@/components/auth/PasswordInput'
import { PasswordStrength } from '@/components/auth/PasswordStrength'
import { validatePassword } from '@/lib/auth'
import { Loader2, CheckCircle, ArrowLeft } from 'lucide-react'

export function ResetPasswordPage() {
  const { resetPassword } = useAppState()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') || ''

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!token) {
      setError('Invalid reset token. Please request a new one.')
      return
    }
    const passwordError = validatePassword(password)
    if (passwordError) {
      setError(passwordError)
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    const result = await resetPassword(token, password)
    setLoading(false)
    if (result.success) {
      setSuccess(true)
    } else if (result.error) {
      setError(result.error)
    }
  }

  if (success) {
    return (
      <>
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-success" />
          </div>
          <h2 className="text-xl font-serif font-bold text-text-primary mb-2">Password Reset</h2>
          <p className="text-sm text-text-muted">
            Your password has been successfully reset.
          </p>
        </div>
        <button
          onClick={() => navigate('/login')}
          className="btn-primary w-full py-3 text-sm cursor-pointer flex items-center justify-center gap-2"
        >
          Sign In
        </button>
      </>
    )
  }

  return (
    <>
      <div className="text-center mb-8">
        <h2 className="text-xl font-serif font-bold text-text-primary mb-2">Reset Password</h2>
        <p className="text-sm text-text-muted">
          Enter your new password below.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-3 rounded-xl bg-danger/10 border border-danger/20">
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="password" className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 block">New Password</label>
          <PasswordInput
            id="password"
            value={password}
            onChange={setPassword}
            placeholder="Enter new password"
            autoComplete="new-password"
            disabled={loading}
          />
          <PasswordStrength password={password} />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 block">Confirm Password</label>
          <PasswordInput
            id="confirmPassword"
            value={confirmPassword}
            onChange={setConfirmPassword}
            placeholder="Confirm new password"
            autoComplete="new-password"
            disabled={loading}
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
              Resetting...
            </>
          ) : (
            'RESET PASSWORD'
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
