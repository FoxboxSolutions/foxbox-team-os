import type {
  Product, Task, Post, DiscussionChannel, DiscussionMessage,
  VaultFile, Creative, Order, DeliveryProvider, Shipment,
  Wilaya, Expense, Revenue, Notification, ActivityLog,
  User, Confirmation, EcomDelivery, DeliveryHistoryEntry,
  SellingProduct, AuthUser, AuthSession, RegistrationRequest,
  YouCanOrder, YouCanConnection, YouCanWebhookLog,
} from '@/types'

const STORAGE_PREFIX = 'foxbox_'

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 10)
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    return deserialized(parsed, fallback)
  } catch {
    return fallback
  }
}

function save(key: string, data: unknown): void {
  localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(data))
}

function deserialized<T>(data: unknown, fallback: T): T {
  if (data === null || data === undefined) return fallback
  return reviveDates(data) as T
}

function reviveDates(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'string') {
    const d = new Date(obj)
    if (!isNaN(d.getTime()) && obj.length >= 10 && obj.includes('-') && obj.includes('T')) return d
    return obj
  }
  if (Array.isArray(obj)) return obj.map(reviveDates)
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      result[k] = reviveDates(v)
    }
    return result
  }
  return obj
}

// ============================================================
// Database Class
// ============================================================

class Database {
  // Users
  getUsers(): User[] { return load<User[]>('users', []) }
  setCurrentUser(user: User): void { save('currentUser', user) }
  getCurrentUser(): User | null { return load<User | null>('currentUser', null) }

  // Products
  getProducts(): Product[] { return load<Product[]>('products', []) }
  saveProduct(p: Product): void {
    const all = this.getProducts()
    const idx = all.findIndex(x => x.id === p.id)
    if (idx >= 0) all[idx] = p; else all.push(p)
    save('products', all)
  }
  deleteProduct(id: string): void { save('products', this.getProducts().filter(p => p.id !== id)) }
  getProduct(id: string): Product | undefined { return this.getProducts().find(p => p.id === id) }

  // ─── Selling Products ──────────────────────────────────────────
  getSellingProducts(): SellingProduct[] { return load<SellingProduct[]>('sellingProducts', []) }
  saveSellingProduct(p: SellingProduct): void {
    const all = this.getSellingProducts()
    const idx = all.findIndex(x => x.id === p.id)
    if (idx >= 0) all[idx] = p; else all.push(p)
    save('sellingProducts', all)
  }
  deleteSellingProduct(id: string): void { save('sellingProducts', this.getSellingProducts().filter(p => p.id !== id)) }
  getSellingProduct(id: string): SellingProduct | undefined { return this.getSellingProducts().find(p => p.id === id) }

  // Tasks
  getTasks(): Task[] { return load<Task[]>('tasks', []) }
  saveTask(t: Task): void {
    const all = this.getTasks()
    const idx = all.findIndex(x => x.id === t.id)
    if (idx >= 0) all[idx] = t; else all.push(t)
    save('tasks', all)
  }
  deleteTask(id: string): void { save('tasks', this.getTasks().filter(t => t.id !== id)) }

  // Posts
  getPosts(): Post[] { return load<Post[]>('posts', []) }
  savePost(p: Post): void {
    const all = this.getPosts()
    const idx = all.findIndex(x => x.id === p.id)
    if (idx >= 0) all[idx] = p; else all.push(p)
    save('posts', all)
  }
  deletePost(id: string): void { save('posts', this.getPosts().filter(p => p.id !== id)) }

  // Channels
  getChannels(): DiscussionChannel[] { return load<DiscussionChannel[]>('channels', []) }
  saveChannel(ch: DiscussionChannel): void {
    const all = this.getChannels()
    const idx = all.findIndex(x => x.id === ch.id)
    if (idx >= 0) all[idx] = ch; else all.push(ch)
    save('channels', all)
  }

  // Messages
  getMessages(): DiscussionMessage[] { return load<DiscussionMessage[]>('messages', []) }
  saveMessage(m: DiscussionMessage): void {
    const all = this.getMessages()
    all.push(m)
    save('messages', all)
  }

  // Files
  getFiles(): VaultFile[] { return load<VaultFile[]>('files', []) }
  saveFile(f: VaultFile): void {
    const all = this.getFiles()
    all.push(f)
    save('files', all)
  }
  deleteFile(id: string): void { save('files', this.getFiles().filter(f => f.id !== id)) }

  // Creatives
  getCreatives(): Creative[] { return load<Creative[]>('creatives', []) }
  saveCreative(c: Creative): void {
    const all = this.getCreatives()
    const idx = all.findIndex(x => x.id === c.id)
    if (idx >= 0) all[idx] = c; else all.push(c)
    save('creatives', all)
  }
  deleteCreative(id: string): void { save('creatives', this.getCreatives().filter(c => c.id !== id)) }

  // Orders
  getOrders(): Order[] { return load<Order[]>('orders', []) }
  saveOrder(o: Order): void {
    const all = this.getOrders()
    const idx = all.findIndex(x => x.id === o.id)
    if (idx >= 0) all[idx] = o; else all.push(o)
    save('orders', all)
  }
  deleteOrder(id: string): void { save('orders', this.getOrders().filter(o => o.id !== id)) }

  // Delivery Providers
  getDeliveryProviders(): DeliveryProvider[] { return load<DeliveryProvider[]>('deliveryProviders', []) }
  saveDeliveryProvider(dp: DeliveryProvider): void {
    const all = this.getDeliveryProviders()
    const idx = all.findIndex(x => x.id === dp.id)
    if (idx >= 0) all[idx] = dp; else all.push(dp)
    save('deliveryProviders', all)
  }
  deleteDeliveryProvider(id: string): void { save('deliveryProviders', this.getDeliveryProviders().filter(d => d.id !== id)) }

  // Shipments
  getShipments(): Shipment[] { return load<Shipment[]>('shipments', []) }
  saveShipment(s: Shipment): void {
    const all = this.getShipments()
    const idx = all.findIndex(x => x.id === s.id)
    if (idx >= 0) all[idx] = s; else all.push(s)
    save('shipments', all)
  }

  // Wilayas
  getWilayas(): Wilaya[] { return load<Wilaya[]>('wilayas', []) }
  saveWilaya(w: Wilaya): void {
    const all = this.getWilayas()
    const idx = all.findIndex(x => x.id === w.id)
    if (idx >= 0) all[idx] = w; else all.push(w)
    save('wilayas', all)
  }

  // Expenses
  getExpenses(): Expense[] { return load<Expense[]>('expenses', []) }
  saveExpense(e: Expense): void {
    const all = this.getExpenses()
    const idx = all.findIndex(x => x.id === e.id)
    if (idx >= 0) all[idx] = e; else all.push(e)
    save('expenses', all)
  }
  deleteExpense(id: string): void { save('expenses', this.getExpenses().filter(e => e.id !== id)) }

  // Revenues
  getRevenues(): Revenue[] { return load<Revenue[]>('revenues', []) }
  saveRevenue(r: Revenue): void {
    const all = this.getRevenues()
    all.push(r)
    save('revenues', all)
  }

  // Confirmations
  getConfirmations(): Confirmation[] { return load<Confirmation[]>('confirmations', []) }
  saveConfirmation(c: Confirmation): void {
    const all = this.getConfirmations()
    const idx = all.findIndex(x => x.id === c.id)
    if (idx >= 0) all[idx] = c; else all.push(c)
    save('confirmations', all)
  }
  deleteConfirmation(id: string): void { save('confirmations', this.getConfirmations().filter(c => c.id !== id)) }
  getConfirmationByPhone(phone: string): Confirmation | undefined {
    return this.getConfirmations().find(c => c.phone === phone)
  }

  // Notifications
  getNotifications(): Notification[] { return load<Notification[]>('notifications', []) }
  saveNotification(n: Notification): void {
    const all = this.getNotifications()
    all.push(n)
    save('notifications', all)
  }
  markNotificationRead(id: string): void {
    const all = this.getNotifications()
    const n = all.find(x => x.id === id)
    if (n) { n.isRead = true; save('notifications', all) }
  }
  markAllNotificationsRead(): void {
    const all = this.getNotifications().map(n => ({ ...n, isRead: true }))
    save('notifications', all)
  }

  // Activity Log
  getActivityLog(): ActivityLog[] { return load<ActivityLog[]>('activityLog', []) }
  addActivityLog(entry: ActivityLog): void {
    const all = this.getActivityLog()
    all.push(entry)
    save('activityLog', all)
  }

  // E-com Deliveries
  getEcomDeliveries(): EcomDelivery[] { return load<EcomDelivery[]>('ecomDeliveries', []) }
  saveEcomDelivery(d: EcomDelivery): void {
    const all = this.getEcomDeliveries()
    const idx = all.findIndex(x => x.id === d.id)
    if (idx >= 0) all[idx] = d; else all.push(d)
    save('ecomDeliveries', all)
  }
  deleteEcomDelivery(id: string): void { save('ecomDeliveries', this.getEcomDeliveries().filter(d => d.id !== id)) }
  getEcomDeliveryByTracking(tracking: string): EcomDelivery | undefined {
    return this.getEcomDeliveries().find(d => d.ecomTracking === tracking)
  }

  // Delivery History
  getDeliveryHistory(deliveryId: string): DeliveryHistoryEntry[] {
    const all = load<DeliveryHistoryEntry[]>('deliveryHistory', [])
    return all.filter(h => h.deliveryId === deliveryId)
  }
  addDeliveryHistory(entry: DeliveryHistoryEntry): void {
    const all = load<DeliveryHistoryEntry[]>('deliveryHistory', [])
    all.push(entry)
    save('deliveryHistory', all)
  }
  getAllDeliveryHistory(): DeliveryHistoryEntry[] { return load<DeliveryHistoryEntry[]>('deliveryHistory', []) }

  // Settings
  getSettings(): Record<string, unknown> { return load<Record<string, unknown>>('settings', {}) }
  saveSetting(key: string, value: unknown): void {
    const s = this.getSettings()
    s[key] = value
    save('settings', s)
  }

  // ─── Auth Users ────────────────────────────────────────────────
  getAuthUsers(): AuthUser[] { return load<AuthUser[]>('authUsers', []) }
  getAuthUser(id: string): AuthUser | undefined { return this.getAuthUsers().find(u => u.id === id) }
  getAuthUserByEmail(email: string): AuthUser | undefined {
    return this.getAuthUsers().find(u => u.email.toLowerCase() === email.toLowerCase())
  }
  getAuthUserByGoogleId(googleId: string): AuthUser | undefined {
    return this.getAuthUsers().find(u => u.googleId === googleId)
  }
  getAuthUserByFacebookId(facebookId: string): AuthUser | undefined {
    return this.getAuthUsers().find(u => u.facebookId === facebookId)
  }
  saveAuthUser(u: AuthUser): void {
    const all = this.getAuthUsers()
    const idx = all.findIndex(x => x.id === u.id)
    if (idx >= 0) all[idx] = u; else all.push(u)
    save('authUsers', all)
  }
  deleteAuthUser(id: string): void { save('authUsers', this.getAuthUsers().filter(u => u.id !== id)) }

  // ─── Auth Session ─────────────────────────────────────────────
  getAuthSession(): AuthSession | null { return load<AuthSession | null>('authSession', null) }
  setAuthSession(s: AuthSession | null): void { save('authSession', s) }

  // ─── Current Auth User ───────────────────────────────────────
  getCurrentAuthUser(): AuthUser | null {
    const session = this.getAuthSession()
    if (!session) return null
    if (new Date(session.expiresAt) < new Date()) {
      this.setAuthSession(null)
      return null
    }
    return this.getAuthUser(session.userId) || null
  }

  // ─── Registration Requests ───────────────────────────────────
  getRegistrationRequests(): RegistrationRequest[] {
    return load<RegistrationRequest[]>('registrationRequests', [])
  }
  getRegistrationRequest(id: string): RegistrationRequest | undefined {
    return this.getRegistrationRequests().find(r => r.id === id)
  }
  saveRegistrationRequest(r: RegistrationRequest): void {
    const all = this.getRegistrationRequests()
    const idx = all.findIndex(x => x.id === r.id)
    if (idx >= 0) all[idx] = r; else all.push(r)
    save('registrationRequests', all)
  }
  deleteRegistrationRequest(id: string): void {
    save('registrationRequests', this.getRegistrationRequests().filter(r => r.id !== id))
  }

  // ─── Seed admin user if no auth users exist ──────────────────
  seedAdminUser(): void {
    if (this.getAuthUsers().length > 0) return
    // Import dynamically to avoid circular deps
    const adminUser: AuthUser = {
      id: 'admin-001',
      fullName: 'Youssef',
      email: 'youssef@foxbox.dz',
      role: 'administrator',
      requestedRole: 'administrator',
      status: 'approved',
      authProvider: 'email',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      approvedAt: new Date('2024-01-01'),
      approvedBy: 'system',
    }
    this.saveAuthUser(adminUser)
  }

  // Init with mock data if empty
  initWithDefaults(defaults: {
    users: User[]
    products: Product[]
    tasks: Task[]
    posts: Post[]
    channels: DiscussionChannel[]
    messages: DiscussionMessage[]
    files: VaultFile[]
    creatives: Creative[]
    orders: Order[]
    deliveryProviders: DeliveryProvider[]
    shipments: Shipment[]
    wilayas: Wilaya[]
    expenses: Expense[]
    revenues: Revenue[]
    notifications: Notification[]
    activityLog: ActivityLog[]
    confirmations?: Confirmation[]
  }): void {
    if (this.getProducts().length === 0) save('products', defaults.products)
    if (this.getTasks().length === 0) save('tasks', defaults.tasks)
    if (this.getPosts().length === 0) save('posts', defaults.posts)
    if (this.getChannels().length === 0) save('channels', defaults.channels)
    if (this.getMessages().length === 0) save('messages', defaults.messages)
    if (this.getFiles().length === 0) save('files', defaults.files)
    if (this.getCreatives().length === 0) save('creatives', defaults.creatives)
    if (this.getOrders().length === 0) save('orders', defaults.orders)
    if (this.getDeliveryProviders().length === 0) save('deliveryProviders', defaults.deliveryProviders)
    if (this.getShipments().length === 0) save('shipments', defaults.shipments)
    if (this.getWilayas().length === 0) save('wilayas', defaults.wilayas)
    if (this.getExpenses().length === 0) save('expenses', defaults.expenses)
    if (this.getRevenues().length === 0) save('revenues', defaults.revenues)
    if (this.getNotifications().length === 0) save('notifications', defaults.notifications)
    if (this.getActivityLog().length === 0) save('activityLog', defaults.activityLog)
    if (defaults.confirmations && this.getConfirmations().length === 0) save('confirmations', defaults.confirmations)
    if (this.getUsers().length === 0) {
      save('users', defaults.users)
      this.setCurrentUser(defaults.users[0])
    }
  }

  // ─── YouCan Integration ─────────────────────────────────────

  getYoucanOrders(): YouCanOrder[] {
    return load<YouCanOrder[]>('youcanOrders', [])
  }

  saveYoucanOrder(order: YouCanOrder): void {
    const orders = this.getYoucanOrders()
    const idx = orders.findIndex(o => o.externalOrderId === order.externalOrderId)
    if (idx >= 0) {
      orders[idx] = { ...orders[idx], ...order, updatedAt: new Date().toISOString() }
    } else {
      orders.push(order)
    }
    save('youcanOrders', orders)
  }

  getYoucanOrder(id: string): YouCanOrder | null {
    return this.getYoucanOrders().find(o => o.id === id || o.externalOrderId === id) || null
  }

  deleteYoucanOrder(id: string): void {
    const orders = this.getYoucanOrders().filter(o => o.id !== id && o.externalOrderId !== id)
    save('youcanOrders', orders)
  }

  getYoucanConnection(): YouCanConnection {
    return load<YouCanConnection>('youcanConnection', { id: 'youcan-001', storeName: '', status: 'DISCONNECTED', ordersSyncedCount: 0 })
  }

  saveYoucanConnection(conn: YouCanConnection): void {
    save('youcanConnection', conn)
  }

  getYoucanWebhookLogs(): YouCanWebhookLog[] {
    return load<YouCanWebhookLog[]>('youcanWebhookLogs', [])
  }

  saveYoucanWebhookLog(log: YouCanWebhookLog): void {
    const logs = this.getYoucanWebhookLogs()
    logs.unshift(log)
    if (logs.length > 500) logs.length = 500
    save('youcanWebhookLogs', logs)
  }

  generateId(): string { return generateId() }
}

export const db = new Database()
