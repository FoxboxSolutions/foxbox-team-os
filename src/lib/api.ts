import type {
  AuthUser, AuthRole, VaultFile,
  DiscussionChannel, DiscussionMessage,
  Task,
  Post, Product, SellingProduct,
  Order, DeliveryProvider, Shipment,
  Wilaya, Expense, Revenue,
  Notification, Confirmation,
  EcomDelivery,
  YouCanOrder, YouCanOrdersKpis, Creative,
  ActivityLog,
} from '@/types';

const API_BASE = import.meta.env.VITE_API_URL || 'https://foxbox-api.foxboxsolutions01.workers.dev/api';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('foxbox_jwt_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data.data ?? data;
}

// Backend file rows are camelCase; normalize defensively for UI safety.
function normalizeServerFile(r: Record<string, unknown>): VaultFile {
  const tags = Array.isArray(r.tags) ? (r.tags as unknown[]).filter((t): t is string => typeof t === 'string') : [];
  return {
    id: String(r.id ?? ''),
    name: String(r.name ?? r.originalName ?? 'file'),
    originalName: String(r.originalName ?? r.name ?? 'file'),
    mimeType: String(r.mimeType ?? 'application/octet-stream'),
    size: Number(r.size ?? 0),
    url: String(r.url ?? ''),
    thumbnailUrl: (r.thumbnailUrl as string | undefined) ?? undefined,
    folder: (r.folder as VaultFile['folder']) ?? 'DOCUMENTS',
    tags,
    productId: (r.productId as string | undefined) ?? undefined,
    uploadedBy: String(r.uploadedBy ?? 'unknown'),
    createdAt: r.createdAt ? new Date(r.createdAt as string) : new Date(),
    category: (r.category as VaultFile['category']) ?? undefined,
    source: (r.source as VaultFile['source']) ?? undefined,
  };
}

// Backend historically returned snake_case (full_name, created_at...).
// Normalize defensively so UI never crashes on undefined fullName.
function normalizeAuthUser(u: Record<string, unknown>): AuthUser {
  const r = u as Record<string, unknown> & AuthUser;
  return {
    ...r,
    fullName: (r.fullName ?? u['full_name'] ?? '') as string,
    requestedRole: (r.requestedRole ?? u['requested_role'] ?? 'mediabuyer') as AuthRole,
    authProvider: (r.authProvider ?? u['auth_provider'] ?? 'email') as AuthUser['authProvider'],
    googleId: (r.googleId ?? u['google_id'] ?? undefined) as string | undefined,
    createdAt: (r.createdAt ?? u['created_at'] ?? new Date().toISOString()) as unknown as Date,
    updatedAt: (r.updatedAt ?? u['updated_at'] ?? new Date().toISOString()) as unknown as Date,
    approvedAt: (r.approvedAt ?? u['approved_at'] ?? undefined) as Date | undefined,
    lastLoginAt: (r.lastLoginAt ?? u['last_login_at'] ?? undefined) as Date | undefined,
  };
}

export const api = {
  // ─── AUTH ──────────────────────────────────────────────────
  async register(data: { fullName: string; email: string; password: string; requestedRole: AuthRole }) {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<{ token: string; user: { id: string; fullName: string; email: string; role: AuthRole; status: string } }>(res);
  },

  async login(email: string, password: string) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return handleResponse<{ token: string; user: { id: string; fullName: string; email: string; role: AuthRole; status: string } }>(res);
  },

  async logout() {
    const res = await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async getMe() {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getAuthHeaders(),
    });
    const user = await handleResponse<AuthUser>(res);
    return normalizeAuthUser(user as unknown as Record<string, unknown>);
  },

  async updateProfile(data: { fullName?: string; avatar?: string | null }) {
    const res = await fetch(`${API_BASE}/auth/me`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    const user = await handleResponse<AuthUser>(res);
    return normalizeAuthUser(user as unknown as Record<string, unknown>);
  },

  async changePassword(currentPassword: string, newPassword: string) {
    const res = await fetch(`${API_BASE}/auth/change-password`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    return handleResponse(res);
  },

  async requestPasswordReset(email: string) {
    const res = await fetch(`${API_BASE}/auth/request-password-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    return handleResponse(res);
  },

  async resetPassword(token: string, newPassword: string) {
    const res = await fetch(`${API_BASE}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword }),
    });
    return handleResponse(res);
  },

  // Google OAuth
  async googleLogin() {
    const res = await fetch(`${API_BASE}/auth/google`);
    return handleResponse<{ url: string }>(res);
  },

  // ─── ADMIN USERS ───────────────────────────────────────────
  async getUsers() {
    const res = await fetch(`${API_BASE}/auth/users`, {
      headers: getAuthHeaders(),
    });
    const users = await handleResponse<AuthUser[]>(res);
    return (Array.isArray(users) ? users : []).map(u => normalizeAuthUser(u as unknown as Record<string, unknown>));
  },

  async getUser(id: string) {
    const res = await fetch(`${API_BASE}/auth/users/${id}`, {
      headers: getAuthHeaders(),
    });
    const user = await handleResponse<AuthUser>(res);
    return normalizeAuthUser(user as unknown as Record<string, unknown>);
  },

  async updateUser(id: string, data: { role?: AuthRole; fullName?: string }) {
    const res = await fetch(`${API_BASE}/auth/users/${id}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async approveUser(id: string) {
    const res = await fetch(`${API_BASE}/auth/users/${id}/approve`, {
      method: 'PUT',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async rejectUser(id: string, notes?: string) {
    const res = await fetch(`${API_BASE}/auth/users/${id}/reject`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ notes }),
    });
    return handleResponse(res);
  },

  async blockUser(id: string) {
    const res = await fetch(`${API_BASE}/auth/users/${id}/block`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async unblockUser(id: string) {
    const res = await fetch(`${API_BASE}/auth/users/${id}/unblock`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async banUser(id: string) {
    const res = await fetch(`${API_BASE}/auth/users/${id}/ban`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async unbanUser(id: string) {
    const res = await fetch(`${API_BASE}/auth/users/${id}/unban`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async deleteUser(id: string) {
    const res = await fetch(`${API_BASE}/auth/users/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  // ─── DISCUSSIONS ───────────────────────────────────────────
  async getChannels() {
    const res = await fetch(`${API_BASE}/channels`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<DiscussionChannel[]>(res);
  },

  async createChannel(data: { name: string; description?: string; icon?: string; isProductLinked?: boolean; productId?: string }) {
    const res = await fetch(`${API_BASE}/channels`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<{ id: string }>(res);
  },

  async getMessages(channelId: string) {
    const res = await fetch(`${API_BASE}/channels/${channelId}/messages`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<DiscussionMessage[]>(res);
  },

  async createMessage(channelId: string, data: { content: string; mentions?: string[]; repliesTo?: string }) {
    const res = await fetch(`${API_BASE}/channels/${channelId}/messages`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<{ id: string }>(res);
  },

  // ─── TASKS ─────────────────────────────────────────────────
  async getTasks(params?: { status?: string; assignee?: string }) {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    const res = await fetch(`${API_BASE}/tasks?${qs}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<Task[]>(res);
  },

  async createTask(data: { title: string; description?: string; assigneeId: string; priority?: string; status?: string; dueDate?: string; tags?: string[]; productId?: string }) {
    const res = await fetch(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<{ id: string }>(res);
  },

  async updateTask(id: string, data: Partial<Task>) {
    const res = await fetch(`${API_BASE}/tasks/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async deleteTask(id: string) {
    const res = await fetch(`${API_BASE}/tasks/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  // ─── POSTS ─────────────────────────────────────────────────
  async getPosts() {
    const res = await fetch(`${API_BASE}/posts`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<Post[]>(res);
  },

  async createPost(data: { type?: string; title: string; content: string; images?: string[]; links?: string[]; productId?: string; taskId?: string }) {
    const res = await fetch(`${API_BASE}/posts`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<{ id: string }>(res);
  },

  // ─── PRODUCTS ──────────────────────────────────────────────
  async getProducts() {
    const res = await fetch(`${API_BASE}/products`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<Product[]>(res);
  },

  async createProduct(data: Partial<Product>) {
    const res = await fetch(`${API_BASE}/products`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<{ id: string }>(res);
  },

  async updateProduct(id: string, data: Partial<Product>) {
    const res = await fetch(`${API_BASE}/products/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async deleteProduct(id: string) {
    const res = await fetch(`${API_BASE}/products/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  // ─── SELLING PRODUCTS ──────────────────────────────────────
  async getSellingProducts() {
    const res = await fetch(`${API_BASE}/selling-products`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<SellingProduct[]>(res);
  },

  async createSellingProduct(data: Partial<SellingProduct>) {
    const res = await fetch(`${API_BASE}/selling-products`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<{ id: string }>(res);
  },

  async updateSellingProduct(id: string, data: Partial<SellingProduct>) {
    const res = await fetch(`${API_BASE}/selling-products/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async deleteSellingProduct(id: string) {
    const res = await fetch(`${API_BASE}/selling-products/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  // ─── ORDERS ────────────────────────────────────────────────
  async getOrders() {
    const res = await fetch(`${API_BASE}/orders`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<Order[]>(res);
  },

  async createOrder(data: Partial<Order>) {
    const res = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<{ id: string }>(res);
  },

  async updateOrder(id: string, data: Partial<Order>) {
    const res = await fetch(`${API_BASE}/orders/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async deleteOrder(id: string) {
    const res = await fetch(`${API_BASE}/orders/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  // ─── DELIVERY ──────────────────────────────────────────────
  async getDeliveryProviders() {
    const res = await fetch(`${API_BASE}/delivery-providers`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<DeliveryProvider[]>(res);
  },

  async createDeliveryProvider(data: Partial<DeliveryProvider>) {
    const res = await fetch(`${API_BASE}/delivery-providers`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<{ id: string }>(res);
  },

  async updateDeliveryProvider(id: string, data: Partial<DeliveryProvider>) {
    const res = await fetch(`${API_BASE}/delivery-providers/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async deleteDeliveryProvider(id: string) {
    const res = await fetch(`${API_BASE}/delivery-providers/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async getShipments() {
    const res = await fetch(`${API_BASE}/shipments`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<Shipment[]>(res);
  },

  async createShipment(data: Partial<Shipment>) {
    const res = await fetch(`${API_BASE}/shipments`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<{ id: string }>(res);
  },

  async updateShipment(id: string, data: Partial<Shipment>) {
    const res = await fetch(`${API_BASE}/shipments/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  // ─── WILAYAS ───────────────────────────────────────────────
  async getWilayas() {
    const res = await fetch(`${API_BASE}/wilayas`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<Wilaya[]>(res);
  },

  // ─── FINANCE ───────────────────────────────────────────────
  async getExpenses() {
    const res = await fetch(`${API_BASE}/expenses`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<Expense[]>(res);
  },

  async createExpense(data: Partial<Expense>) {
    const res = await fetch(`${API_BASE}/expenses`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<{ id: string }>(res);
  },

  async updateExpense(id: string, data: Partial<Expense>) {
    const res = await fetch(`${API_BASE}/expenses/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async deleteExpense(id: string) {
    const res = await fetch(`${API_BASE}/expenses/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async getRevenues() {
    const res = await fetch(`${API_BASE}/revenues`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<Revenue[]>(res);
  },

  async createRevenue(data: Partial<Revenue>) {
    const res = await fetch(`${API_BASE}/revenues`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<{ id: string }>(res);
  },

  // ─── CONFIRMATIONS ─────────────────────────────────────────
  async getConfirmations() {
    const res = await fetch(`${API_BASE}/confirmations`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<Confirmation[]>(res);
  },

  async createConfirmation(data: Partial<Confirmation>) {
    const res = await fetch(`${API_BASE}/confirmations`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<{ id: string }>(res);
  },

  async updateConfirmation(id: string, data: Partial<Confirmation>) {
    const res = await fetch(`${API_BASE}/confirmations/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async deleteConfirmation(id: string) {
    const res = await fetch(`${API_BASE}/confirmations/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  // ─── E-COM DELIVERIES ──────────────────────────────────────
  async getEcomDeliveries() {
    const res = await fetch(`${API_BASE}/ecom-deliveries`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<EcomDelivery[]>(res);
  },

  async createEcomDelivery(data: Partial<EcomDelivery>) {
    const res = await fetch(`${API_BASE}/ecom-deliveries`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<{ id: string }>(res);
  },

  async updateEcomDelivery(id: string, data: Partial<EcomDelivery>) {
    const res = await fetch(`${API_BASE}/ecom-deliveries/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async deleteEcomDelivery(id: string) {
    const res = await fetch(`${API_BASE}/ecom-deliveries/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  // ─── YOUCAN ────────────────────────────────────────────────
  async getYoucanOrders(params: Record<string, string> = {}) {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/youcan/orders?${qs}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<{ orders: YouCanOrder[]; total: number; kpis: YouCanOrdersKpis }>(res);
  },

  async syncYoucanOrders() {
    const res = await fetch(`${API_BASE}/youcan/sync`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return handleResponse<{ success: boolean; count?: number; error?: string }>(res);
  },

  async connectYoucan() {
    const res = await fetch(`${API_BASE}/youcan/oauth/connect`);
    return handleResponse<{ success: boolean; url?: string; error?: string }>(res);
  },

  async disconnectYoucan() {
    const res = await fetch(`${API_BASE}/youcan/oauth/disconnect`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async refreshYoucanToken() {
    const res = await fetch(`${API_BASE}/youcan/refresh-token`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async testYoucanConnection() {
    const res = await fetch(`${API_BASE}/youcan/test`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async fetchYoucanStatus() {
    const res = await fetch(`${API_BASE}/youcan/status`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async pushYoucanOrderToEcom(id: string) {
    const res = await fetch(`${API_BASE}/youcan/orders/${id}/push-ecom`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async bulkPushYoucanOrdersToEcom(ids: string[]) {
    const res = await fetch(`${API_BASE}/youcan/orders/bulk-push-ecom`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ orderIds: ids }),
    });
    return handleResponse(res);
  },

  async deleteYoucanOrder(id: string) {
    const res = await fetch(`${API_BASE}/youcan/orders/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  // ─── FILES (R2-backed) ─────────────────────────────────────
  async getFiles(params?: { search?: string; category?: string; folder?: string; limit?: number; offset?: number }) {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.category) qs.set('category', params.category);
    if (params?.folder) qs.set('folder', params.folder);
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.offset) qs.set('offset', String(params.offset));
    const query = qs.toString() ? `?${qs.toString()}` : '';
    const res = await fetch(`${API_BASE}/files${query}`, {
      headers: getAuthHeaders(),
    });
    const data = await handleResponse<{ files: Record<string, unknown>[]; total: number }>(res);
    const rows = Array.isArray(data.files) ? data.files : [];
    return { files: rows.map(normalizeServerFile), total: data.total ?? rows.length };
  },

  async getServerFile(id: string) {
    const res = await fetch(`${API_BASE}/files/${id}`, {
      headers: getAuthHeaders(),
    });
    const data = await handleResponse<Record<string, unknown>>(res);
    return normalizeServerFile(data);
  },

  // Multipart upload with progress (fetch has no upload progress, hence XHR).
  uploadFile(
    file: File,
    meta: { folder?: string; tags?: string[]; productId?: string },
    onProgress?: (pct: number) => void,
  ): Promise<VaultFile> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE}/files`);
      const token = getAuthToken();
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        let data: { success?: boolean; data?: Record<string, unknown>[]; error?: string } = {};
        try { data = JSON.parse(xhr.responseText); } catch { /* keep empty */ }
        if (xhr.status >= 200 && xhr.status < 300 && data.success && Array.isArray(data.data) && data.data[0]) {
          onProgress?.(100);
          resolve(normalizeServerFile(data.data[0]));
        } else {
          reject(new Error(data.error || `Upload failed: HTTP ${xhr.status}`));
        }
      };
      xhr.onerror = () => reject(new Error('Upload failed: network error'));
      xhr.onabort = () => reject(new Error('Upload cancelled'));
      const fd = new FormData();
      fd.append('file', file, file.name);
      if (meta.folder) fd.append('folder', meta.folder);
      if (meta.tags && meta.tags.length) fd.append('tags', JSON.stringify(meta.tags));
      if (meta.productId) fd.append('productId', meta.productId);
      xhr.send(fd);
    });
  },

  async deleteServerFile(id: string) {
    const res = await fetch(`${API_BASE}/files/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  // Private R2 access: content URL. withToken embeds the JWT so <img>/<video>
  // tags (which can't send Authorization headers) can load. Token stays in-session.
  getFileContentUrl(id: string, withToken = false) {
    const token = withToken ? getAuthToken() : null;
    return `${API_BASE}/files/${id}/content${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  },

  // Authenticated blob download (preserves original filename).
  async downloadServerFile(id: string, filename: string) {
    const res = await fetch(`${API_BASE}/files/${id}/content`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Download failed: HTTP ${res.status}`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  },

  // ─── CREATIVES ─────────────────────────────────────────────
  async getCreatives() {
    const res = await fetch(`${API_BASE}/creatives`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<Creative[]>(res);
  },

  async createCreative(data: Partial<Creative>) {
    const res = await fetch(`${API_BASE}/creatives`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<{ id: string }>(res);
  },

  async updateCreative(id: string, data: Partial<Creative>) {
    const res = await fetch(`${API_BASE}/creatives/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async deleteCreative(id: string) {
    const res = await fetch(`${API_BASE}/creatives/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  // ─── NOTIFICATIONS ─────────────────────────────────────────
  async getNotifications() {
    const res = await fetch(`${API_BASE}/notifications`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<Notification[]>(res);
  },

  async markNotificationRead(id: string) {
    const res = await fetch(`${API_BASE}/notifications/${id}/read`, {
      method: 'PUT',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  // ─── ACTIVITY LOG ──────────────────────────────────────────
  async getActivityLog() {
    const res = await fetch(`${API_BASE}/activity-log`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<ActivityLog[]>(res);
  },

  // ─── SETTINGS ──────────────────────────────────────────────
  async getSettings() {
    const res = await fetch(`${API_BASE}/settings`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<Record<string, unknown>>(res);
  },

  async saveSetting(key: string, value: unknown) {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ key, value }),
    });
    return handleResponse(res);
  },

  // ─── DELIVERY / ECON ─────────────────────────────────────────
  async createColis(data: any) {
    const res = await fetch(`${API_BASE}/colis`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async getColisStatuts(data: any) {
    const res = await fetch(`${API_BASE}/colis/status`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async testEcomConnection() {
    const res = await fetch(`${API_BASE}/ecom/connection`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async getBordereau(data: any) {
    const res = await fetch(`${API_BASE}/ecom/bordereau`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async deleteColis(id: string) {
    const res = await fetch(`${API_BASE}/colis/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async syncRecentDeliveries() {
    const res = await fetch(`${API_BASE}/deliveries/sync`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async getWebhookEvents() {
    const res = await fetch(`${API_BASE}/webhooks`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  // ─── ECOL FROM CONFIRMATION ───────────────────────────────────
  async createColisFromConfirmation(confirmation: Record<string, unknown>) {
    const res = await fetch(`${API_BASE}/ecom/create-from-confirmation`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(confirmation),
    });
    return handleResponse(res);
  },
};

// Ecom Delivery exports (wrappers for api object methods)
export function createColis(data: any) { return api.createColis(data); }
export function getColisStatuts(data: any) { return api.getColisStatuts(data); }
export function testEcomConnection() { return api.testEcomConnection(); }
export function getBordereau(data: any) { return api.getBordereau(data); }
export function deleteColis(id: string) { return api.deleteColis(id); }
export function syncRecentDeliveries() { return api.syncRecentDeliveries(); }
export function getWebhookEvents() { return api.getWebhookEvents(); }
export function createColisFromConfirmation(confirmation: Record<string, unknown>) { return api.createColisFromConfirmation(confirmation); }

// Token management
export function setAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem('foxbox_jwt_token', token);
  } else {
    localStorage.removeItem('foxbox_jwt_token');
  }
}

export function getAuthToken(): string | null {
  return localStorage.getItem('foxbox_jwt_token');
}

export function clearAuthToken() {
  localStorage.removeItem('foxbox_jwt_token');
}