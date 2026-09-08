import type {
  Product,
  ShippingProfile,
  DashboardStats,
  User,
  Task,
  Post,
  DiscussionChannel,
  DiscussionMessage,
  VaultFile,
  Creative,
  Order,
  DeliveryProvider,
  Shipment,
  Wilaya,
  Expense,
  Revenue,
  Notification,
  ActivityLog,
} from '@/types'

// ============================================================
// Currency & Shipping
// ============================================================

export const defaultCurrencyRates = {
  rmbToUsd: 0.15,
  usdToDzd: 260,
}

export const shippingProfiles: ShippingProfile[] = [
  {
    id: '1',
    name: 'China → Algeria Air Cargo',
    origin: 'China',
    destination: 'Algeria',
    method: 'Air Cargo',
    rate: 9.40,
    rateUnit: 'KG',
    minimumCharge: 1,
    notes: 'Standard air cargo shipping',
  },
  {
    id: '2',
    name: 'China → Algeria Sea Freight',
    origin: 'China',
    destination: 'Algeria',
    method: 'Sea Freight',
    rate: 2.80,
    rateUnit: 'KG',
    minimumCharge: 5,
    notes: 'Economy sea shipping (30-45 days)',
  },
]

// ============================================================
// Users
// ============================================================

export const mockUsers: User[] = [
  { id: 'u1', name: 'Youssef', email: 'youssef@foxbox.dz', role: 'ADMIN', isActive: true, createdAt: new Date('2024-01-01') },
  { id: 'u2', name: 'Ahmed', email: 'ahmed@foxbox.dz', role: 'PRODUCT_RESEARCH', isActive: true, createdAt: new Date('2024-01-01') },
  { id: 'u3', name: 'Sara', email: 'sara@foxbox.dz', role: 'MARKETING', isActive: true, createdAt: new Date('2024-01-15') },
  { id: 'u4', name: 'Karim', email: 'karim@foxbox.dz', role: 'OPERATIONS', isActive: true, createdAt: new Date('2024-02-01') },
  { id: 'u5', name: 'Meriem', email: 'meriem@foxbox.dz', role: 'FINANCE', isActive: true, createdAt: new Date('2024-02-15') },
]

export const currentUser = mockUsers[0]

// ============================================================
// Products
// ============================================================

export const mockProducts: Product[] = [
  {
    id: '1',
    name: 'LED Ring Light with Tripod',
    sourceUrl: 'https://detail.1688.com/offer/1077486081466.html',
    sourcePlatform: '1688',
    sourceProductId: '1077486081466',
    description: 'Professional LED ring light for photography and video',
    category: 'Electronics',
    status: 'TESTING',
    score: 85,
    imageUrl: 'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=400',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-02-01'),
    lastAnalyzedAt: new Date('2024-01-15'),
    isWinner: false,
    fields: [
      { fieldName: 'weight', sourceValue: '180g', currentValue: '180g', sourceType: 'AUTO' },
      { fieldName: 'dimensions', sourceValue: '30x30x10cm', currentValue: '30x30x10cm', sourceType: 'AUTO' },
    ],
    variants: [
      { id: 'v1', name: '10 inch', priceRmb: 22, stock: 500 },
      { id: 'v2', name: '12 inch', priceRmb: 28, stock: 300 },
    ],
    creatives: [],
    links: [
      { id: 'l1', title: '1688 Product', url: 'https://detail.1688.com/offer/1077486081466.html', category: 'MARKETPLACE', createdBy: 'u2', createdAt: new Date('2024-01-15') },
    ],
    supplier: {
      id: 's1',
      name: 'Shenzhen LED Tech Co.',
      platform: '1688',
      url: 'https://shop1688.com/supplier/123',
      rating: 4.8,
    },
    shippingProfile: shippingProfiles[0],
    costScenario: {
      id: 'c1',
      productId: '1',
      quantity: 100,
      purchaseCostRmb: 2200,
      shippingCostUsd: 169.20,
      otherCostUsd: 20,
      landedCostUsd: 519.20,
      landedCostDzd: 134992,
    },
    codScenario: {
      id: 'cod1',
      productId: '1',
      sellingPriceDzd: 4500,
      deliveryFeeDzd: 600,
      advertisingCpaDzd: 700,
      confirmationCostDzd: 200,
      confirmationRate: 0.80,
      deliveryRate: 0.75,
      returnRate: 0.25,
      returnCostDzd: 400,
      otherCostDzd: 100,
    },
    offers: [
      { id: 'o1', productId: '1', name: 'Single Unit', quantity: 1, sellingPriceDzd: 4500 },
      { id: 'o2', productId: '1', name: 'Double Pack', quantity: 2, sellingPriceDzd: 7500 },
    ],
    tests: [],
    decisionHistory: [
      {
        id: 'd1',
        productId: '1',
        oldStatus: 'RESEARCH',
        newStatus: 'TESTING',
        reason: 'Good margins, lightweight product',
        createdAt: new Date('2024-01-20'),
        createdBy: 'Youssef',
      },
    ],
  },
  {
    id: '2',
    name: 'Wireless Bluetooth Earbuds',
    sourceUrl: 'https://detail.1688.com/offer/1088765432100.html',
    sourcePlatform: '1688',
    sourceProductId: '1088765432100',
    description: 'TWS wireless earbuds with noise cancellation',
    category: 'Electronics',
    status: 'APPROVED',
    score: 78,
    imageUrl: 'https://images.unsplash.com/photo-1590658268037-6bf12f032f55?w=400',
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-25'),
    lastAnalyzedAt: new Date('2024-01-10'),
    isWinner: true,
    fields: [
      { fieldName: 'weight', sourceValue: '45g', currentValue: '45g', sourceType: 'AUTO' },
    ],
    variants: [
      { id: 'v3', name: 'Black', priceRmb: 35, stock: 1000 },
      { id: 'v4', name: 'White', priceRmb: 35, stock: 800 },
    ],
    creatives: [],
    links: [],
    costScenario: {
      id: 'c2',
      productId: '2',
      quantity: 200,
      purchaseCostRmb: 7000,
      shippingCostUsd: 84.60,
      otherCostUsd: 30,
      landedCostUsd: 1164.60,
      landedCostDzd: 302796,
    },
    codScenario: {
      id: 'cod2',
      productId: '2',
      sellingPriceDzd: 3500,
      deliveryFeeDzd: 500,
      advertisingCpaDzd: 600,
      confirmationCostDzd: 150,
      confirmationRate: 0.75,
      deliveryRate: 0.80,
      returnRate: 0.20,
      returnCostDzd: 350,
      otherCostDzd: 80,
    },
    offers: [],
    tests: [],
    decisionHistory: [],
  },
  {
    id: '3',
    name: 'Silicone Kitchen Utensil Set',
    sourceUrl: 'https://detail.1688.com/offer/1099876543210.html',
    sourcePlatform: '1688',
    sourceProductId: '1099876543210',
    category: 'Home & Kitchen',
    status: 'STANDBY',
    score: 62,
    imageUrl: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400',
    createdAt: new Date('2024-01-05'),
    updatedAt: new Date('2024-01-18'),
    isWinner: false,
    fields: [
      { fieldName: 'weight', sourceValue: '800g', currentValue: '800g', sourceType: 'AUTO' },
    ],
    variants: [],
    creatives: [],
    links: [],
    costScenario: {
      id: 'c3',
      productId: '3',
      quantity: 50,
      purchaseCostRmb: 750,
      shippingCostUsd: 37.60,
      otherCostUsd: 15,
      landedCostUsd: 165.10,
      landedCostDzd: 42926,
    },
    codScenario: {
      id: 'cod3',
      productId: '3',
      sellingPriceDzd: 2500,
      deliveryFeeDzd: 400,
      advertisingCpaDzd: 500,
      confirmationCostDzd: 100,
      confirmationRate: 0.85,
      deliveryRate: 0.90,
      returnRate: 0.10,
      returnCostDzd: 300,
      otherCostDzd: 50,
    },
    offers: [],
    tests: [],
    decisionHistory: [],
  },
  {
    id: '4',
    name: 'Portable Phone Stand Holder',
    sourceUrl: 'https://detail.1688.com/offer/1100987654321.html',
    sourcePlatform: '1688',
    sourceProductId: '1100987654321',
    category: 'Accessories',
    status: 'REJECTED',
    score: 45,
    imageUrl: 'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=400',
    createdAt: new Date('2024-01-02'),
    updatedAt: new Date('2024-01-12'),
    isWinner: false,
    fields: [],
    variants: [],
    creatives: [],
    links: [],
    costScenario: {
      id: 'c4',
      productId: '4',
      quantity: 100,
      purchaseCostRmb: 500,
      shippingCostUsd: 18.80,
      otherCostUsd: 10,
      landedCostUsd: 103.80,
      landedCostDzd: 26988,
    },
    codScenario: {
      id: 'cod4',
      productId: '4',
      sellingPriceDzd: 1500,
      deliveryFeeDzd: 350,
      advertisingCpaDzd: 600,
      confirmationCostDzd: 100,
      confirmationRate: 0.70,
      deliveryRate: 0.75,
      returnRate: 0.30,
      returnCostDzd: 250,
      otherCostDzd: 50,
    },
    offers: [],
    tests: [],
    decisionHistory: [
      {
        id: 'd2',
        productId: '4',
        oldStatus: 'TESTING',
        newStatus: 'REJECTED',
        reason: 'Low margins, high return rate',
        createdAt: new Date('2024-01-12'),
        createdBy: 'Youssef',
      },
    ],
  },
]

export const getDashboardStats = (products: Product[]): DashboardStats => {
  const testing = products.filter(p => p.status === 'TESTING')
  const approved = products.filter(p => p.status === 'APPROVED')
  const scaling = products.filter(p => p.status === 'SCALING')

  const potentialProfit = [...testing, ...approved, ...scaling].reduce((sum, p) => {
    if (p.codScenario && p.costScenario) {
      const margin = p.codScenario.sellingPriceDzd - (p.costScenario.landedCostDzd / p.costScenario.quantity)
      return sum + (margin * 0.7 * p.costScenario.quantity)
    }
    return sum
  }, 0)

  const totalInvested = products.reduce((sum, p) => {
    if (p.costScenario) return sum + p.costScenario.landedCostDzd
    return sum
  }, 0)

  return {
    totalProducts: products.length,
    testing: testing.length,
    approved: approved.length,
    standby: products.filter(p => p.status === 'STANDBY').length,
    rejected: products.filter(p => p.status === 'REJECTED').length,
    scaling: scaling.length,
    potentialProfit,
    totalInvested,
    activeTests: testing.length,
  }
}

// ============================================================
// Tasks
// ============================================================

export const mockTasks: Task[] = [
  {
    id: 't1',
    title: 'Contact supplier for Earbuds',
    description: 'Reach out to Shenzhen supplier about bulk pricing for 500 units.',
    assigneeId: 'u2',
    creatorId: 'u1',
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    dueDate: new Date('2024-03-10'),
    tags: ['supplier', 'earbuds'],
    productId: '2',
    attachments: [],
    comments: [
      { id: 'tc1', taskId: 't1', userId: 'u2', content: 'Sent email, waiting for reply.', createdAt: new Date('2024-03-05') },
    ],
    activity: [
      { id: 'ta1', taskId: 't1', userId: 'u1', action: 'created task', createdAt: new Date('2024-03-01') },
      { id: 'ta2', taskId: 't1', userId: 'u2', action: 'started working', createdAt: new Date('2024-03-02') },
    ],
    createdAt: new Date('2024-03-01'),
    updatedAt: new Date('2024-03-05'),
  },
  {
    id: 't2',
    title: 'Create ad creative for Ring Light',
    description: 'Design 3 variations of video ads for the LED Ring Light test.',
    assigneeId: 'u3',
    creatorId: 'u1',
    priority: 'MEDIUM',
    status: 'TODO',
    dueDate: new Date('2024-03-15'),
    tags: ['creative', 'ring-light'],
    productId: '1',
    attachments: [],
    comments: [],
    activity: [
      { id: 'ta3', taskId: 't2', userId: 'u1', action: 'created task', createdAt: new Date('2024-03-02') },
    ],
    createdAt: new Date('2024-03-02'),
    updatedAt: new Date('2024-03-02'),
  },
  {
    id: 't3',
    title: 'Review delivery rates for Yalidine',
    description: 'Analyze last 30 days delivery performance by wilaya.',
    assigneeId: 'u4',
    creatorId: 'u1',
    priority: 'MEDIUM',
    status: 'REVIEW',
    dueDate: new Date('2024-03-12'),
    tags: ['delivery', 'analysis'],
    attachments: [],
    comments: [
      { id: 'tc2', taskId: 't3', userId: 'u4', content: 'Report ready for review.', createdAt: new Date('2024-03-08') },
    ],
    activity: [],
    createdAt: new Date('2024-03-05'),
    updatedAt: new Date('2024-03-08'),
  },
  {
    id: 't4',
    title: 'Update currency rates',
    description: 'Check and update RMB/USD and USD/DZD exchange rates.',
    assigneeId: 'u5',
    creatorId: 'u1',
    priority: 'LOW',
    status: 'DONE',
    dueDate: new Date('2024-03-08'),
    tags: ['finance'],
    attachments: [],
    comments: [],
    activity: [],
    createdAt: new Date('2024-03-06'),
    updatedAt: new Date('2024-03-08'),
  },
]

// ============================================================
// Posts (Team Hub)
// ============================================================

export const mockPosts: Post[] = [
  {
    id: 'p1',
    userId: 'u2',
    type: 'WINNING_PRODUCT',
    title: 'Wireless Earbuds confirmed as winner',
    content: 'After 2 weeks of testing, the wireless earbuds show consistent 35%+ margins with 80% confirmation rate. Ready for scaling.',
    productId: '2',
    reactions: [{ emoji: '🔥', users: ['u1', 'u3', 'u4'] }, { emoji: '🎯', users: ['u1'] }],
    comments: [
      { id: 'pc1', postId: 'p1', userId: 'u1', content: 'Excellent results. Let\'s increase ad budget.', mentions: [], createdAt: new Date('2024-02-28') },
      { id: 'pc2', postId: 'p1', userId: 'u3', content: 'I\'ll prepare new creatives for scaling.', mentions: [], createdAt: new Date('2024-02-28') },
    ],
    bookmarks: ['u1', 'u4'],
    createdAt: new Date('2024-02-27'),
  },
  {
    id: 'p2',
    userId: 'u1',
    type: 'ANNOUNCEMENT',
    title: 'New supplier partnership',
    content: 'We have secured a direct partnership with Shenzhen LED Tech Co. This gives us priority access and better pricing.',
    reactions: [{ emoji: '👏', users: ['u2', 'u3', 'u4', 'u5'] }],
    comments: [],
    bookmarks: [],
    createdAt: new Date('2024-02-20'),
  },
  {
    id: 'p3',
    userId: 'u3',
    type: 'CREATIVE',
    title: 'New TikTok ad angle for kitchen utensils',
    content: 'Testing a "morning routine" angle instead of the cooking demo. Initial CTR is 2.8% vs 1.9% on the old creative.',
    productId: '3',
    reactions: [{ emoji: '💡', users: ['u1', 'u2'] }],
    comments: [
      { id: 'pc3', postId: 'p3', userId: 'u2', content: 'Great insight. The lifestyle angle works better.', mentions: [], createdAt: new Date('2024-02-18') },
    ],
    bookmarks: [],
    createdAt: new Date('2024-02-17'),
  },
]

// ============================================================
// Discussions
// ============================================================

export const mockChannels: DiscussionChannel[] = [
  { id: 'ch1', name: 'general', description: 'Team announcements and general discussion', icon: 'Hash', unreadCount: 3, isProductLinked: false },
  { id: 'ch2', name: 'product-research', description: 'Product ideas and analysis', icon: 'Search', unreadCount: 1, isProductLinked: false },
  { id: 'ch3', name: 'winning-products', description: 'Celebrate and discuss winning products', icon: 'Trophy', unreadCount: 0, isProductLinked: false },
  { id: 'ch4', name: 'marketing', description: 'Marketing strategies and campaigns', icon: 'Megaphone', unreadCount: 2, isProductLinked: false },
  { id: 'ch5', name: 'creatives', description: 'Ad creatives and design discussion', icon: 'Palette', unreadCount: 0, isProductLinked: false },
  { id: 'ch6', name: 'suppliers', description: 'Supplier communication and updates', icon: 'Truck', unreadCount: 0, isProductLinked: false },
  { id: 'ch7', name: 'operations', description: 'Orders, delivery, and logistics', icon: 'Package', unreadCount: 5, isProductLinked: false },
  { id: 'ch8', name: 'announcements', description: 'Important team announcements', icon: 'Bell', unreadCount: 1, isProductLinked: false },
]

export const mockMessages: DiscussionMessage[] = [
  { id: 'm1', channelId: 'ch1', userId: 'u1', content: 'Team, we need to focus on scaling earbuds this week.', mentions: [], createdAt: new Date('2024-03-01T09:00:00') },
  { id: 'm2', channelId: 'ch1', userId: 'u2', content: 'Already on it. Supplier confirmed stock availability.', mentions: [], createdAt: new Date('2024-03-01T09:15:00') },
  { id: 'm3', channelId: 'ch1', userId: 'u3', content: 'New creatives ready for review. Will upload today.', mentions: [], createdAt: new Date('2024-03-01T09:30:00') },
  { id: 'm4', channelId: 'ch7', userId: 'u4', content: 'Yalidine delivery rates dropped in Algiers. Need to investigate.', mentions: ['u1'], createdAt: new Date('2024-03-01T10:00:00') },
  { id: 'm5', channelId: 'ch7', userId: 'u1', content: '@Karim Can you pull the data for last 7 days?', mentions: ['u4'], createdAt: new Date('2024-03-01T10:05:00') },
]

// ============================================================
// Files
// ============================================================

export const mockFiles: VaultFile[] = [
  { id: 'f1', name: 'ring-light-ad-v1.mp4', originalName: 'ring-light-ad-v1.mp4', mimeType: 'video/mp4', size: 15728640, url: '#', folder: 'CREATIVES', tags: ['ring-light', 'video'], productId: '1', uploadedBy: 'u3', createdAt: new Date('2024-02-15') },
  { id: 'f2', name: 'earbuds-product-photo.jpg', originalName: 'earbuds-product-photo.jpg', mimeType: 'image/jpeg', size: 2048000, url: '#', folder: 'PRODUCTS', tags: ['earbuds', 'photo'], productId: '2', uploadedBy: 'u2', createdAt: new Date('2024-02-10') },
  { id: 'f3', name: 'supplier-contract.pdf', originalName: 'supplier-contract.pdf', mimeType: 'application/pdf', size: 512000, url: '#', folder: 'SUPPLIERS', tags: ['contract', 'LED-tech'], uploadedBy: 'u1', createdAt: new Date('2024-01-20') },
  { id: 'f4', name: 'monthly-report-feb.xlsx', originalName: 'monthly-report-feb.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 256000, url: '#', folder: 'DOCUMENTS', tags: ['report', 'february'], uploadedBy: 'u5', createdAt: new Date('2024-03-01') },
]

// ============================================================
// Creatives
// ============================================================

export const mockCreatives: Creative[] = [
  {
    id: 'cr1',
    productId: '1',
    name: 'Ring Light - Lifestyle Hook',
    hook: 'Every content creator needs this',
    angle: 'Lifestyle / Aspiration',
    platform: 'META',
    type: 'video',
    status: 'TESTING',
    fileUrl: '#',
    performance: { impressions: 45000, clicks: 1800, ctr: 4.0, cpc: 0.35, cpa: 850, roas: 3.2, orders: 28, revenue: 126000 },
    isWinner: false,
    createdBy: 'u3',
    createdAt: new Date('2024-02-20'),
    updatedAt: new Date('2024-03-01'),
  },
  {
    id: 'cr2',
    productId: '2',
    name: 'Earbuds - Problem Solution',
    hook: 'Tired of wired earbuds?',
    angle: 'Problem/Solution',
    platform: 'TIKTOK',
    type: 'video',
    status: 'WINNER',
    fileUrl: '#',
    performance: { impressions: 120000, clicks: 6000, ctr: 5.0, cpc: 0.25, cpa: 550, roas: 4.8, orders: 85, revenue: 297500 },
    isWinner: true,
    createdBy: 'u3',
    createdAt: new Date('2024-02-15'),
    updatedAt: new Date('2024-03-01'),
  },
]

// ============================================================
// Orders
// ============================================================

export const mockOrders: Order[] = [
  {
    id: 'ord1',
    orderNumber: 'FOX-2024-001',
    customer: { id: 'c1', name: 'Mohamed Benali', phone: '0555123456', wilaya: 'Alger', commune: 'Bab Ezzouar', address: 'Rue 15, Lot 42', deliveryType: 'HOME' },
    productId: '2',
    quantity: 1,
    sellingPriceDzd: 3500,
    deliveryFeeDzd: 500,
    paymentMethod: 'COD',
    carrierId: 'yal1',
    trackingNumber: 'YAL-789456123',
    status: 'DELIVERED',
    confirmationStatus: 'CONFIRMED',
    confirmedAt: new Date('2024-03-02'),
    shippedAt: new Date('2024-03-03'),
    deliveredAt: new Date('2024-03-05'),
    createdBy: 'u4',
    createdAt: new Date('2024-03-01'),
    updatedAt: new Date('2024-03-05'),
  },
  {
    id: 'ord2',
    orderNumber: 'FOX-2024-002',
    customer: { id: 'c2', name: 'Amina Khelifi', phone: '0661234567', wilaya: 'Oran', commune: 'Es Senia', address: 'Cite 1000 logements', deliveryType: 'HOME' },
    productId: '1',
    quantity: 2,
    sellingPriceDzd: 7500,
    deliveryFeeDzd: 600,
    paymentMethod: 'COD',
    carrierId: 'yal1',
    trackingNumber: 'YAL-789456124',
    status: 'IN_TRANSIT',
    confirmationStatus: 'CONFIRMED',
    confirmedAt: new Date('2024-03-03'),
    shippedAt: new Date('2024-03-04'),
    createdBy: 'u4',
    createdAt: new Date('2024-03-02'),
    updatedAt: new Date('2024-03-04'),
  },
  {
    id: 'ord3',
    orderNumber: 'FOX-2024-003',
    customer: { id: 'c3', name: 'Youcef Hamidi', phone: '0770123456', wilaya: 'Constantine', commune: 'El Khroub', address: 'Zone industrielle', deliveryType: 'STOP_DESK' },
    productId: '2',
    quantity: 1,
    sellingPriceDzd: 3500,
    deliveryFeeDzd: 400,
    paymentMethod: 'COD',
    carrierId: 'ecom1',
    status: 'CONFIRMED',
    confirmationStatus: 'CONFIRMED',
    confirmedAt: new Date('2024-03-04'),
    createdBy: 'u4',
    createdAt: new Date('2024-03-03'),
    updatedAt: new Date('2024-03-04'),
  },
  {
    id: 'ord4',
    orderNumber: 'FOX-2024-004',
    customer: { id: 'c4', name: 'Fatima Zeroual', phone: '0550987654', wilaya: 'Setif', commune: 'Ain Oulmene', address: 'Cite Benyahia', deliveryType: 'HOME' },
    productId: '2',
    quantity: 1,
    sellingPriceDzd: 3500,
    deliveryFeeDzd: 500,
    paymentMethod: 'COD',
    status: 'RETURNED',
    confirmationStatus: 'CONFIRMED',
    confirmedAt: new Date('2024-02-28'),
    shippedAt: new Date('2024-03-01'),
    deliveredAt: new Date('2024-03-03'),
    returnedAt: new Date('2024-03-05'),
    notes: 'Customer refused delivery',
    createdBy: 'u4',
    createdAt: new Date('2024-02-27'),
    updatedAt: new Date('2024-03-05'),
  },
]

// ============================================================
// Delivery
// ============================================================

export const mockDeliveryProviders: DeliveryProvider[] = [
  { id: 'yal1', name: 'Yalidine', code: 'YAL', trackingUrl: 'https://yalidine.dz/track', services: ['HOME_DELIVERY', 'STOP_DESK'], isActive: true },
  { id: 'ecom1', name: 'E-Com Express', code: 'ECO', trackingUrl: 'https://ecom-express.dz/track', services: ['HOME_DELIVERY'], isActive: true },
  { id: 'zr1', name: 'ZR Express', code: 'ZRE', services: ['HOME_DELIVERY', 'STOP_DESK', 'EXPRESS'], isActive: true },
  { id: 'noest1', name: 'NOEST', code: 'NOS', services: ['HOME_DELIVERY', 'STOP_DESK'], isActive: true },
]

export const mockShipments: Shipment[] = [
  { id: 'sh1', orderId: 'ord1', providerId: 'yal1', trackingNumber: 'YAL-789456123', serviceType: 'HOME_DELIVERY', status: 'DELIVERED', shippedAt: new Date('2024-03-03'), deliveredAt: new Date('2024-03-05'), cost: 600, createdAt: new Date('2024-03-03'), updatedAt: new Date('2024-03-05') },
  { id: 'sh2', orderId: 'ord2', providerId: 'yal1', trackingNumber: 'YAL-789456124', serviceType: 'HOME_DELIVERY', status: 'IN_TRANSIT', shippedAt: new Date('2024-03-04'), estimatedDelivery: new Date('2024-03-07'), cost: 600, createdAt: new Date('2024-03-04'), updatedAt: new Date('2024-03-04') },
]

// ============================================================
// Wilayas (48 historical + new expansions)
// ============================================================

export const mockWilayas: Wilaya[] = [
  { id: 'w01', code: '01', name: 'Adrar', communes: [{ id: 'com01', name: 'Adrar', wilayaId: 'w01' }] },
  { id: 'w02', code: '02', name: 'Chlef', communes: [{ id: 'com02', name: 'Chlef', wilayaId: 'w02' }] },
  { id: 'w03', code: '03', name: 'Laghouat', communes: [{ id: 'com03', name: 'Laghouat', wilayaId: 'w03' }] },
  { id: 'w04', code: '04', name: 'Oum El Bouaghi', communes: [{ id: 'com04', name: 'Oum El Bouaghi', wilayaId: 'w04' }] },
  { id: 'w05', code: '05', name: 'Batna', communes: [{ id: 'com05', name: 'Batna', wilayaId: 'w05' }] },
  { id: 'w06', code: '06', name: 'Bejaia', communes: [{ id: 'com06', name: 'Bejaia', wilayaId: 'w06' }] },
  { id: 'w07', code: '07', name: 'Biskra', communes: [{ id: 'com07', name: 'Biskra', wilayaId: 'w07' }] },
  { id: 'w08', code: '08', name: 'Bechar', communes: [{ id: 'com08', name: 'Bechar', wilayaId: 'w08' }] },
  { id: 'w09', code: '09', name: 'Blida', communes: [{ id: 'com09', name: 'Blida', wilayaId: 'w09' }] },
  { id: 'w10', code: '10', name: 'Bouira', communes: [{ id: 'com10', name: 'Bouira', wilayaId: 'w10' }] },
  { id: 'w16', code: '16', name: 'Alger', communes: [
    { id: 'com16a', name: 'Bab Ezzouar', wilayaId: 'w16' },
    { id: 'com16b', name: 'Hussein Dey', wilayaId: 'w16' },
    { id: 'com16c', name: 'Kouba', wilayaId: 'w16' },
    { id: 'com16d', name: 'Bir Mourad Rais', wilayaId: 'w16' },
    { id: 'com16e', name: 'El Biar', wilayaId: 'w16' },
  ] },
  { id: 'w19', code: '19', name: 'Setif', communes: [
    { id: 'com19a', name: 'Setif', wilayaId: 'w19' },
    { id: 'com19b', name: 'Ain Oulmene', wilayaId: 'w19' },
  ] },
  { id: 'w21', code: '21', name: 'Blida', communes: [{ id: 'com21', name: 'Blida', wilayaId: 'w21' }] },
  { id: 'w25', code: '25', name: 'Constantine', communes: [
    { id: 'com25a', name: 'Constantine', wilayaId: 'w25' },
    { id: 'com25b', name: 'El Khroub', wilayaId: 'w25' },
  ] },
  { id: 'w31', code: '31', name: 'Oran', communes: [
    { id: 'com31a', name: 'Oran', wilayaId: 'w31' },
    { id: 'com31b', name: 'Es Senia', wilayaId: 'w31' },
    { id: 'com31c', name: 'Bir El Djir', wilayaId: 'w31' },
  ] },
]

// ============================================================
// Finance
// ============================================================

export const mockExpenses: Expense[] = [
  { id: 'e1', category: 'PRODUCT', description: 'LED Ring Light - 100 units', amountDzd: 572000, productId: '1', createdBy: 'u1', createdAt: new Date('2024-02-01') },
  { id: 'e2', category: 'SHIPPING', description: 'Air cargo - Ring Light batch', amountDzd: 43992, productId: '1', createdBy: 'u4', createdAt: new Date('2024-02-05') },
  { id: 'e3', category: 'ADVERTISING', description: 'Meta Ads - Ring Light test', amountDzd: 98000, productId: '1', createdBy: 'u3', createdAt: new Date('2024-02-10') },
  { id: 'e4', category: 'PRODUCT', description: 'Earbuds - 200 units', amountDzd: 1820000, productId: '2', createdBy: 'u1', createdAt: new Date('2024-01-20') },
  { id: 'e5', category: 'ADVERTISING', description: 'TikTok Ads - Earbuds test', amountDzd: 150000, productId: '2', createdBy: 'u3', createdAt: new Date('2024-01-25') },
  { id: 'e6', category: 'DELIVERY', description: 'Yalidine - March deliveries', amountDzd: 35000, createdBy: 'u4', createdAt: new Date('2024-03-01') },
  { id: 'e7', category: 'TOOLS', description: 'Foxbox Team OS subscription', amountDzd: 15000, createdBy: 'u1', createdAt: new Date('2024-03-01') },
]

export const mockRevenues: Revenue[] = [
  { id: 'rev1', source: 'ORDER', amountDzd: 4000, orderId: 'ord1', productId: '2', createdAt: new Date('2024-03-05') },
  { id: 'rev2', source: 'ORDER', amountDzd: 8100, orderId: 'ord2', productId: '1', createdAt: new Date('2024-03-04') },
]

// ============================================================
// Notifications
// ============================================================

export const mockNotifications: Notification[] = [
  { id: 'n1', type: 'TASK_ASSIGNED', title: 'Task assigned', message: 'You were assigned "Contact supplier for Earbuds"', link: '/app/tasks', isRead: false, userId: 'u1', createdAt: new Date('2024-03-01') },
  { id: 'n2', type: 'PRODUCT_STATUS_CHANGED', title: 'Product updated', message: 'LED Ring Light moved to TESTING', link: '/app/research/1', isRead: false, userId: 'u1', createdAt: new Date('2024-01-20') },
  { id: 'n3', type: 'ORDER_RECEIVED', title: 'New order', message: 'Order FOX-2024-001 received from Mohamed Benali', link: '/app/orders', isRead: true, userId: 'u1', createdAt: new Date('2024-03-01') },
  { id: 'n4', type: 'CREATIVE_WINNER', title: 'Winner creative', message: 'Earbuds - Problem Solution marked as winner', link: '/app/creative', isRead: false, userId: 'u1', createdAt: new Date('2024-03-01') },
  { id: 'n5', type: 'MENTION', title: 'You were mentioned', message: '@Youssef mentioned you in #operations', link: '/app/discussions', isRead: false, userId: 'u1', createdAt: new Date('2024-03-01') },
]

// ============================================================
// Activity Log
// ============================================================

export const mockActivityLog: ActivityLog[] = [
  { id: 'al1', action: 'PRODUCT_CREATED', userId: 'u2', entityType: 'PRODUCT', entityId: '1', entityName: 'LED Ring Light', createdAt: new Date('2024-01-15') },
  { id: 'al2', action: 'STATUS_CHANGED', userId: 'u1', entityType: 'PRODUCT', entityId: '1', entityName: 'LED Ring Light', details: 'RESEARCH → TESTING', createdAt: new Date('2024-01-20') },
  { id: 'al3', action: 'CREATIVE_ADDED', userId: 'u3', entityType: 'CREATIVE', entityId: 'cr1', entityName: 'Ring Light - Lifestyle Hook', createdAt: new Date('2024-02-20') },
  { id: 'al4', action: 'ORDER_CREATED', userId: 'u4', entityType: 'ORDER', entityId: 'ord1', entityName: 'FOX-2024-001', createdAt: new Date('2024-03-01') },
  { id: 'al5', action: 'CREATIVE_WINNER', userId: 'u3', entityType: 'CREATIVE', entityId: 'cr2', entityName: 'Earbuds - Problem Solution', createdAt: new Date('2024-03-01') },
  { id: 'al6', action: 'TASK_COMPLETED', userId: 'u5', entityType: 'TASK', entityId: 't4', entityName: 'Update currency rates', createdAt: new Date('2024-03-08') },
]
