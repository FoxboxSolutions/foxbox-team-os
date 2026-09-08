import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAppState } from '@/stores/AppState'
import { canAccessPlatform, getStatusRedirect, canAccessPage } from '@/lib/auth'

interface ProtectedRouteProps {
  requiredPage?: string
}

export function ProtectedRoute({ requiredPage }: ProtectedRouteProps) {
  const { authUser } = useAppState()
  const location = useLocation()

  // Not authenticated
  if (!authUser) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Check account status
  if (!canAccessPlatform(authUser)) {
    const redirect = getStatusRedirect(authUser.status)
    return <Navigate to={redirect} replace />
  }

  // Check page-level permissions
  if (requiredPage && !canAccessPage(authUser.role, requiredPage)) {
    return <Navigate to="/app" replace />
  }

  return <Outlet />
}
