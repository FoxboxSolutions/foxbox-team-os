import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAppState } from '@/stores/AppState'
import { PasswordInput } from '@/components/auth/PasswordInput'
import { Loader2, Check, Mail } from 'lucide-react'
import { api } from '@/lib/api'

type PageState =
  | { kind: 'loading' }
  | { kind: 'invalid'; reason: string }
  | { kind: 'valid'; email: string; roleLabel: string; expiresAt: string }

const REASON_MESSAGES: Record<string, string> = {
  invalid: 'This invitation link is invalid.',
  expired: 'This invitation has expired. Please ask an administrator for a new one.',
  revoked: 'This invitation was revoked. Please ask an administrator for a new one.',
  accepted: 'This invitation was already used. Please log in instead.',
}

export function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { acceptInvitation, authLoading } = useAppState()

  const [pageState, setPageState] = useState<PageState>({ kind: 'loading' })
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setPageState({ kind: 'invalid', reason: 'invalid' })
      return
    }
    let cancelled = false
    api.validateInvitation(token)
      .then((res) => {
        if (cancelled) return
        if (res.valid) {
          setPageState({
            kind: 'valid',
            email: res.email || '',
            roleLabel: res.roleLabel || res.role || 'Agent',
            expiresAt: res.expiresAt || '',
          })
        } else {
          setPageState({ kind: 'invalid', reason: res.reason || 'invalid' })
        }
      })
      .catch(() => {
        if (!cancelled) setPageState({ kind: 'invalid', reason: 'invalid' })
      })
    return () => { cancelled = true }
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!token) return
    if (!fullName.trim()) { setError('Please enter your full name.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    const result = await acceptInvitation(token, fullName.trim(), password)
    if (result.redirect) {
      navigate(result.redirect)
    } else if (!result.success) {
      setError(result.error || 'Could not accept the invitation.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-serif font-bold text-gold mb-1">FOXBOX TEAM</h1>
          <p className="text-sm text-text-muted">You&apos;re invited to join the team</p>
        </div>

        <div className="glass-card p-6">
          {pageState.kind === 'loading' && (
            <div className="text-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gold mx-auto mb-3" />
              <p className="text-sm text-text-muted">Validating invitation...</p>
            </div>
          )}

          {pageState.kind === 'invalid' && (
            <div className="text-center py-6">
              <div className="w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center mx-auto mb-4">
                <Mail className="w-6 h-6 text-danger" />
              </div>
              <h2 className="text-lg font-bold text-text-primary mb-2">Invitation unavailable</h2>
              <p className="text-sm text-text-muted mb-6">{REASON_MESSAGES[pageState.reason] || REASON_MESSAGES.invalid}</p>
              <Link to="/login" className="btn-primary w-full py-3 text-sm inline-block text-center">
                Back to Login
              </Link>
            </div>
          )}

          {pageState.kind === 'valid' && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="p-3 rounded-xl bg-success/10 border border-success/20 flex items-center gap-2">
                <Check className="w-4 h-4 text-success flex-shrink-0" />
                <p className="text-sm text-text-primary">
                  Invited as <strong>{pageState.roleLabel}</strong> · {pageState.email}
                </p>
              </div>

              <div>
                <label htmlFor="invite-name" className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 block">Full name</label>
                <input
                  type="text"
                  id="invite-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                  autoComplete="name"
                  disabled={authLoading}
                  className="input-field w-full"
                />
              </div>

              <div>
                <label htmlFor="invite-password" className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 block">Password</label>
                <PasswordInput
                  id="invite-password"
                  value={password}
                  onChange={setPassword}
                  disabled={authLoading}
                />
                <p className="text-[11px] text-text-muted mt-1">At least 8 characters.</p>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-danger/10 border border-danger/20">
                  <p className="text-sm text-danger">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="btn-primary w-full py-3 text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {authLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  'Join FOXBOX TEAM'
                )}
              </button>

              <p className="text-[11px] text-text-muted text-center">
                Your role ({pageState.roleLabel}) was set by the invitation and cannot be changed here.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
