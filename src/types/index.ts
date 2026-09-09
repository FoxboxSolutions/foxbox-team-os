// ============================================================
// FOXBOX TEAM OS — Core Type Definitions
// ============================================================

// --- User & Roles ---

export type UserRole = 'ADMIN' | 'MANAGER' | 'PRODUCT_RESEARCH' | 'MARKETING' | 'OPERATIONS' | 'FINANCE'

export type AuthRole = 'administrator' | 'mediabuyer' | 'confirmator'

export type AuthProvider = 'email' | 'google' | 'facebook'

export type AccountStatus = 'pending' | 'approved' | 'rejected' | 'suspended' | 'blocked' | 'banned' | 'needs_role'

export interface User {
  id: string
  name: string
  email: string
  avatar?: string
  role: UserRole
  isActive: boolean
  createdAt: Date
}

export interface AuthUser {
  id: string
  fullName: string
  email: string
  passwordHash?: string
  avatar?: string
  role: AuthRole
  requestedRole: AuthRole
  status: AccountStatus
  authProvider: AuthProvider
  googleId?: string
  facebookId?: string
  createdAt: Date
  updatedAt: Date
  approvedAt?: Date
  approvedBy?: string
  lastLoginAt?: Date
  passwordResetToken?: string
  passwordResetExpires?: Date
}

export interface AuthSession {
  userId: string
  createdAt: Date
  expiresAt: Date
}

export interface RegistrationRequest {
  id: string
  fullName: string
  email: string
  requestedRole: AuthRole
  authProvider: AuthProvider
  status: AccountStatus
  createdAt: Date
  reviewedAt?: Date
  reviewedBy?: string
  reviewNotes?: string
}

// --- Product Research ---

export type ProductStatus =
  | 'IDEA'
  | 'RESEARCH'
  | 'STANDBY'
  | 'TESTING'
  | 'APPROVED'
  | 'PURCHASE'
  | 'SCALING'
  | 'REJECTED'

export type SourceType = 'AUTO' | 'MANUAL' | 'ESTIMATED' | 'MISSING'

export interface ProductField {
  fieldName: string
  sourceValue: string | null
  currentValue: string | null
  sourceType: SourceType
  confidence?: number
}

export interface ProductVariant {
  id: string
  name: string
  sku?: string
  color?: string
  size?: string
  priceRmb: number
  stock?: number
  imageUrl?: string
}

export interface ProductLink {
  id: string
  title: string
  url: string
  category: 'SUPPLIER' | 'MARKETPLACE' | 'AD_LIBRARY' | 'SOCIAL' | 'DOCUMENT' | 'TRACKING' | 'OTHER'
  tags?: string[]
  createdBy: string
  createdAt: Date
}

export interface ProductCreative {
  id: string
  type: 'image' | 'video'
  sourceUrl: string
  storageUrl?: string
  thumbnailUrl?: string
  filename?: string
  dimensions?: string
  duration?: number
  fileSize?: number
  status: 'IMPORTED' | 'FAILED' | 'MISSING'
  createdAt: Date
}

export interface Supplier {
  id: string
  name: string
  platform: string
  url: string
  rating?: number
  notes?: string
}

export interface ShippingProfile {
  id: string
  name: string
  origin: string
  destination: string
  method: string
  rate: number
  rateUnit: 'KG' | 'LB' | 'CARTON' | 'FIXED'
  minimumCharge: number
  volumetricRule?: string
  notes?: string
}

export interface CurrencyRate {
  id: string
  fromCurrency: 'RMB' | 'USD' | 'DZD'
  toCurrency: 'RMB' | 'USD' | 'DZD'
  rate: number
  effectiveAt: Date
  source: string
}

export interface CostScenario {
  id: string
  productId: string
  quantity: number
  purchaseCostRmb: number
  shippingCostUsd: number
  otherCostUsd: number
  landedCostUsd: number
  landedCostDzd: number
}

export interface CODScenario {
  id: string
  productId: string
  sellingPriceDzd: number
  deliveryFeeDzd: number
  advertisingCpaDzd: number
  confirmationCostDzd: number
  confirmationRate: number
  deliveryRate: number
  returnRate: number
  returnCostDzd: number
  otherCostDzd: number
}

export interface Offer {
  id: string
  productId: string
  name: string
  quantity: number
  sellingPriceDzd: number
}

export interface Test {
  id: string
  productId: string
  startDate: Date
  endDate?: Date
  adSpend: number
  impressions: number
  clicks: number
  orders: number
  confirmed: number
  shipped: number
  delivered: number
  returned: number
  revenue: number
  notes?: string
}

export interface DecisionHistory {
  id: string
  productId: string
  oldStatus: ProductStatus
  newStatus: ProductStatus
  reason?: string
  createdAt: Date
  createdBy: string
}

export interface Product {
  id: string
  name: string
  sourceUrl: string
  sourcePlatform: string
  sourceProductId?: string
  description?: string
  category?: string
  status: ProductStatus
  score?: number
  notes?: string
  imageUrl?: string
  createdAt: Date
  updatedAt: Date
  lastAnalyzedAt?: Date
  isWinner?: boolean

  // Related data
  fields: ProductField[]
  variants: ProductVariant[]
  creatives: ProductCreative[]
  links: ProductLink[]
  supplier?: Supplier
  shippingProfile?: ShippingProfile
  costScenario?: CostScenario
  codScenario?: CODScenario
  offers: Offer[]
  tests: Test[]
  decisionHistory: DecisionHistory[]
}

// ─── Product Selling (commercial products we actually sell) ──────

export type SellingProductStatus = 'ACTIVE' | 'INACTIVE'

export interface SellingProduct {
  id: string
  name: string
  sku: string
  description?: string
  imageUrl?: string
  sellingPriceDzd: number
  costPriceDzd: number
  stock: number
  availableStock: number
  status: SellingProductStatus
  weight?: number
  supplier?: string
  supplierRef?: string
  notes?: string
  // Link back to research product (optional)
  researchProductId?: string
  // Stats (computed at display time, not stored)
  totalOrders?: number
  confirmedOrders?: number
  deliveredOrders?: number
  returnedOrders?: number
  revenue?: number
  createdAt: Date
  updatedAt: Date
}

export interface DashboardStats {
  totalProducts: number
  testing: number
  approved: number
  standby: number
  rejected: number
  scaling: number
  potentialProfit: number
  totalInvested: number
  activeTests: number
}

// --- Team Hub / Posts ---

export type PostType =
  | 'ANNOUNCEMENT'
  | 'PRODUCT_IDEA'
  | 'PRODUCT_ANALYSIS'
  | 'WINNING_PRODUCT'
  | 'MARKETING'
  | 'CREATIVE'
  | 'SUPPLIER_INFO'
  | 'WARNING'
  | 'KNOWLEDGE'
  | 'GENERAL'

export interface PostReaction {
  emoji: string
  users: string[]
}

export interface PostComment {
  id: string
  postId: string
  userId: string
  content: string
  mentions: string[]
  createdAt: Date
  updatedAt?: Date
}

export interface Post {
  id: string
  userId: string
  type: PostType
  title: string
  content: string
  images?: string[]
  links?: string[]
  productId?: string
  taskId?: string
  reactions: PostReaction[]
  comments: PostComment[]
  bookmarks: string[]
  createdAt: Date
  updatedAt?: Date
}

// --- Discussions ---

export interface DiscussionChannel {
  id: string
  name: string
  description: string
  icon: string
  unreadCount: number
  isProductLinked: boolean
  productId?: string
}

export interface DiscussionMessage {
  id: string
  channelId: string
  userId: string
  content: string
  mentions: string[]
  repliesTo?: string
  createdAt: Date
  updatedAt?: Date
}

// --- Tasks ---

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE'
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'

export interface TaskComment {
  id: string
  taskId: string
  userId: string
  content: string
  createdAt: Date
}

export interface TaskActivity {
  id: string
  taskId: string
  userId: string
  action: string
  details?: string
  createdAt: Date
}

export interface Task {
  id: string
  title: string
  description: string
  assigneeId: string
  creatorId: string
  priority: TaskPriority
  status: TaskStatus
  dueDate?: Date
  tags: string[]
  productId?: string
  attachments: string[]
  comments: TaskComment[]
  activity: TaskActivity[]
  createdAt: Date
  updatedAt: Date
}

// --- Files / Media Vault ---

export type FileFolder = 'PRODUCTS' | 'CREATIVES' | 'VIDEOS' | 'IMAGES' | 'SUPPLIERS' | 'DOCUMENTS' | 'MARKETING' | 'OPERATIONS'

export type FileCategory = 'image' | 'video' | 'document' | 'audio' | 'other'
export type FileSource = 'upload' | 'generated'

export interface VaultFile {
  id: string
  name: string
  originalName: string
  mimeType: string
  size: number
  url: string
  thumbnailUrl?: string
  folder: FileFolder
  tags: string[]
  productId?: string
  uploadedBy: string
  createdAt: Date
  // R2-backed metadata (present for server files; reserved for future AI pipeline)
  category?: FileCategory
  source?: FileSource
}

// --- Creative Lab ---

export type CreativePlatform = 'META' | 'TIKTOK' | 'OTHER'
export type CreativeStatus = 'IDEA' | 'IN_PRODUCTION' | 'READY' | 'TESTING' | 'WINNER' | 'ARCHIVED'

export interface CreativePerformance {
  impressions: number
  clicks: number
  ctr: number
  cpc: number
  cpa: number
  roas: number
  orders: number
  revenue: number
}

export interface Creative {
  id: string
  productId: string
  name: string
  hook?: string
  script?: string
  angle?: string
  platform: CreativePlatform
  type: 'image' | 'video' | 'carousel'
  status: CreativeStatus
  fileUrl?: string
  thumbnailUrl?: string
  performance?: CreativePerformance
  isWinner: boolean
  notes?: string
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

// --- COD Center / Orders ---

export type OrderStatus =
  | 'NEW'
  | 'PENDING_CONFIRMATION'
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'PREPARING'
  | 'SHIPPED'
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'RETURNED'

export type ConfirmationStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'NO_ANSWER'
  | 'CALL_BACK'
  | 'WRONG_NUMBER'
  | 'CANCELLED'

export interface Customer {
  id: string
  name: string
  phone: string
  phoneAlt?: string
  wilaya: string
  commune: string
  address: string
  deliveryType: 'HOME' | 'STOP_DESK'
  notes?: string
}

export interface Order {
  id: string
  orderNumber: string
  customer: Customer
  productId: string
  quantity: number
  sellingPriceDzd: number
  deliveryFeeDzd: number
  paymentMethod: 'COD' | 'CCP' | 'BARIDIMOB'
  carrierId?: string
  trackingNumber?: string
  status: OrderStatus
  confirmationStatus: ConfirmationStatus
  confirmedAt?: Date
  shippedAt?: Date
  deliveredAt?: Date
  returnedAt?: Date
  notes?: string
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

// --- Delivery ---

export type DeliveryServiceType = 'HOME_DELIVERY' | 'STOP_DESK' | 'EXPRESS'

export interface DeliveryProvider {
  id: string
  name: string
  code: string
  trackingUrl?: string
  services: DeliveryServiceType[]
  pricePerKg?: number
  pricePerOrder?: number
  isActive: boolean
  notes?: string
}

export interface Shipment {
  id: string
  orderId: string
  providerId: string
  trackingNumber: string
  serviceType: DeliveryServiceType
  status: 'PICKED_UP' | 'IN_TRANSIT' | 'AT_HUB' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'RETURNED' | 'LOST'
  shippedAt: Date
  estimatedDelivery?: Date
  deliveredAt?: Date
  returnReason?: string
  cost: number
  weightKg?: number
  notes?: string
  createdAt: Date
  updatedAt: Date
}

// --- E-com Delivery Integration ---

export type EcomDeliveryStatus =
  | 'PREPARING'
  | 'PROCESSING'
  | 'DISPATCHED'
  | 'AT_OFFICE'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'NO_ANSWER'
  | 'POSTPONED'
  | 'CANCELLED'
  | 'RETURNED'
  | 'DISPATCH_RETURN'
  | 'NAVETTE_RETURN'
  | 'COLLECTED'
  | 'RECOVERED'
  | 'CONFIRMED'
  | 'TRACKING'
  | 'IN_PROGRESS'

export interface EcomDelivery {
  id: string
  orderId?: string
  foxboxOrderNumber?: string

  // E-com identifiers
  provider: 'ecom_delivery'
  ecomTracking: string
  ecomIdColis?: number
  ecomIdExterne?: string

  // Situation
  ecomSituation: string
  ecomSituationId: number
  ecomEtatLogistique: string
  ecomEtatLogistiqueId: number

  // Status
  status: EcomDeliveryStatus
  statusLabel: string

  // Customer
  customerName: string
  customerPhone: string
  customerPhoneAlt?: string

  // Location
  wilayaCode: string
  wilayaName: string
  commune: string
  deliveryMode: 'HOME' | 'STOP_DESK'
  address?: string
  stopdeskCode?: string
  stopdeskName?: string

  // Product
  product: string
  quantity: number
  total: number

  // E-com financials
  ecomTarifLivraison?: number
  ecomTarifAnnulation?: number
  ecomEncaisser?: number
  ecomRecouvert?: number

  // Dates
  ecomLastActionAt?: string
  ecomLastSyncAt?: string
  createdAt: Date
  updatedAt: Date
}

export interface DeliveryHistoryEntry {
  id: string
  deliveryId: string
  ecomEventId?: string
  situation: string
  situationId?: number
  etatLogistique?: string
  etatLogistiqueId?: number
  commentaire: string
  wilayaCode?: string
  receivedAt: string
  source: 'webhook' | 'sync' | 'manual'
}

export interface EcomWebhookEvent {
  id: string
  tracking: string
  situation: string
  receivedAt: string
  result: string
}

export interface EcomRequestLog {
  method: string
  path: string
  status: number
  elapsed: number
  timestamp: string
  success: boolean
  error?: string
}

// --- Wilaya / Geography ---

export interface Commune {
  id: string
  name: string
  wilayaId: string
}

export interface Wilaya {
  id: string
  code: string
  name: string
  nameAr?: string
  communes: Commune[]
}

// --- Finance ---

export type ExpenseCategory = 'PRODUCT' | 'SHIPPING' | 'DELIVERY' | 'ADVERTISING' | 'PACKAGING' | 'OPERATIONS' | 'TOOLS' | 'OTHER'

export interface Expense {
  id: string
  category: ExpenseCategory
  description: string
  amountDzd: number
  amountUsd?: number
  productId?: string
  orderId?: string
  createdBy: string
  createdAt: Date
}

export interface Revenue {
  id: string
  source: 'ORDER' | 'REFUND' | 'OTHER'
  amountDzd: number
  orderId?: string
  productId?: string
  createdAt: Date
}

// --- Notifications ---

export type NotificationType =
  | 'TASK_ASSIGNED'
  | 'MENTION'
  | 'PRODUCT_STATUS_CHANGED'
  | 'ORDER_RECEIVED'
  | 'CREATIVE_WINNER'
  | 'SUPPLIER_UPDATED'
  | 'COMMENT_ADDED'
  | 'FILE_UPLOADED'
  | 'GENERAL'
  | 'YOUCAN_SYNC_COMPLETE'
  | 'YOUCAN_SYNC_FAILED'
  | 'YOUCAN_NEW_ORDER'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  link?: string
  isRead: boolean
  userId: string
  createdAt: Date
}

// --- Confirmation via Message ---

export type MessageConfirmationStatus = 'CONFIRMED' | 'PENDING' | 'CANCELLED'

export interface Confirmation {
  id: string
  fullName: string
  phone: string
  // Location
  wilayaCode: string
  wilayaName: string
  baladiya: string
  // Delivery
  shippingMethod: 'HOME' | 'OFFICE'
  deliveryPrice: number
  // Home delivery
  address?: string
  // Office delivery
  officeRef?: string
  officeName?: string
  officeAddress?: string
  officePhone?: string
  transporter?: string
  // Product
  productId?: string
  productPrice: number
  quantity: number
  total: number
  // Additional
  notes?: string
  status: MessageConfirmationStatus
  createdBy: string
  createdAt: Date
  updatedAt: Date
  // --- E-com Delivery Integration ---
  deliveryProvider?: 'ecom'
  ecomTracking?: string
  ecomParcelId?: number
  ecomIdExterne?: string
  ecomStatus?: EcomDeliveryStatus
  ecomStatusId?: number
  ecomStatusText?: string
  ecomLogisticsState?: string
  ecomLogisticsStateId?: number
  ecomCreatedAt?: string
  ecomLastSyncAt?: string
  ecomSentAt?: string
  ecomError?: string
}

// --- Activity Log ---

export type ActivityAction =
  | 'PRODUCT_CREATED'
  | 'PRODUCT_UPDATED'
  | 'STATUS_CHANGED'
  | 'TASK_CREATED'
  | 'TASK_COMPLETED'
  | 'FILE_UPLOADED'
  | 'ORDER_CREATED'
  | 'ORDER_UPDATED'
  | 'CREATIVE_ADDED'
  | 'CREATIVE_WINNER'
  | 'SUPPLIER_CHANGED'
  | 'POST_CREATED'
  | 'COMMENT_ADDED'
  | 'CONFIRMATION_CREATED'
  | 'CONFIRMATION_UPDATED'
  | 'CONFIRMATION_DELETED'
  | 'CONFIRMATION_SENT_TO_ECOM'
  | 'USER_REGISTERED'
  | 'USER_APPROVED'
  | 'USER_REJECTED'
  | 'USER_SUSPENDED'
  | 'ROLE_CHANGED'
  | 'USER_LOGGED_IN'
  | 'USER_LOGGED_OUT'
  | 'PASSWORD_RESET_REQUESTED'
  | 'PASSWORD_RESET_COMPLETED'
  | 'YOUCAN_CONNECTED'
  | 'YOUCAN_DISCONNECTED'
  | 'YOUCAN_SYNC_STARTED'
  | 'YOUCAN_SYNC_COMPLETED'
  | 'YOUCAN_ORDER_IMPORTED'
  | 'YOUCAN_ORDER_STATUS_UPDATED'
  | 'YOUCAN_WEBHOOK_RECEIVED'

export interface ActivityLog {
  id: string
  action: ActivityAction
  userId: string
  entityType: 'PRODUCT' | 'TASK' | 'ORDER' | 'CREATIVE' | 'FILE' | 'POST' | 'DISCUSSION' | 'CONFIRMATION' | 'SELLING_PRODUCT'
  entityId: string
  entityName: string
  details?: string
  createdAt: Date
}

// ─── YouCan Integration ─────────────────────────────────────

export type YouCanConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'NEEDS_AUTH'

export interface YouCanConnection {
  id: string
  storeName: string
  storeIdentifier?: string
  clientId?: string
  clientSecret?: string
  accessToken?: string
  refreshToken?: string
  expiresAt?: string
  tokenType?: string
  scopes?: string[]
  status: YouCanConnectionStatus
  connectedAt?: string
  lastSyncAt?: string
  lastWebhookAt?: string
  ordersSyncedCount: number
  errorMessage?: string
  createdAt?: Date
  updatedAt?: Date
}

export type YouCanOrderStatus = 'open' | 'confirmed' | 'cancelled' | 'completed'
export type YouCanPaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded'
export type YouCanShippingStatus = 'unfulfilled' | 'fulfilled' | 'shipped' | 'delivered' | 'returned'

export interface YouCanOrderItem {
  externalProductId?: string
  productName: string
  variant?: string
  sku?: string
  qty: number
  unitPrice: number
  totalPrice: number
}

export interface YouCanOrder {
  id: string
  externalOrderId: string
  orderRef?: string
  source: 'YOUCAN'
  storeId?: string
  storeName?: string
  customerName?: string
  customerEmail?: string
  customerPhone?: string
  wilaya?: string
  wilayaCode?: string
  baladiya?: string
  address?: string
  shippingMethod: 'domicile' | 'bureau'
  officeCode?: string
  officeName?: string
  stopdeskCode?: string
  orderItems: YouCanOrderItem[]
  quantity: number
  subtotal: number
  shippingCost: number
  deliveryFee: number
  total: number
  totalToCollect: number
  currency: string
  paymentStatus: YouCanPaymentStatus
  shippingStatus: YouCanShippingStatus
  orderStatus: YouCanOrderStatus
  note?: string
  exchange: boolean
  ecomPushStatus: 'not_sent' | 'sent' | 'failed'
  ecomPushedAt?: string
  ecomPushTracking?: string
  ecomPushError?: string
  youcanCreatedAt?: string
  youcanUpdatedAt?: string
  rawPayload?: unknown
  createdAt: string
  updatedAt: string
}

export interface YouCanWebhookLog {
  id: string
  eventId: string
  eventType: string
  receivedAt: string
  orderId?: string
  status: 'RECEIVED' | 'PROCESSED' | 'DUPLICATE' | 'FAILED'
  error?: string
  processingTimeMs?: number
}

export interface YouCanOrdersResponse {
  orders: YouCanOrder[]
  total: number
  page: number
  limit: number
  totalPages: number
  kpis: YouCanOrdersKpis
}

export interface YouCanOrdersKpis {
  totalOrders: number
  newToday: number
  pending: number
  confirmed: number
  cancelled: number
  totalRevenue: number
}
