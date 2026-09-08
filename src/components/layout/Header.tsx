import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  Bell,
  ChevronDown,
  X,
  FileText,
  Package,
  CheckSquare,
  MessageSquare,
  Palette,
  ShoppingCart,
  LogOut,
  Settings,
  User,
  Users,
} from 'lucide-react'
import { useAppState } from '@/stores/AppState'
import { cn } from '@/lib/utils'
import { UserAvatar } from '@/components/auth/UserAvatar'
import { getRoleDisplayName } from '@/lib/auth'
import type { AuthRole } from '@/types'

export function Header() {
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const {
    notifications, markAllNotificationsRead, markNotificationRead,
    unreadNotificationCount, products, tasks, orders, posts,
    creatives, files, channels, currentUser, authUser, logout,
  } = useAppState()
  const navigate = useNavigate()
  const searchRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSearch(false)
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifications(false)
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setShowUserMenu(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Keyboard shortcut: / to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && !showSearch && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault()
        setShowSearch(true)
      }
      if (e.key === 'Escape') {
        setShowSearch(false)
        setShowNotifications(false)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [showSearch])

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.toLowerCase()
    const results: { type: string; icon: typeof Package; label: string; sublabel: string; path: string }[] = []

    products.forEach(p => {
      if (p.name.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q) || p.supplier?.name.toLowerCase().includes(q)) {
        results.push({ type: 'Product', icon: Package, label: p.name, sublabel: p.status, path: `/app/research/${p.id}` })
      }
    })
    tasks.forEach(t => {
      if (t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)) {
        results.push({ type: 'Task', icon: CheckSquare, label: t.title, sublabel: t.status, path: '/app/tasks' })
      }
    })
    orders.forEach(o => {
      if (o.orderNumber.toLowerCase().includes(q) || o.customer.name.toLowerCase().includes(q) || o.customer.phone.includes(q)) {
        results.push({ type: 'Order', icon: ShoppingCart, label: o.orderNumber, sublabel: o.customer.name, path: '/app/orders' })
      }
    })
    posts.forEach(p => {
      if (p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q)) {
        results.push({ type: 'Post', icon: FileText, label: p.title, sublabel: p.type, path: '/app/team' })
      }
    })
    creatives.forEach(c => {
      if (c.name.toLowerCase().includes(q) || c.hook?.toLowerCase().includes(q)) {
        results.push({ type: 'Creative', icon: Palette, label: c.name, sublabel: c.status, path: '/app/creative' })
      }
    })
    files.forEach(f => {
      if (f.name.toLowerCase().includes(q) || f.tags.some(t => t.toLowerCase().includes(q))) {
        results.push({ type: 'File', icon: FileText, label: f.name, sublabel: f.folder, path: '/app/files' })
      }
    })
    channels.forEach(ch => {
      if (ch.name.toLowerCase().includes(q)) {
        results.push({ type: 'Channel', icon: MessageSquare, label: `#${ch.name}`, sublabel: ch.description, path: '/app/discussions' })
      }
    })

    return results.slice(0, 12)
  }, [searchQuery, products, tasks, orders, posts, creatives, files, channels])

  const handleSearchSelect = useCallback((path: string) => {
    navigate(path)
    setShowSearch(false)
    setSearchQuery('')
  }, [navigate])

  return (
    <header className="sticky top-0 z-30 h-[72px] flex items-center justify-between px-8 border-b border-border bg-obsidian/80 backdrop-blur-xl">
      {/* Search */}
      <div ref={searchRef} className="relative">
        <div className={cn(
          'header-search flex items-center gap-3 px-4 py-2.5 w-[400px] transition-all',
          showSearch && 'ring-1 ring-gold/30'
        )}>
          <Search className="w-4 h-4 text-text-muted flex-shrink-0" />
          <input
            type="text"
            placeholder="Search products, tasks, orders..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setShowSearch(true) }}
            onFocus={() => setShowSearch(true)}
            className="bg-transparent border-none outline-none text-sm text-text-primary placeholder:text-text-muted w-full"
          />
          {searchQuery ? (
            <button onClick={() => { setSearchQuery(''); setShowSearch(false) }} className="text-text-muted hover:text-text-secondary">
              <X className="w-4 h-4" />
            </button>
          ) : (
            <kbd className="hidden lg:inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono text-text-muted bg-white/[0.03] border border-border rounded">
              /
            </kbd>
          )}
        </div>

        {/* Search Results Dropdown */}
        {showSearch && searchQuery.trim() && (
          <div className="absolute top-full left-0 right-0 mt-2 w-[500px] bg-charcoal border border-border rounded-xl shadow-2xl overflow-hidden z-50">
            {searchResults.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-text-muted">No results for "{searchQuery}"</p>
              </div>
            ) : (
              <div className="max-h-[400px] overflow-y-auto">
                {searchResults.map((r, i) => (
                  <button
                    key={`${r.type}-${i}`}
                    onClick={() => handleSearchSelect(r.path)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center flex-shrink-0">
                      <r.icon className="w-4 h-4 text-gold" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">{r.label}</p>
                      <p className="text-[11px] text-text-muted">{r.type} · {r.sublabel}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        {/* Notifications */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-lg hover:bg-white/[0.03] transition-colors"
          >
            <Bell className="w-5 h-5 text-text-secondary" />
            {unreadNotificationCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-gold text-obsidian text-[10px] font-bold flex items-center justify-center">
                {unreadNotificationCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-12 w-[380px] bg-charcoal border border-border rounded-xl shadow-2xl overflow-hidden z-50">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <span className="text-sm font-semibold">Notifications</span>
                <button
                  onClick={() => markAllNotificationsRead()}
                  className="text-xs text-gold hover:text-gold-light transition-colors"
                >
                  Mark all read
                </button>
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <p className="text-sm text-text-muted">No notifications</p>
                  </div>
                ) : (
                  notifications.slice(0, 10).map(n => (
                    <div
                      key={n.id}
                      className={cn(
                        'px-4 py-3 border-b border-border hover:bg-white/[0.02] transition-colors cursor-pointer',
                        !n.isRead && 'bg-gold-subtle'
                      )}
                      onClick={() => {
                        markNotificationRead(n.id)
                        if (n.link) navigate(n.link)
                        setShowNotifications(false)
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          'w-2 h-2 rounded-full mt-1.5 flex-shrink-0',
                          n.isRead ? 'bg-transparent' : 'bg-gold'
                        )} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-text-primary">{n.title}</p>
                          <p className="text-xs text-text-muted mt-0.5 truncate">{n.message}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User */}
        <div ref={userMenuRef} className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-3 pl-4 border-l border-border hover:bg-white/[0.02] rounded-lg transition-colors"
          >
            <UserAvatar name={authUser?.fullName || currentUser?.name || 'User'} avatar={authUser?.avatar} size="sm" />
            <div className="hidden lg:block text-left">
              <p className="text-sm font-medium">{authUser?.fullName || currentUser?.name || 'User'}</p>
              <p className="text-[11px] text-text-muted">{authUser ? getRoleDisplayName(authUser.role as AuthRole) : currentUser?.role?.replace('_', ' ') || 'Member'}</p>
            </div>
            <ChevronDown className="w-4 h-4 text-text-muted" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-12 w-[220px] bg-charcoal border border-border rounded-xl shadow-2xl overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-sm font-medium text-text-primary">{authUser?.fullName || currentUser?.name || 'User'}</p>
                <p className="text-[11px] text-text-muted">{authUser?.email || ''}</p>
              </div>
              <button
                onClick={() => { navigate('/app/profile'); setShowUserMenu(false) }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors text-left"
              >
                <User className="w-4 h-4 text-text-secondary" />
                <span className="text-sm text-text-primary">My Profile</span>
              </button>
              {authUser?.role === 'administrator' && (
                <button
                  onClick={() => { navigate('/app/team-management'); setShowUserMenu(false) }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors text-left"
                >
                  <Users className="w-4 h-4 text-text-secondary" />
                  <span className="text-sm text-text-primary">Team Management</span>
                </button>
              )}
              <button
                onClick={() => { navigate('/app/settings'); setShowUserMenu(false) }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors text-left"
              >
                <Settings className="w-4 h-4 text-text-secondary" />
                <span className="text-sm text-text-primary">Settings</span>
              </button>
              <div className="border-t border-border" />
              <button
                onClick={() => { logout(); navigate('/login'); setShowUserMenu(false) }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors text-left"
              >
                <LogOut className="w-4 h-4 text-danger" />
                <span className="text-sm text-danger">Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
