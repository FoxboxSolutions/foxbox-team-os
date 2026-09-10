import React, { createContext, useContext, useState, useCallback } from 'react'
import type {
  Product, Task, Post, DiscussionChannel, DiscussionMessage,
  VaultFile, Creative, Order, DeliveryProvider, Shipment,
  Wilaya, Expense, Revenue, Notification, ActivityLog,
  User, TaskComment, TaskActivity, Confirmation,
  EcomDelivery, DeliveryHistoryEntry, SellingProduct,
  AuthUser, AuthRole, RegistrationRequest,
  YouCanOrder, YouCanConnection, YouCanWebhookLog,
  YouCanPaymentStatus, YouCanShippingStatus, YouCanOrderStatus,
} from '@/types'
import { db } from '@/lib/db'
import { hashPassword, verifyPassword } from '@/lib/auth'
import {
  mockUsers, mockProducts, mockTasks, mockPosts,
  mockChannels, mockMessages, mockFiles, mockCreatives,
  mockOrders, mockDeliveryProviders, mockShipments,
  mockWilayas, mockExpenses, mockRevenues, mockNotifications, mockActivityLog,
} from '@/lib/mock-data'
import { api, setAuthToken } from '@/lib/api'

interface AppState {
  // Users
  users: User[]
  currentUser: User | null
  setCurrentUser: (u: User) => void

  // Auth
  authUser: AuthUser | null
  authLoading: boolean
  authError: string | null
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; redirect?: string }>
  register: (data: { fullName: string; email: string; password: string; requestedRole: AuthRole }) => Promise<{ success: boolean; error?: string; redirect?: string }>
  loginWithGoogle: () => Promise<{ success: boolean; error?: string; redirect?: string }>
  handleGoogleCallback: (token: string, userId: string, status: string) => Promise<{ success: boolean; redirect?: string; error?: string }>
  loginWithFacebook: () => Promise<{ success: boolean; error?: string; redirect?: string }>
  logout: () => void
  requestPasswordReset: (email: string) => Promise<{ success: boolean; error?: string }>
  resetPassword: (token: string, newPassword: string) => Promise<{ success: boolean; error?: string }>
  clearAuthError: () => void
  setAuthToken: (token: string | null) => void
  // Admin auth management
  authUsers: AuthUser[]
  registrationRequests: RegistrationRequest[]
  refreshAuthUsers: () => Promise<void>
  approveUser: (userId: string, role: AuthRole, approvedBy: string) => void
  rejectUser: (userId: string, reviewedBy: string, notes?: string) => void
  suspendUser: (userId: string) => void
  reactivateUser: (userId: string) => void
  updateUserRole: (userId: string, role: AuthRole, changedBy: string) => void
  acceptInvitation: (token: string, fullName: string, password: string) => Promise<{ success: boolean; error?: string; redirect?: string }>
  // Profile management
  updateProfile: (data: { fullName?: string; avatar?: string | null }) => void
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>
  setAuthUser: (user: AuthUser | null) => void
  // Admin user management
  blockUser: (userId: string) => void
  unblockUser: (userId: string) => void
  banUser: (userId: string) => void
  unbanUser: (userId: string) => void
  deleteUser: (userId: string) => Promise<boolean>

  // Products
  products: Product[]
  addProduct: (p: Product) => void
  updateProduct: (p: Product) => void
  deleteProduct: (id: string) => void

  // Selling Products
  sellingProducts: SellingProduct[]
  addSellingProduct: (p: SellingProduct) => void
  updateSellingProduct: (p: SellingProduct) => void
  deleteSellingProduct: (id: string) => void

  // Tasks
  tasks: Task[]
  addTask: (t: Task) => void
  updateTask: (t: Task) => void
  deleteTask: (id: string) => void
  addTaskComment: (taskId: string, comment: TaskComment) => void
  addTaskActivity: (taskId: string, activity: TaskActivity) => void

  // Posts
  posts: Post[]
  addPost: (p: Post) => void
  updatePost: (p: Post) => void
  deletePost: (id: string) => void

  // Discussions
  channels: DiscussionChannel[]
  messages: DiscussionMessage[]
  addMessage: (m: DiscussionMessage) => void
  markChannelRead: (channelId: string) => void

  // Files
  files: VaultFile[]
  addFile: (f: VaultFile) => void
  deleteFile: (id: string) => void
  refreshFiles: () => Promise<void>
  uploadFilesToServer: (
    items: File[],
    meta: { folder?: string; tags?: string[]; productId?: string },
    onItemProgress?: (index: number, pct: number) => void,
  ) => Promise<{ ok: VaultFile[]; failed: { name: string; error: string }[] }>
  deleteServerFile: (id: string) => Promise<void>

  // Creatives
  creatives: Creative[]
  addCreative: (c: Creative) => void
  updateCreative: (c: Creative) => void
  deleteCreative: (id: string) => void

  // Orders
  orders: Order[]
  addOrder: (o: Order) => void
  updateOrder: (o: Order) => void
  deleteOrder: (id: string) => void

  // Delivery
  deliveryProviders: DeliveryProvider[]
  addDeliveryProvider: (dp: DeliveryProvider) => void
  updateDeliveryProvider: (dp: DeliveryProvider) => void
  deleteDeliveryProvider: (id: string) => void
  shipments: Shipment[]
  addShipment: (s: Shipment) => void
  updateShipment: (s: Shipment) => void

  // Wilayas
  wilayas: Wilaya[]

  // Finance
  expenses: Expense[]
  addExpense: (e: Expense) => void
  updateExpense: (e: Expense) => void
  deleteExpense: (id: string) => void
  revenues: Revenue[]
  addRevenue: (r: Revenue) => void

  // Confirmations
  confirmations: Confirmation[]
  addConfirmation: (c: Confirmation) => void
  updateConfirmation: (c: Confirmation) => void
  deleteConfirmation: (id: string) => void

  // E-com Deliveries
  ecomDeliveries: EcomDelivery[]
  addEcomDelivery: (d: EcomDelivery) => void
  updateEcomDelivery: (d: EcomDelivery) => void
  deleteEcomDelivery: (id: string) => void
  getDeliveryHistory: (deliveryId: string) => DeliveryHistoryEntry[]
  addDeliveryHistoryEntry: (entry: DeliveryHistoryEntry) => void

  // Notifications
  notifications: Notification[]
  addNotification: (n: Notification) => void
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void
  unreadNotificationCount: number

  // Activity Log
  activityLog: ActivityLog[]
  addActivityLog: (entry: ActivityLog) => void

  // YouCan Integration
  youcanOrders: YouCanOrder[]
  youcanConnection: YouCanConnection
  youcanWebhookLogs: YouCanWebhookLog[]
  addYoucanOrder: (order: YouCanOrder) => void
  updateYoucanOrder: (order: YouCanOrder) => void
  deleteYoucanOrder: (id: string) => void
  syncYoucanOrders: () => Promise<{ success: boolean; count?: number; error?: string }>
  fetchYoucanOrders: (params?: Record<string, string>) => Promise<{ orders: YouCanOrder[]; total: number; kpis: YouCanOrdersKpis }>
  connectYoucan: () => Promise<{ success: boolean; url?: string; error?: string }>
  disconnectYoucan: () => void
  refreshYoucanToken: () => Promise<{ success: boolean; error?: string }>
  testYoucanConnection: () => Promise<{ success: boolean; error?: string }>
  fetchYoucanStatus: () => Promise<void>

  // UI
  sidebarCollapsed: boolean
  toggleSidebar: () => void
}

type YouCanOrdersKpis = {
  totalOrders: number; newToday: number; pending: number;
  confirmed: number; cancelled: number; totalRevenue: number;
}

const AppStateContext = createContext<AppState | null>(null)

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [users] = useState<User[]>(() => {
    db.initWithDefaults({
      users: mockUsers, products: mockProducts, tasks: mockTasks,
      posts: mockPosts, channels: mockChannels, messages: mockMessages,
      files: mockFiles, creatives: mockCreatives, orders: mockOrders,
      deliveryProviders: mockDeliveryProviders, shipments: mockShipments,
      wilayas: mockWilayas, expenses: mockExpenses, revenues: mockRevenues,
      notifications: mockNotifications, activityLog: mockActivityLog,
    })
    return db.getUsers()
  })

  const [currentUser, setCurrentUserState] = useState<User | null>(() => db.getCurrentUser() || db.getUsers()[0] || null)

  // Auth state
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => db.getCurrentAuthUser())
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [authUsers, setAuthUsers] = useState<AuthUser[]>(() => db.getAuthUsers())
  const [registrationRequests, _setRegistrationRequests] = useState<RegistrationRequest[]>(() => db.getRegistrationRequests())

  const [products, setProducts] = useState<Product[]>(() => db.getProducts())
  const [sellingProducts, setSellingProducts] = useState<SellingProduct[]>(() => db.getSellingProducts())
  const [tasks, setTasks] = useState<Task[]>(() => db.getTasks())
  const [posts, setPosts] = useState<Post[]>(() => db.getPosts())
  const [channels, setChannels] = useState<DiscussionChannel[]>(() => db.getChannels())
  const [messages, setMessages] = useState<DiscussionMessage[]>(() => db.getMessages())
  const [files, setFiles] = useState<VaultFile[]>(() => db.getFiles())
  const [creatives, setCreatives] = useState<Creative[]>(() => db.getCreatives())
  const [orders, setOrders] = useState<Order[]>(() => db.getOrders())
  const [deliveryProviders, setDeliveryProviders] = useState<DeliveryProvider[]>(() => db.getDeliveryProviders())
  const [shipments, setShipments] = useState<Shipment[]>(() => db.getShipments())
  const [wilayas, setWilayas] = useState<Wilaya[]>(() => db.getWilayas())
  const [expenses, setExpenses] = useState<Expense[]>(() => db.getExpenses())
  const [revenues, setRevenues] = useState<Revenue[]>(() => db.getRevenues())
  const [notifications, setNotifications] = useState<Notification[]>(() => db.getNotifications())
  const [activityLog, setActivityLog] = useState<ActivityLog[]>(() => db.getActivityLog())
  const [confirmations, setConfirmations] = useState<Confirmation[]>(() => db.getConfirmations())
  const [ecomDeliveries, setEcomDeliveries] = useState<EcomDelivery[]>(() => db.getEcomDeliveries())
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // YouCan state
  const [youcanOrders, setYoucanOrders] = useState<YouCanOrder[]>(() => db.getYoucanOrders())
  const [youcanConnection, setYoucanConnection] = useState<YouCanConnection>(() => db.getYoucanConnection())
  const [youcanWebhookLogs] = useState<YouCanWebhookLog[]>(() => db.getYoucanWebhookLogs())

  const unreadNotificationCount = notifications.filter(n => !n.isRead).length

  const setCurrentUser = useCallback((u: User) => {
    setCurrentUserState(u)
    db.setCurrentUser(u)
  }, [])

  // ─── Data Loading Functions ──────────────────────────────────────
  
  const loadAuthUsers = useCallback(async () => {
    try {
      const users = await api.getUsers()
      setAuthUsers(users)
    } catch (err) {
      console.error('Failed to load users:', err)
    }
  }, [])

  const loadChannels = useCallback(async () => {
    try {
      const ch = await api.getChannels()
      setChannels(ch)
    } catch (err) {
      console.error('Failed to load channels:', err)
    }
  }, [])

  // Messages are loaded per-channel via addMessage / handleGoogleCallback

  const loadTasks = useCallback(async () => {
    try {
      const t = await api.getTasks()
      setTasks(t)
    } catch (err) {
      console.error('Failed to load tasks:', err)
    }
  }, [])

  const loadPosts = useCallback(async () => {
    try {
      const p = await api.getPosts()
      setPosts(p)
    } catch (err) {
      console.error('Failed to load posts:', err)
    }
  }, [])

  const loadProducts = useCallback(async () => {
    try {
      const p = await api.getProducts()
      setProducts(p)
    } catch (err) {
      console.error('Failed to load products:', err)
    }
  }, [])

  const loadSellingProducts = useCallback(async () => {
    try {
      const p = await api.getSellingProducts()
      setSellingProducts(p)
    } catch (err) {
      console.error('Failed to load selling products:', err)
    }
  }, [])

  const loadOrders = useCallback(async () => {
    try {
      const o = await api.getOrders()
      setOrders(o)
    } catch (err) {
      console.error('Failed to load orders:', err)
    }
  }, [])

  const loadDeliveryProviders = useCallback(async () => {
    try {
      const d = await api.getDeliveryProviders()
      setDeliveryProviders(d)
    } catch (err) {
      console.error('Failed to load delivery providers:', err)
    }
  }, [])

  const loadShipments = useCallback(async () => {
    try {
      const s = await api.getShipments()
      setShipments(s)
    } catch (err) {
      console.error('Failed to load shipments:', err)
    }
  }, [])

  const loadWilayas = useCallback(async () => {
    try {
      const w = await api.getWilayas()
      setWilayas(w)
    } catch (err) {
      console.error('Failed to load wilayas:', err)
    }
  }, [])

  const loadExpenses = useCallback(async () => {
    try {
      const e = await api.getExpenses()
      setExpenses(e)
    } catch (err) {
      console.error('Failed to load expenses:', err)
    }
  }, [])

  const loadRevenues = useCallback(async () => {
    try {
      const r = await api.getRevenues()
      setRevenues(r)
    } catch (err) {
      console.error('Failed to load revenues:', err)
    }
  }, [])

  const loadConfirmations = useCallback(async () => {
    try {
      const c = await api.getConfirmations()
      setConfirmations(c)
    } catch (err) {
      console.error('Failed to load confirmations:', err)
    }
  }, [])

  const loadNotifications = useCallback(async () => {
    try {
      const n = await api.getNotifications()
      setNotifications(n)
    } catch (err) {
      console.error('Failed to load notifications:', err)
    }
  }, [])

  const loadActivityLog = useCallback(async () => {
    try {
      const a = await api.getActivityLog()
      setActivityLog(a)
    } catch (err) {
      console.error('Failed to load activity log:', err)
    }
  }, [])

  const loadAllData = useCallback(async () => {
    await Promise.all([
      loadAuthUsers(),
      loadChannels(),
      loadTasks(),
      loadPosts(),
      loadProducts(),
      loadSellingProducts(),
      loadOrders(),
      loadDeliveryProviders(),
      loadShipments(),
      loadWilayas(),
      loadExpenses(),
      loadRevenues(),
      loadConfirmations(),
      loadNotifications(),
      loadActivityLog(),
    ])
  }, [loadAuthUsers, loadChannels, loadTasks, loadPosts, loadProducts, loadSellingProducts, loadOrders, loadDeliveryProviders, loadShipments, loadWilayas, loadExpenses, loadRevenues, loadConfirmations, loadNotifications, loadActivityLog])

  // ─── Auth Actions ──────────────────────────────────────────────
  const clearAuthError = useCallback(() => setAuthError(null), [])

  const refreshAuthUsers = useCallback(async () => {
    await loadAuthUsers()
  }, [loadAuthUsers])

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string; redirect?: string }> => {
    setAuthLoading(true)
    setAuthError(null)
    try {
      const result = await api.login(email, password)
      setAuthToken(result.token)
      const userData = await api.getMe()
      // Persist to localStorage so refresh keeps the session (same as Google flow)
      db.saveAuthUser(userData)
      db.setAuthSession({
        userId: userData.id,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      })
      const stored = db.getAuthUser(userData.id)
      if (stored) {
        stored.lastLoginAt = new Date()
        db.saveAuthUser(stored)
      }
      setAuthUser(userData)
      await loadAllData()
      setAuthLoading(false)
      if (userData.status === 'pending') {
        return { success: true, redirect: '/pending-approval' }
      }
      return { success: true, redirect: '/app' }
    } catch (err) {
      setAuthLoading(false)
      return { success: false, error: err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.' }
    }
  }, [loadAllData])

  const register = useCallback(async (data: { fullName: string; email: string; password: string; requestedRole: AuthRole }): Promise<{ success: boolean; error?: string; redirect?: string }> => {
    setAuthLoading(true)
    setAuthError(null)
    try {
      const existing = db.getAuthUserByEmail(data.email)
      if (existing) {
        setAuthLoading(false)
        return { success: false, error: 'An account with this email already exists.' }
      }
      const passwordHash = await hashPassword(data.password)
      const now = new Date()

      // Bootstrap: if no approved admin exists, auto-approve first user as administrator
      const existingUsers = db.getAuthUsers()
      const hasApprovedAdmin = existingUsers.some(u => u.status === 'approved' && u.role === 'administrator')
      const isBootstrap = !hasApprovedAdmin

      const newUser: AuthUser = {
        id: 'auth-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 8),
        fullName: data.fullName,
        email: data.email,
        passwordHash,
        role: isBootstrap ? 'administrator' : 'mediabuyer',
        requestedRole: data.requestedRole,
        status: isBootstrap ? 'approved' : 'pending',
        authProvider: 'email',
        createdAt: now,
        updatedAt: now,
        approvedAt: isBootstrap ? now : undefined,
        approvedBy: isBootstrap ? 'system' : undefined,
      }
      db.saveAuthUser(newUser)

      if (!isBootstrap) {
        const request: RegistrationRequest = {
          id: 'reg-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 8),
          fullName: data.fullName,
          email: data.email,
          requestedRole: data.requestedRole,
          authProvider: 'email',
          status: 'pending',
          createdAt: now,
        }
        db.saveRegistrationRequest(request)
      }

      refreshAuthUsers()
      setAuthLoading(false)

      if (isBootstrap) {
        // Auto-login the bootstrap admin
        const session = {
          userId: newUser.id,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        }
        db.setAuthSession(session)
        newUser.lastLoginAt = new Date()
        db.saveAuthUser(newUser)
        setAuthUser(newUser)
        return { success: true, redirect: '/app' }
      }

      return { success: true, redirect: '/pending-approval' }
    } catch {
      setAuthLoading(false)
      return { success: false, error: 'An unexpected error occurred. Please try again.' }
    }
  }, [refreshAuthUsers])

  const loginWithGoogle = useCallback(async (): Promise<{ success: boolean; error?: string; redirect?: string }> => {
    setAuthLoading(true)
    setAuthError(null)
    try {
      // Redirect to Worker's Google OAuth endpoint
      // VITE_API_URL already includes /api, so we use /auth/google not /api/auth/google
      const apiBase = import.meta.env.VITE_API_URL || 'https://foxbox-api.foxboxsolutions01.workers.dev/api'
      const res = await fetch(`${apiBase}/auth/google`)
      if (!res.ok) {
        const msg = `Google init failed: HTTP ${res.status}`
        setAuthError(msg)
        setAuthLoading(false)
        return { success: false, error: msg }
      }
      const data = await res.json() as { success: boolean; data?: { url: string } }

      if (data.success && data.data?.url) {
        // Redirect to Google OAuth
        window.location.href = data.data.url
        // Don't set loading false - page will navigate away
        return { success: true }
      }

      const msg = 'Failed to initiate Google login.'
      setAuthError(msg)
      setAuthLoading(false)
      return { success: false, error: msg }
    } catch (err) {
      const msg = 'Google sign-in failed. Please try again.'
      console.error('[Google Login] fetch failed:', err)
      setAuthError(msg)
      setAuthLoading(false)
      return { success: false, error: msg }
    }
  }, [])

  const handleGoogleCallback = useCallback(async (token: string, userId: string, _status: string): Promise<{ success: boolean; redirect?: string; error?: string }> => {
    // Store the JWT token from the Worker (standard key feeds all API calls)
    setAuthToken(token)
    localStorage.setItem('foxbox_worker_token', token)
    localStorage.setItem('foxbox_worker_user_id', userId)

    try {
      // Fetch the REAL user data from Worker API using the JWT token
      // VITE_API_URL already includes /api, so use /auth/me not /api/auth/me
      const apiBase = import.meta.env.VITE_API_URL || 'https://foxbox-api.foxboxsolutions01.workers.dev/api'
      const res = await fetch(`${apiBase}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!res.ok) {
        throw new Error('Failed to fetch user data from Worker')
      }

      const data = await res.json() as { success: boolean; data?: AuthUser }
      
      if (!data.success || !data.data) {
        throw new Error('Invalid user data from Worker')
      }

      const user = data.data

      // Store in localStorage for the existing auth system
      db.saveAuthUser(user)
      const session = {
        userId: user.id,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }
      db.setAuthSession(session)
      setAuthUser(user)
      setAuthLoading(false)

      if (user.status === 'pending') {
        return { success: true, redirect: '/pending-approval' }
      }
      return { success: true, redirect: '/app' }
    } catch (err) {
      console.error('[Google Callback] Failed to fetch user:', err)
      setAuthLoading(false)
      return { success: false, error: 'Failed to load user data. Please try again.' }
    }
  }, [])

  const loginWithFacebook = useCallback(async (): Promise<{ success: boolean; error?: string; redirect?: string }> => {
    setAuthLoading(true)
    setAuthError(null)
    try {
      const mockFacebookId = 'fb-' + Date.now().toString(36)
      const mockEmail = 'user@facebook.com'
      const mockName = 'Facebook User'

      let user = db.getAuthUserByFacebookId(mockFacebookId)
      if (!user) {
        user = db.getAuthUserByEmail(mockEmail)
        if (user) {
          user.facebookId = mockFacebookId
          user.authProvider = 'facebook'
          db.saveAuthUser(user)
        } else {
          const now = new Date()
          user = {
            id: 'auth-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 8),
            fullName: mockName,
            email: mockEmail,
            role: 'mediabuyer',
            requestedRole: 'mediabuyer',
            status: 'pending',
            authProvider: 'facebook',
            facebookId: mockFacebookId,
            createdAt: now,
            updatedAt: now,
          }
          db.saveAuthUser(user)
          const request: RegistrationRequest = {
            id: 'reg-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 8),
            fullName: mockName,
            email: mockEmail,
            requestedRole: 'mediabuyer',
            authProvider: 'facebook',
            status: 'pending',
            createdAt: now,
          }
          db.saveRegistrationRequest(request)
          refreshAuthUsers()
        }
      }

      if (user.status === 'rejected') {
        setAuthLoading(false)
        return { success: false, error: 'Your account has been rejected. Please contact support.' }
      }
      if (user.status === 'suspended' || user.status === 'blocked') {
        setAuthLoading(false)
        return { success: false, error: 'Your account has been blocked. Please contact an administrator.' }
      }
      if (user.status === 'banned') {
        setAuthLoading(false)
        return { success: false, error: 'Your account has been banned. Please contact an administrator.' }
      }

      const session = {
        userId: user.id,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }
      db.setAuthSession(session)
      user.lastLoginAt = new Date()
      db.saveAuthUser(user)
      setAuthUser(user)
      setAuthLoading(false)
      if (user.status === 'pending') {
        return { success: true, redirect: '/pending-approval' }
      }
      return { success: true, redirect: '/app' }
    } catch {
      setAuthLoading(false)
      return { success: false, error: 'Facebook sign-in failed. Please try again.' }
    }
  }, [refreshAuthUsers])

  const logout = useCallback(() => {
    // Best-effort backend logout (invalidate D1 session), never block local logout
    api.logout().catch(() => {})
    setAuthToken(null)
    localStorage.removeItem('foxbox_worker_token')
    localStorage.removeItem('foxbox_worker_user_id')
    db.setAuthSession(null)
    setAuthUser(null)
  }, [])

  const requestPasswordReset = useCallback(async (email: string): Promise<{ success: boolean; error?: string }> => {
    const user = db.getAuthUserByEmail(email)
    if (!user) {
      // Don't reveal whether email exists
      return { success: true }
    }
    const token = Date.now().toString(36) + Math.random().toString(36).substring(2)
    user.passwordResetToken = token
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour
    db.saveAuthUser(user)
    // In production, send email with reset link
    return { success: true }
  }, [])

  const resetPassword = useCallback(async (token: string, newPassword: string): Promise<{ success: boolean; error?: string }> => {
    const users = db.getAuthUsers()
    const user = users.find(u => u.passwordResetToken === token)
    if (!user) {
      return { success: false, error: 'Invalid or expired reset token.' }
    }
    if (!user.passwordResetExpires || new Date(user.passwordResetExpires) < new Date()) {
      return { success: false, error: 'Reset token has expired. Please request a new one.' }
    }
    user.passwordHash = await hashPassword(newPassword)
    user.passwordResetToken = undefined
    user.passwordResetExpires = undefined
    user.updatedAt = new Date()
    db.saveAuthUser(user)
    return { success: true }
  }, [])

  // Admin auth actions
  const approveUser = useCallback((userId: string, role: AuthRole, approvedBy: string) => {
    const user = db.getAuthUser(userId)
    if (!user) return
    user.status = 'approved'
    user.role = role
    user.approvedAt = new Date()
    user.approvedBy = approvedBy
    user.updatedAt = new Date()
    db.saveAuthUser(user)
    // Update registration request
    const requests = db.getRegistrationRequests()
    const request = requests.find(r => r.email === user!.email)
    if (request) {
      request.status = 'approved'
      request.reviewedAt = new Date()
      request.reviewedBy = approvedBy
      db.saveRegistrationRequest(request)
    }
    refreshAuthUsers()
  }, [refreshAuthUsers])

  const rejectUser = useCallback((userId: string, reviewedBy: string, notes?: string) => {
    const user = db.getAuthUser(userId)
    if (!user) return
    user.status = 'rejected'
    user.updatedAt = new Date()
    db.saveAuthUser(user)
    const requests = db.getRegistrationRequests()
    const request = requests.find(r => r.email === user!.email)
    if (request) {
      request.status = 'rejected'
      request.reviewedAt = new Date()
      request.reviewedBy = reviewedBy
      request.reviewNotes = notes
      db.saveRegistrationRequest(request)
    }
    refreshAuthUsers()
  }, [refreshAuthUsers])

  const suspendUser = useCallback((userId: string) => {
    const user = db.getAuthUser(userId)
    if (!user) return
    user.status = 'suspended'
    user.updatedAt = new Date()
    db.saveAuthUser(user)
    refreshAuthUsers()
  }, [refreshAuthUsers])

  const reactivateUser = useCallback((userId: string) => {
    const user = db.getAuthUser(userId)
    if (!user) return
    user.status = 'approved'
    user.updatedAt = new Date()
    db.saveAuthUser(user)
    refreshAuthUsers()
  }, [refreshAuthUsers])

  // Member management is server-backed (foxbox-api). Local db is only a cache.
  const updateUserRole = useCallback(async (userId: string, role: AuthRole, _changedBy: string) => {
    await api.updateUser(userId, { role })
    await refreshAuthUsers()
  }, [refreshAuthUsers])

  const acceptInvitation = useCallback(async (token: string, fullName: string, password: string): Promise<{ success: boolean; error?: string; redirect?: string }> => {
    setAuthLoading(true)
    setAuthError(null)
    try {
      const result = await api.acceptInvitation({ token, fullName, password })
      setAuthToken(result.token)
      const userData = await api.getMe()
      db.saveAuthUser(userData)
      db.setAuthSession({
        userId: userData.id,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      })
      setAuthUser(userData)
      await loadAllData()
      setAuthLoading(false)
      return { success: true, redirect: '/app' }
    } catch (err) {
      setAuthLoading(false)
      return { success: false, error: err instanceof Error ? err.message : 'Could not accept the invitation. Please try again.' }
    }
  }, [loadAllData])

  // ─── Profile Management ──────────────────────────────────────
  const updateProfile = useCallback((data: { fullName?: string; avatar?: string | null }) => {
    if (!authUser) return
    const user = db.getAuthUser(authUser.id)
    if (!user) return
    if (data.fullName !== undefined) user.fullName = data.fullName
    if (data.avatar !== undefined) user.avatar = data.avatar || undefined
    user.updatedAt = new Date()
    db.saveAuthUser(user)
    setAuthUser(user)
    refreshAuthUsers()
  }, [authUser, refreshAuthUsers, setAuthUser])

  const changePassword = useCallback(async (currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> => {
    if (!authUser) return { success: false, error: 'Not authenticated' }
    const user = db.getAuthUser(authUser.id)
    if (!user || !user.passwordHash) return { success: false, error: 'Account not found' }
    const valid = await verifyPassword(currentPassword, user.passwordHash)
    if (!valid) return { success: false, error: 'Current password is incorrect' }
    user.passwordHash = await hashPassword(newPassword)
    user.updatedAt = new Date()
    db.saveAuthUser(user)
    return { success: true }
  }, [authUser])

  // ─── Admin User Management (server-backed) ───────────────────
  const blockUser = useCallback(async (userId: string) => {
    await api.blockUser(userId)
    // Backend invalidates the user's sessions; mirror locally if it's us
    if (authUser?.id === userId) {
      db.setAuthSession(null)
      setAuthUser(null)
    }
    await refreshAuthUsers()
  }, [authUser, refreshAuthUsers, setAuthUser])

  const unblockUser = useCallback(async (userId: string) => {
    await api.unblockUser(userId)
    await refreshAuthUsers()
  }, [refreshAuthUsers])

  const banUser = useCallback(async (userId: string) => {
    await api.banUser(userId)
    if (authUser?.id === userId) {
      db.setAuthSession(null)
      setAuthUser(null)
    }
    await refreshAuthUsers()
  }, [authUser, refreshAuthUsers, setAuthUser])

  const unbanUser = useCallback(async (userId: string) => {
    await api.unbanUser(userId)
    await refreshAuthUsers()
  }, [refreshAuthUsers])

  const deleteUser = useCallback(async (userId: string): Promise<boolean> => {
    try {
      await api.deleteUser(userId)
      await refreshAuthUsers()
      return true
    } catch {
      // Backend refuses (e.g. last active administrator) — report failure
      return false
    }
  }, [refreshAuthUsers])

  // Products
  const addProduct = useCallback((p: Product) => {
    db.saveProduct(p)
    setProducts(db.getProducts())
  }, [])
  const updateProduct = useCallback((p: Product) => {
    db.saveProduct(p)
    setProducts(db.getProducts())
  }, [])
  const deleteProduct = useCallback((id: string) => {
    db.deleteProduct(id)
    setProducts(db.getProducts())
  }, [])

  // Selling Products
  const addSellingProduct = useCallback((p: SellingProduct) => {
    db.saveSellingProduct(p)
    setSellingProducts(db.getSellingProducts())
  }, [])
  const updateSellingProduct = useCallback((p: SellingProduct) => {
    db.saveSellingProduct(p)
    setSellingProducts(db.getSellingProducts())
  }, [])
  const deleteSellingProduct = useCallback((id: string) => {
    db.deleteSellingProduct(id)
    setSellingProducts(db.getSellingProducts())
  }, [])

  // Tasks
  const addTask = useCallback((t: Task) => {
    db.saveTask(t)
    setTasks(db.getTasks())
  }, [])
  const updateTask = useCallback((t: Task) => {
    db.saveTask(t)
    setTasks(db.getTasks())
  }, [])
  const deleteTask = useCallback((id: string) => {
    db.deleteTask(id)
    setTasks(db.getTasks())
  }, [])
  const addTaskComment = useCallback((taskId: string, comment: TaskComment) => {
    const task = db.getTasks().find(t => t.id === taskId)
    if (task) {
      task.comments.push(comment)
      db.saveTask(task)
      setTasks(db.getTasks())
    }
  }, [])
  const addTaskActivity = useCallback((taskId: string, activity: TaskActivity) => {
    const task = db.getTasks().find(t => t.id === taskId)
    if (task) {
      task.activity.push(activity)
      db.saveTask(task)
      setTasks(db.getTasks())
    }
  }, [])

  // Posts
  const addPost = useCallback((p: Post) => {
    db.savePost(p)
    setPosts(db.getPosts())
  }, [])
  const updatePost = useCallback((p: Post) => {
    db.savePost(p)
    setPosts(db.getPosts())
  }, [])
  const deletePost = useCallback((id: string) => {
    db.deletePost(id)
    setPosts(db.getPosts())
  }, [])

  // Discussions
  const addMessage = useCallback((m: DiscussionMessage) => {
    db.saveMessage(m)
    setMessages(db.getMessages())
  }, [])
  const markChannelRead = useCallback((channelId: string) => {
    const ch = db.getChannels().find(c => c.id === channelId)
    if (ch) {
      ch.unreadCount = 0
      db.saveChannel(ch)
    }
  }, [])

  // Files (local compat; server is source of truth — see refreshFiles)
  const addFile = useCallback((f: VaultFile) => {
    db.saveFile(f)
    setFiles(db.getFiles())
  }, [])
  const deleteFile = useCallback((id: string) => {
    db.deleteFile(id)
    setFiles(db.getFiles())
  }, [])

  // Files (R2-backed)
  const refreshFiles = useCallback(async () => {
    const { files: serverFiles } = await api.getFiles({ limit: 100 })
    setFiles(serverFiles)
    // Keep a warm local cache for global search etc.
    for (const f of serverFiles) db.saveFile(f)
  }, [])

  const uploadFilesToServer = useCallback(async (
    items: File[],
    meta: { folder?: string; tags?: string[]; productId?: string },
    onItemProgress?: (index: number, pct: number) => void,
  ) => {
    const ok: VaultFile[] = []
    const failed: { name: string; error: string }[] = []
    for (let i = 0; i < items.length; i++) {
      try {
        const uploaded = await api.uploadFile(items[i], meta, (pct) => onItemProgress?.(i, pct))
        ok.push(uploaded)
        db.saveFile(uploaded)
      } catch (err) {
        failed.push({ name: items[i].name, error: err instanceof Error ? err.message : 'Upload failed' })
      }
    }
    setFiles(db.getFiles())
    await refreshFiles().catch(() => {})
    return { ok, failed }
  }, [refreshFiles])

  const deleteServerFile = useCallback(async (id: string) => {
    await api.deleteServerFile(id)
    db.deleteFile(id)
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }, [])

  // Creatives
  const addCreative = useCallback((c: Creative) => {
    db.saveCreative(c)
    setCreatives(db.getCreatives())
  }, [])
  const updateCreative = useCallback((c: Creative) => {
    db.saveCreative(c)
    setCreatives(db.getCreatives())
  }, [])
  const deleteCreative = useCallback((id: string) => {
    db.deleteCreative(id)
    setCreatives(db.getCreatives())
  }, [])

  // Orders
  const addOrder = useCallback((o: Order) => {
    db.saveOrder(o)
    setOrders(db.getOrders())
  }, [])
  const updateOrder = useCallback((o: Order) => {
    db.saveOrder(o)
    setOrders(db.getOrders())
  }, [])
  const deleteOrder = useCallback((id: string) => {
    db.deleteOrder(id)
    setOrders(db.getOrders())
  }, [])

  // Delivery
  const addDeliveryProvider = useCallback((dp: DeliveryProvider) => {
    db.saveDeliveryProvider(dp)
    setDeliveryProviders(db.getDeliveryProviders())
  }, [])
  const updateDeliveryProvider = useCallback((dp: DeliveryProvider) => {
    db.saveDeliveryProvider(dp)
    setDeliveryProviders(db.getDeliveryProviders())
  }, [])
  const deleteDeliveryProvider = useCallback((id: string) => {
    db.deleteDeliveryProvider(id)
    setDeliveryProviders(db.getDeliveryProviders())
  }, [])
  const addShipment = useCallback((s: Shipment) => {
    db.saveShipment(s)
    setShipments(db.getShipments())
  }, [])
  const updateShipment = useCallback((s: Shipment) => {
    db.saveShipment(s)
    setShipments(db.getShipments())
  }, [])

  // Finance
  const addExpense = useCallback((e: Expense) => {
    db.saveExpense(e)
    setExpenses(db.getExpenses())
  }, [])
  const updateExpense = useCallback((e: Expense) => {
    db.saveExpense(e)
    setExpenses(db.getExpenses())
  }, [])
  const deleteExpense = useCallback((id: string) => {
    db.deleteExpense(id)
    setExpenses(db.getExpenses())
  }, [])
  const addRevenue = useCallback((r: Revenue) => {
    db.saveRevenue(r)
    setRevenues(db.getRevenues())
  }, [])

  // Confirmations
  const addConfirmation = useCallback((c: Confirmation) => {
    db.saveConfirmation(c)
    setConfirmations(db.getConfirmations())
  }, [])
  const updateConfirmation = useCallback((c: Confirmation) => {
    db.saveConfirmation(c)
    setConfirmations(db.getConfirmations())
  }, [])
  const deleteConfirmation = useCallback((id: string) => {
    db.deleteConfirmation(id)
    setConfirmations(db.getConfirmations())
  }, [])

  // E-com Deliveries
  const addEcomDelivery = useCallback((d: EcomDelivery) => {
    db.saveEcomDelivery(d)
    setEcomDeliveries(db.getEcomDeliveries())
  }, [])
  const updateEcomDelivery = useCallback((d: EcomDelivery) => {
    db.saveEcomDelivery(d)
    setEcomDeliveries(db.getEcomDeliveries())
  }, [])
  const deleteEcomDelivery = useCallback((id: string) => {
    db.deleteEcomDelivery(id)
    setEcomDeliveries(db.getEcomDeliveries())
  }, [])
  const getDeliveryHistoryForDelivery = useCallback((deliveryId: string) => {
    return db.getDeliveryHistory(deliveryId)
  }, [])
  const addDeliveryHistoryEntry = useCallback((entry: DeliveryHistoryEntry) => {
    db.addDeliveryHistory(entry)
  }, [])

  // Notifications
  const addNotification = useCallback((n: Notification) => {
    db.saveNotification(n)
    setNotifications(db.getNotifications())
  }, [])
  const markNotificationRead = useCallback((id: string) => {
    db.markNotificationRead(id)
    setNotifications(db.getNotifications())
  }, [])
  const markAllNotificationsRead = useCallback(() => {
    db.markAllNotificationsRead()
    setNotifications(db.getNotifications())
  }, [])

  // Activity Log
  const addActivityLog = useCallback((entry: ActivityLog) => {
    db.addActivityLog(entry)
    setActivityLog(db.getActivityLog())
  }, [])

  // ─── YouCan Store Actions ─────────────────────────────────────

  // YouCan integration API base URL
  const API_BASE = import.meta.env.VITE_API_URL || 'https://foxbox-api.foxboxsolutions01.workers.dev/api'

  const addYoucanOrder = useCallback((order: YouCanOrder) => {
    db.saveYoucanOrder(order)
    setYoucanOrders(db.getYoucanOrders())
  }, [])

  const updateYoucanOrder = useCallback((order: YouCanOrder) => {
    db.saveYoucanOrder(order)
    setYoucanOrders(db.getYoucanOrders())
  }, [])

  const deleteYoucanOrder = useCallback((id: string) => {
    db.deleteYoucanOrder(id)
    setYoucanOrders(db.getYoucanOrders())
  }, [])

  const connectYoucan = useCallback(async (): Promise<{ success: boolean; url?: string; error?: string }> => {
    try {
      const res = await fetch(`${API_BASE}/youcan/oauth/connect`)
      const json = await res.json()
      const data = json.data || json
      if (data.url) return { success: true, url: data.url }
      return { success: false, error: data.error || json.error || 'Failed to get authorization URL' }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Connection failed' }
    }
  }, [])

  const disconnectYoucan = useCallback(() => {
    fetch(`${API_BASE}/youcan/oauth/disconnect`, { method: 'POST' }).catch(() => {})
    const disconnected: YouCanConnection = { ...youcanConnection, status: 'DISCONNECTED', storeName: '' }
    db.saveYoucanConnection(disconnected)
    setYoucanConnection(disconnected)
  }, [youcanConnection])

  const refreshYoucanToken = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch(`${API_BASE}/youcan/refresh-token`, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        const updated = { ...youcanConnection, expiresAt: data.expiresAt, status: 'CONNECTED' as const }
        db.saveYoucanConnection(updated)
        setYoucanConnection(updated)
        return { success: true }
      }
      return { success: false, error: data.error }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Refresh failed' }
    }
  }, [youcanConnection])

  const testYoucanConnection = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch(`${API_BASE}/youcan/test`, { method: 'POST' })
      const json = await res.json()
      const data = json.data || json
      return { success: data.success, error: data.error }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Test failed' }
    }
  }, [])

  const fetchYoucanStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/youcan/status`)
      const json = await res.json()
      const data = json.data || json
      const conn: YouCanConnection = {
        id: 'youcan-001',
        status: data.connected ? 'CONNECTED' : (data.status || 'DISCONNECTED'),
        storeName: data.storeName || '',
        clientId: data.clientId || '',
        connectedAt: data.connectedAt,
        lastSyncAt: data.lastSyncAt,
        lastWebhookAt: data.lastWebhookAt,
        ordersSyncedCount: data.ordersSyncedCount || 0,
        expiresAt: data.expiresAt,
        errorMessage: data.errorMessage,
      }
      db.saveYoucanConnection(conn)
      setYoucanConnection(conn)
    } catch { /* silent */ }
  }, [])

  const fetchYoucanOrders = useCallback(async (params: Record<string, string> = {}): Promise<{ orders: YouCanOrder[]; total: number; kpis: YouCanOrdersKpis }> => {
    try {
      const qs = new URLSearchParams(params).toString()
      const res = await fetch(`${API_BASE}/youcan/orders?${qs}`)
      const json = await res.json()
      const data = json.data || json
      const rawOrders = data.orders || []
      const orders: YouCanOrder[] = rawOrders.map((o: Record<string, unknown>) => ({
        id: o.id,
        externalOrderId: o.external_order_id,
        orderRef: o.order_ref || undefined,
        source: 'YOUCAN' as const,
        storeId: o.store_id || undefined,
        storeName: o.store_name || undefined,
        customerName: o.customer_name || undefined,
        customerEmail: o.customer_email || undefined,
        customerPhone: o.customer_phone || undefined,
        wilaya: o.wilaya || undefined,
        wilayaCode: o.wilaya_code || undefined,
        baladiya: o.baladiya || undefined,
        address: o.address || undefined,
        shippingMethod: (o.shipping_method as 'domicile' | 'bureau') || 'domicile',
        officeCode: o.office_code || undefined,
        officeName: o.office_name || undefined,
        stopdeskCode: o.stopdesk_code || undefined,
        orderItems: typeof o.order_items === 'string' ? JSON.parse(o.order_items) : (o.order_items || []),
        quantity: o.quantity || 0,
        subtotal: o.subtotal || 0,
        shippingCost: o.shipping_cost || 0,
        deliveryFee: o.delivery_fee || 0,
        total: o.total || 0,
        totalToCollect: o.total_to_collect || 0,
        currency: o.currency || 'DZD',
        paymentStatus: (o.payment_status as YouCanPaymentStatus) || 'pending',
        shippingStatus: (o.shipping_status as YouCanShippingStatus) || 'unfulfilled',
        orderStatus: (o.order_status as YouCanOrderStatus) || 'open',
        note: o.note || undefined,
        exchange: !!o.exchange,
        ecomPushStatus: (o.ecom_push_status as 'not_sent' | 'sent' | 'failed') || 'not_sent',
        ecomPushedAt: o.ecom_pushed_at || undefined,
        ecomPushTracking: o.ecom_push_tracking || undefined,
        ecomPushError: o.ecom_push_error || undefined,
        youcanCreatedAt: o.youcan_created_at || undefined,
        youcanUpdatedAt: o.youcan_updated_at || undefined,
        createdAt: o.created_at || '',
        updatedAt: o.updated_at || '',
      }))
      return { orders, total: data.total || 0, kpis: data.kpis || { totalOrders: 0, newToday: 0, pending: 0, confirmed: 0, cancelled: 0, totalRevenue: 0 } }
    } catch {
      return { orders: [], total: 0, kpis: { totalOrders: 0, newToday: 0, pending: 0, confirmed: 0, cancelled: 0, totalRevenue: 0 } }
    }
  }, [])

  const syncYoucanOrders = useCallback(async (): Promise<{ success: boolean; count?: number; error?: string }> => {
    try {
      const res = await fetch(`${API_BASE}/youcan/sync`, { method: 'POST' })
      const json = await res.json()
      const data = json.data || json
      if (data.ordersSynced !== undefined) {
        const conn = { ...youcanConnection, lastSyncAt: new Date().toISOString(), ordersSyncedCount: data.ordersSynced }
        db.saveYoucanConnection(conn)
        setYoucanConnection(conn)
        const ordersResult = await fetchYoucanOrders({ page: '1', limit: '50', sort: 'newest' })
        setYoucanOrders(ordersResult.orders)
        return { success: true, count: data.ordersSynced }
      }
      return { success: false, error: data.error }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Sync failed' }
    }
  }, [youcanConnection, fetchYoucanOrders])

  // UI
  const toggleSidebar = useCallback(() => setSidebarCollapsed(c => !c), [])

  return (
    <AppStateContext.Provider value={{
      users, currentUser, setCurrentUser,
      authUser, authLoading, authError, clearAuthError,
      login, register, loginWithGoogle, handleGoogleCallback, loginWithFacebook, logout,
      requestPasswordReset, resetPassword, setAuthToken,
      authUsers, registrationRequests, refreshAuthUsers, acceptInvitation,
      approveUser, rejectUser, suspendUser, reactivateUser, updateUserRole,
      updateProfile, changePassword, setAuthUser,
      blockUser, unblockUser, banUser, unbanUser, deleteUser,
      products, addProduct, updateProduct, deleteProduct,
      sellingProducts, addSellingProduct, updateSellingProduct, deleteSellingProduct,
      tasks, addTask, updateTask, deleteTask, addTaskComment, addTaskActivity,
      posts, addPost, updatePost, deletePost,
      channels, messages, addMessage, markChannelRead,
      files, addFile, deleteFile, refreshFiles, uploadFilesToServer, deleteServerFile,
      creatives, addCreative, updateCreative, deleteCreative,
      orders, addOrder, updateOrder, deleteOrder,
      deliveryProviders, addDeliveryProvider, updateDeliveryProvider, deleteDeliveryProvider,
      shipments, addShipment, updateShipment,
      wilayas,
      expenses, addExpense, updateExpense, deleteExpense,
      revenues, addRevenue,
      confirmations, addConfirmation, updateConfirmation, deleteConfirmation,
      ecomDeliveries, addEcomDelivery, updateEcomDelivery, deleteEcomDelivery,
      getDeliveryHistory: getDeliveryHistoryForDelivery, addDeliveryHistoryEntry,
      notifications, addNotification, markNotificationRead, markAllNotificationsRead, unreadNotificationCount,
      activityLog, addActivityLog,
      youcanOrders, youcanConnection, youcanWebhookLogs,
      addYoucanOrder, updateYoucanOrder, deleteYoucanOrder,
      syncYoucanOrders, fetchYoucanOrders,
      connectYoucan, disconnectYoucan, refreshYoucanToken, testYoucanConnection, fetchYoucanStatus,
      sidebarCollapsed, toggleSidebar,
    }}>
      {children}
    </AppStateContext.Provider>
  )
}

export function useAppState(): AppState {
  const ctx = useContext(AppStateContext)
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider')
  return ctx
}
