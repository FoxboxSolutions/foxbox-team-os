import type { AuthRole, AuthUser, AccountStatus } from '@/types'

// ============================================================
// Password Hashing (Web Crypto API - SHA-256 with salt)
// ============================================================

const SALT_LENGTH = 16
const ITERATIONS = 10000

async function pbkdf2(password: string, salt: Uint8Array): Promise<string> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: salt as unknown as ArrayBuffer,
      iterations: ITERATIONS,
    },
    keyMaterial,
    256
  )
  return btoa(String.fromCharCode(...new Uint8Array(derivedBits)))
}

function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
}

export async function hashPassword(password: string): Promise<string> {
  const salt = generateSalt()
  const hash = await pbkdf2(password, salt)
  return `${btoa(String.fromCharCode(...salt))}:${hash}`
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    const [saltB64, hash] = storedHash.split(':')
    const saltBytes = atob(saltB64)
    const salt = new Uint8Array([...saltBytes].map(c => c.charCodeAt(0)))
    const computedHash = await pbkdf2(password, salt)
    return computedHash === hash
  } catch {
    return false
  }
}

// ============================================================
// Password Validation
// ============================================================

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4
  label: 'Very Weak' | 'Weak' | 'Fair' | 'Strong' | 'Very Strong'
  color: string
}

export function checkPasswordStrength(password: string): PasswordStrength {
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score++

  const capped = Math.min(score, 4) as 0 | 1 | 2 | 3 | 4
  const labels: Record<number, PasswordStrength['label']> = {
    0: 'Very Weak',
    1: 'Weak',
    2: 'Fair',
    3: 'Strong',
    4: 'Very Strong',
  }
  const colors: Record<number, string> = {
    0: '#E74C3C',
    1: '#E67E22',
    2: '#F2C94C',
    3: '#2ECC71',
    4: '#27AE60',
  }

  return { score: capped, label: labels[capped], color: colors[capped] }
}

export function validateEmail(email: string): string | null {
  if (!email.trim()) return 'Please enter your email.'
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!re.test(email)) return 'Please enter a valid email address.'
  return null
}

export function validatePassword(password: string): string | null {
  if (!password) return 'Please enter a password.'
  if (password.length < 8) return 'Password must be at least 8 characters.'
  if (!/[a-z]/.test(password)) return 'Password must include a lowercase letter.'
  if (!/[A-Z]/.test(password)) return 'Password must include an uppercase letter.'
  if (!/\d/.test(password)) return 'Password must include a number.'
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) return 'Password must include a special character.'
  return null
}

export function validateFullName(name: string): string | null {
  if (!name.trim()) return 'Please enter your full name.'
  if (name.trim().length < 2) return 'Name must be at least 2 characters.'
  return null
}

// ============================================================
// RBAC — Role-Based Access Control
// ============================================================

type Permission =
  | 'users:manage'
  | 'users:approve'
  | 'users:view'
  | 'team:manage'
  | 'team:view'
  | 'tasks:manage'
  | 'tasks:view'
  | 'files:manage'
  | 'files:view'
  | 'discussions:manage'
  | 'discussions:view'
  | 'research:manage'
  | 'research:view'
  | 'winners:manage'
  | 'winners:view'
  | 'selling:manage'
  | 'selling:view'
  | 'creative:manage'
  | 'creative:view'
  | 'cod:manage'
  | 'cod:view'
  | 'orders:manage'
  | 'orders:view'
  | 'delivery:manage'
  | 'delivery:view'
  | 'finance:manage'
  | 'finance:view'
  | 'analytics:view'
  | 'settings:manage'

const ROLE_PERMISSIONS: Record<AuthRole, Permission[]> = {
  administrator: [
    'users:manage', 'users:approve', 'users:view',
    'team:manage', 'team:view',
    'tasks:manage', 'tasks:view',
    'files:manage', 'files:view',
    'discussions:manage', 'discussions:view',
    'research:manage', 'research:view',
    'winners:manage', 'winners:view',
    'selling:manage', 'selling:view',
    'creative:manage', 'creative:view',
    'cod:manage', 'cod:view',
    'orders:manage', 'orders:view',
    'delivery:manage', 'delivery:view',
    'finance:manage', 'finance:view',
    'analytics:view',
    'settings:manage',
  ],
  mediabuyer: [
    'team:view',
    'tasks:view',
    'files:view',
    'discussions:view',
    'research:manage', 'research:view',
    'winners:manage', 'winners:view',
    'selling:view',
    'creative:manage', 'creative:view',
    'cod:view',
  ],
  confirmator: [
    'team:view',
    'tasks:view',
    'files:view',
    'discussions:view',
    'cod:manage', 'cod:view',
    'orders:manage', 'orders:view',
    'delivery:manage', 'delivery:view',
  ],
}

export function hasPermission(role: AuthRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

export function hasAnyPermission(role: AuthRole, permissions: Permission[]): boolean {
  return permissions.some(p => hasPermission(role, p))
}

export function canAccessPage(role: AuthRole, page: string): boolean {
  const PAGE_PERMISSIONS: Record<string, Permission> = {
    dashboard: 'team:view',
    research: 'research:view',
    winners: 'winners:view',
    'product-selling': 'selling:view',
    team: 'team:view',
    tasks: 'tasks:view',
    files: 'files:view',
    discussions: 'discussions:view',
    creative: 'creative:view',
    cod: 'cod:view',
    orders: 'orders:view',
    confirmation: 'cod:view',
    delivery: 'delivery:view',
    finance: 'finance:view',
    analytics: 'analytics:view',
    settings: 'settings:manage',
  }
  const required = PAGE_PERMISSIONS[page]
  if (!required) return true
  return hasPermission(role, required)
}

// ============================================================
// Account Status Helpers
// ============================================================

export function canAccessPlatform(user: AuthUser): boolean {
  return user.status === 'approved'
}

export function getStatusRedirect(status: AccountStatus): string {
  switch (status) {
    case 'pending': return '/pending-approval'
    case 'needs_role': return '/auth/complete-profile'
    case 'rejected': return '/account-rejected'
    case 'suspended': return '/account-suspended'
    case 'blocked': return '/account-blocked'
    case 'banned': return '/account-banned'
    default: return '/app'
  }
}

export function getRoleDisplayName(role: AuthRole): string {
  switch (role) {
    case 'administrator': return 'Administrator'
    case 'mediabuyer': return 'Mediabuyer'
    case 'confirmator': return 'Confirmator'
    default: return role
  }
}

export function getStatusDisplayName(status: AccountStatus): string {
  switch (status) {
    case 'pending': return 'Pending Approval'
    case 'approved': return 'Approved'
    case 'rejected': return 'Rejected'
    case 'suspended': return 'Suspended'
    case 'blocked': return 'Blocked'
    case 'banned': return 'Banned'
    default: return status
  }
}

export function getStatusColor(status: AccountStatus): string {
  switch (status) {
    case 'approved': return 'text-success'
    case 'pending': return 'text-warning'
    case 'rejected': return 'text-danger'
    case 'suspended': return 'text-danger'
    case 'blocked': return 'text-danger'
    case 'banned': return 'text-danger'
    default: return 'text-text-muted'
  }
}
