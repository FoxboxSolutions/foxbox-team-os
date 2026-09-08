import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAppState } from '@/stores/AppState'
import { PasswordInput } from '@/components/auth/PasswordInput'
import { PasswordStrength } from '@/components/auth/PasswordStrength'
import { validateEmail, validatePassword, validateFullName, getRoleDisplayName } from '@/lib/auth'
import type { AuthRole } from '@/types'
import { Loader2 } from 'lucide-react'

const ROLES: AuthRole[] = ['administrator', 'mediabuyer', 'confirmator']

export function RegisterPage() {
  const { register, authLoading, authError, clearAuthError } = useAppState()
  const navigate = useNavigate()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [requestedRole, setRequestedRole] = useState<AuthRole>('mediabuyer')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    const nameError = validateFullName(fullName)
    if (nameError) newErrors.fullName = nameError
    const emailError = validateEmail(email)
    if (emailError) newErrors.email = emailError
    const passwordError = validatePassword(password)
    if (passwordError) newErrors.password = passwordError
    if (password !== confirmPassword) newErrors.confirmPassword = 'Passwords do not match.'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearAuthError()
    if (!validate()) return
    const result = await register({ fullName, email, password, requestedRole })
    if (result.success && result.redirect) {
      navigate(result.redirect)
    }
  }

  return (
    <>
      <div className="text-center mb-8">
        <h2 className="text-xl font-serif font-bold text-text-primary mb-2">Join Foxbox Team</h2>
        <p className="text-sm text-text-muted">Build smarter. Work together.</p>
      </div>

      {authError && (
        <div className="mb-6 p-3 rounded-xl bg-danger/10 border border-danger/20">
          <p className="text-sm text-danger">{authError}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Full Name */}
        <div>
          <label htmlFor="fullName" className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 block">Full Name</label>
          <input
            type="text"
            id="fullName"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder="Your full name"
            autoComplete="name"
            disabled={authLoading}
            className="input-field w-full"
          />
          {errors.fullName && <p className="text-xs text-danger mt-1.5">{errors.fullName}</p>}
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 block">Email</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Your email"
            autoComplete="email"
            disabled={authLoading}
            className="input-field w-full"
          />
          {errors.email && <p className="text-xs text-danger mt-1.5">{errors.email}</p>}
        </div>

        {/* Password */}
        <div>
          <label htmlFor="password" className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 block">Password</label>
          <PasswordInput
            id="password"
            value={password}
            onChange={setPassword}
            placeholder="Create a password"
            autoComplete="new-password"
            disabled={authLoading}
          />
          <PasswordStrength password={password} />
          {errors.password && <p className="text-xs text-danger mt-1.5">{errors.password}</p>}
        </div>

        {/* Confirm Password */}
        <div>
          <label htmlFor="confirmPassword" className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 block">Confirm Password</label>
          <PasswordInput
            id="confirmPassword"
            value={confirmPassword}
            onChange={setConfirmPassword}
            placeholder="Confirm your password"
            autoComplete="new-password"
            disabled={authLoading}
          />
          {errors.confirmPassword && <p className="text-xs text-danger mt-1.5">{errors.confirmPassword}</p>}
        </div>

        {/* Position */}
        <div>
          <label htmlFor="role" className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 block">Position</label>
          <select
            id="role"
            value={requestedRole}
            onChange={e => setRequestedRole(e.target.value as AuthRole)}
            disabled={authLoading}
            className="select-field w-full"
          >
            {ROLES.map(role => (
              <option key={role} value={role}>{getRoleDisplayName(role)}</option>
            ))}
          </select>
          <p className="text-[11px] text-text-muted mt-1.5">
            Your selected position will be reviewed by an administrator.
          </p>
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
              Creating account...
            </>
          ) : (
            'CREATE ACCOUNT'
          )}
        </button>
      </form>

      {/* Login link */}
      <p className="text-center mt-6 text-sm text-text-muted">
        Already have an account?{' '}
        <Link to="/login" className="text-gold hover:text-gold-light transition-colors font-medium">
          Sign in
        </Link>
      </p>
    </>
  )
}
