import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAppState } from '@/stores/AppState'
import { Loader2 } from 'lucide-react'

export function AuthCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { handleGoogleCallback } = useAppState()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const processCallback = async () => {
      const token = searchParams.get('token')
      const userId = searchParams.get('userId')
      const status = searchParams.get('status')
      const errorParam = searchParams.get('error')

      if (errorParam) {
        const errorMessages: Record<string, string> = {
          google_denied: 'You denied Google access. Please try again.',
          google_no_code: 'No authorization code received.',
          invalid_state: 'Invalid security state. Please try again.',
          state_expired: 'Security state expired. Please try again.',
          google_not_configured: 'Google login is not configured.',
        google_client_id_missing: 'Google login is not configured (client ID missing).',
        google_client_secret_missing: 'Google login is not configured (server secret missing). Please contact an administrator.',
          token_exchange_failed: 'Failed to exchange code with Google.',
          no_id_token: 'No identity token received from Google.',
          invalid_id_token: 'Invalid identity token from Google.',
          no_email: 'No email found in Google account.',
          email_not_verified: 'Please verify your email with Google first.',
          account_blocked: 'Your account has been blocked.',
          account_banned: 'Your account has been banned.',
          google_auth_failed: 'Google authentication failed.',
        }
        setError(errorMessages[errorParam] || 'An error occurred with Google login.')
        return
      }

      if (token && userId) {
        // Process the callback - store token and user data
        const result = await handleGoogleCallback(token, userId, status || 'pending')
        if (result.redirect) {
          navigate(result.redirect)
        }
      } else {
        setError('No authentication data received.')
      }
    }
    processCallback()
  }, [searchParams, navigate, handleGoogleCallback])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md p-8">
          <div className="w-16 h-16 rounded-full bg-danger/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">!</span>
          </div>
          <h2 className="text-xl font-serif font-bold text-text-primary mb-2">Authentication Error</h2>
          <p className="text-sm text-text-muted mb-6">{error}</p>
          <button
            onClick={() => navigate('/login')}
            className="btn-primary px-6 py-2 text-sm"
          >
            Back to Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-gold mx-auto mb-4" />
        <p className="text-sm text-text-muted">Completing authentication...</p>
      </div>
    </div>
  )
}
