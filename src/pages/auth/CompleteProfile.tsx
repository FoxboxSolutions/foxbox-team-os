import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAppState } from '@/stores/AppState'
import { Shield, User, Loader2 } from 'lucide-react'

const ROLES = [
  {
    id: 'administrator',
    label: 'Administrator',
    description: 'Full access to all features, user management, and settings',
    icon: Shield,
  },
  {
    id: 'mediabuyer',
    label: 'Media Buyer',
    description: 'Manage campaigns, track orders, and analyze performance',
    icon: User,
  },
] as const

export function CompleteProfilePage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { setAuthUser, setAuthToken } = useAppState()

  const [selectedRole, setSelectedRole] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const token = searchParams.get('token')
  const name = searchParams.get('name') || ''
  const email = searchParams.get('email') || ''
  const avatar = searchParams.get('avatar') || ''

  useEffect(() => {
    if (!token) {
      navigate('/login')
    }
  }, [token, navigate])

  const handleSubmit = async () => {
    if (!selectedRole || !token) return

    setLoading(true)
    setError(null)

    try {
      const apiBase = import.meta.env.VITE_API_URL || 'https://foxbox-api.foxboxsolutions01.workers.dev/api'
      const res = await fetch(`${apiBase}/auth/complete-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, role: selectedRole }),
      })

      const data = await res.json()

      if (!data.success) {
        setError(data.error || 'Failed to complete profile')
        setLoading(false)
        return
      }

      // Store token and set auth user
      setAuthToken(data.data.token)
      setAuthUser({
        id: data.data.userId,
        email,
        fullName: name,
        role: data.data.role,
        requestedRole: data.data.role,
        status: data.data.status,
        avatar: avatar || undefined,
        authProvider: 'google',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      // Redirect to dashboard
      navigate('/app')
    } catch (err) {
      console.error('[CompleteProfile] Error:', err)
      setError('An error occurred. Please try again.')
      setLoading(false)
    }
  }

  if (!token) return null

  return (
    <>
      <div className="text-center mb-8">
        <h2 className="text-xl font-serif font-bold text-text-primary mb-2">Complete Your Profile</h2>
        <p className="text-sm text-text-muted">Choose your role to get started</p>
      </div>

      {name && (
        <div className="flex items-center gap-3 mb-6 p-4 rounded-xl bg-surface/50 border border-border">
          {avatar ? (
            <img src={avatar} alt={name} className="w-10 h-10 rounded-full" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center">
              <span className="text-gold font-semibold">{name.charAt(0).toUpperCase()}</span>
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-text-primary">{name}</p>
            <p className="text-xs text-text-muted">{email}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 p-3 rounded-xl bg-danger/10 border border-danger/20">
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      <div className="space-y-3 mb-6">
        {ROLES.map((role) => {
          const Icon = role.icon
          const isSelected = selectedRole === role.id
          return (
            <button
              key={role.id}
              type="button"
              onClick={() => setSelectedRole(role.id)}
              disabled={loading}
              className={`w-full p-4 rounded-xl border text-left transition-all ${
                isSelected
                  ? 'border-gold bg-gold/10'
                  : 'border-border bg-surface hover:border-gold/50 hover:bg-surface/80'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  isSelected ? 'bg-gold/20' : 'bg-surface-hover'
                }`}>
                  <Icon className={`w-5 h-5 ${isSelected ? 'text-gold' : 'text-text-muted'}`} />
                </div>
                <div>
                  <p className={`text-sm font-medium ${isSelected ? 'text-gold' : 'text-text-primary'}`}>
                    {role.label}
                  </p>
                  <p className="text-xs text-text-muted">{role.description}</p>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!selectedRole || loading}
        className="btn-primary w-full"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Setting up...
          </span>
        ) : (
          'Continue to Dashboard'
        )}
      </button>
    </>
  )
}
