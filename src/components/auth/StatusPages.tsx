import { useNavigate } from 'react-router-dom'
import { Clock, XCircle, Ban, ShieldOff, ArrowLeft } from 'lucide-react'
import { useAppState } from '@/stores/AppState'

export function PendingApprovalPage() {
  const { authUser, logout } = useAppState()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-obsidian flex items-center justify-center px-4">
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[radial-gradient(ellipse,rgba(212,175,55,0.04)_0%,transparent_70%)] pointer-events-none" />
      <div className="w-full max-w-md relative z-10">
        <div className="flex flex-col items-center mb-8">
          <img src="/logo.png" alt="FOXBOX" className="w-14 h-14 rounded-full mb-4" />
          <h1 className="text-2xl font-serif font-bold text-gradient-gold tracking-wide">FOXBOX TEAM</h1>
        </div>
        <div className="glass-card p-8 rounded-2xl text-center">
          <div className="w-16 h-16 rounded-full bg-gold/10 flex items-center justify-center mx-auto mb-6">
            <Clock className="w-8 h-8 text-gold" />
          </div>
          <h2 className="text-xl font-serif font-bold text-text-primary mb-3">Account Pending Approval</h2>
          <p className="text-sm text-text-secondary mb-2">
            Your Foxbox Team account is waiting for administrator approval.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gold/10 border border-gold/20 mb-6">
            <div className="w-2 h-2 rounded-full bg-gold animate-pulse" />
            <span className="text-xs font-semibold text-gold">PENDING APPROVAL</span>
          </div>
          <p className="text-xs text-text-muted mb-6">
            You will be able to access the platform once your account has been approved by an administrator.
          </p>
          {authUser && (
            <p className="text-xs text-text-muted mb-6">
              Signed in as <span className="text-text-secondary">{authUser.email}</span>
            </p>
          )}
          <button
            onClick={() => { logout(); navigate('/login') }}
            className="btn-secondary w-full py-3 text-sm cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Login
          </button>
        </div>
      </div>
    </div>
  )
}

export function AccountRejectedPage() {
  const { logout } = useAppState()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-obsidian flex items-center justify-center px-4">
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[radial-gradient(ellipse,rgba(231,76,60,0.04)_0%,transparent_70%)] pointer-events-none" />
      <div className="w-full max-w-md relative z-10">
        <div className="flex flex-col items-center mb-8">
          <img src="/logo.png" alt="FOXBOX" className="w-14 h-14 rounded-full mb-4" />
          <h1 className="text-2xl font-serif font-bold text-gradient-gold tracking-wide">FOXBOX TEAM</h1>
        </div>
        <div className="glass-card p-8 rounded-2xl text-center">
          <div className="w-16 h-16 rounded-full bg-danger/10 flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-8 h-8 text-danger" />
          </div>
          <h2 className="text-xl font-serif font-bold text-text-primary mb-3">Account Rejected</h2>
          <p className="text-sm text-text-secondary mb-6">
            Your account application has been reviewed and rejected. Please contact the administrator for more information.
          </p>
          <button
            onClick={() => { logout(); navigate('/login') }}
            className="btn-secondary w-full py-3 text-sm cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Login
          </button>
        </div>
      </div>
    </div>
  )
}

export function AccountSuspendedPage() {
  const { logout } = useAppState()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-obsidian flex items-center justify-center px-4">
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[radial-gradient(ellipse,rgba(231,76,60,0.04)_0%,transparent_70%)] pointer-events-none" />
      <div className="w-full max-w-md relative z-10">
        <div className="flex flex-col items-center mb-8">
          <img src="/logo.png" alt="FOXBOX" className="w-14 h-14 rounded-full mb-4" />
          <h1 className="text-2xl font-serif font-bold text-gradient-gold tracking-wide">FOXBOX TEAM</h1>
        </div>
        <div className="glass-card p-8 rounded-2xl text-center">
          <div className="w-16 h-16 rounded-full bg-danger/10 flex items-center justify-center mx-auto mb-6">
            <Ban className="w-8 h-8 text-danger" />
          </div>
          <h2 className="text-xl font-serif font-bold text-text-primary mb-3">Account Suspended</h2>
          <p className="text-sm text-text-secondary mb-6">
            Your account has been suspended. Please contact the administrator to regain access.
          </p>
          <button
            onClick={() => { logout(); navigate('/login') }}
            className="btn-secondary w-full py-3 text-sm cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Login
          </button>
        </div>
      </div>
    </div>
  )
}

export function AccountBlockedPage() {
  const { logout } = useAppState()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-obsidian flex items-center justify-center px-4">
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[radial-gradient(ellipse,rgba(231,76,60,0.04)_0%,transparent_70%)] pointer-events-none" />
      <div className="w-full max-w-md relative z-10">
        <div className="flex flex-col items-center mb-8">
          <img src="/logo.png" alt="FOXBOX" className="w-14 h-14 rounded-full mb-4" />
          <h1 className="text-2xl font-serif font-bold text-gradient-gold tracking-wide">FOXBOX TEAM</h1>
        </div>
        <div className="glass-card p-8 rounded-2xl text-center">
          <div className="w-16 h-16 rounded-full bg-danger/10 flex items-center justify-center mx-auto mb-6">
            <ShieldOff className="w-8 h-8 text-danger" />
          </div>
          <h2 className="text-xl font-serif font-bold text-text-primary mb-3">Account Blocked</h2>
          <p className="text-sm text-text-secondary mb-6">
            Your account has been blocked. Please contact an administrator.
          </p>
          <button
            onClick={() => { logout(); navigate('/login') }}
            className="btn-secondary w-full py-3 text-sm cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Login
          </button>
        </div>
      </div>
    </div>
  )
}

export function AccountBannedPage() {
  const { logout } = useAppState()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-obsidian flex items-center justify-center px-4">
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[radial-gradient(ellipse,rgba(231,76,60,0.04)_0%,transparent_70%)] pointer-events-none" />
      <div className="w-full max-w-md relative z-10">
        <div className="flex flex-col items-center mb-8">
          <img src="/logo.png" alt="FOXBOX" className="w-14 h-14 rounded-full mb-4" />
          <h1 className="text-2xl font-serif font-bold text-gradient-gold tracking-wide">FOXBOX TEAM</h1>
        </div>
        <div className="glass-card p-8 rounded-2xl text-center">
          <div className="w-16 h-16 rounded-full bg-danger/10 flex items-center justify-center mx-auto mb-6">
            <Ban className="w-8 h-8 text-danger" />
          </div>
          <h2 className="text-xl font-serif font-bold text-text-primary mb-3">Account Banned</h2>
          <p className="text-sm text-text-secondary mb-6">
            Your account has been banned. Please contact an administrator.
          </p>
          <button
            onClick={() => { logout(); navigate('/login') }}
            className="btn-secondary w-full py-3 text-sm cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Login
          </button>
        </div>
      </div>
    </div>
  )
}
