import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Search,
  Trophy,
  Users,
  CheckSquare,
  FolderOpen,
  MessageSquare,
  Palette,
  Package,
  ShoppingCart,
  Truck,
  DollarSign,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  MessageSquareCheck,
  ShoppingBag,
  Store,
  Shield,
} from 'lucide-react'
import { useAppState } from '@/stores/AppState'
import { cn } from '@/lib/utils'

interface NavItem {
  path: string
  label: string
  icon: typeof LayoutDashboard
  badge?: number
}

interface NavSection {
  label: string
  items: NavItem[]
}

const navSections: NavSection[] = [
  {
    label: 'MAIN',
    items: [
      { path: '/app', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'RESEARCH',
    items: [
      { path: '/app/research', label: 'Product Research', icon: Search },
      { path: '/app/winners', label: 'Winners', icon: Trophy },
    ],
  },
  {
    label: 'SELLING',
    items: [
      { path: '/app/product-selling', label: 'Product Selling', icon: ShoppingBag },
    ],
  },
  {
    label: 'TEAM',
    items: [
      { path: '/app/team', label: 'Team Hub', icon: Users },
      { path: '/app/tasks', label: 'Tasks', icon: CheckSquare },
      { path: '/app/files', label: 'Files', icon: FolderOpen },
      { path: '/app/discussions', label: 'Discussions', icon: MessageSquare },
    ],
  },
  {
    label: 'MARKETING',
    items: [
      { path: '/app/creative', label: 'Creative Lab', icon: Palette },
    ],
  },
  {
    label: 'OPERATIONS',
    items: [
      { path: '/app/youcan-orders', label: 'YouCan Orders', icon: Store },
      { path: '/app/cod', label: 'COD Center', icon: Package },
      { path: '/app/orders', label: 'Orders', icon: ShoppingCart },
      { path: '/app/confirmation', label: 'Confirmation via Message', icon: MessageSquareCheck },
      { path: '/app/delivery', label: 'Delivery', icon: Truck },
      { path: '/app/finance', label: 'Finance', icon: DollarSign },
    ],
  },
  {
    label: 'ANALYTICS',
    items: [
      { path: '/app/analytics', label: 'Analytics', icon: BarChart3 },
    ],
  },
  {
    label: 'SYSTEM',
    items: [
      { path: '/app/settings', label: 'Settings', icon: Settings },
    ],
  },
]

function FoxLogo({ className }: { className?: string }) {
  return (
    <img src="/logo.png" alt="FOXBOX" className={className} />
  )
}

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar, tasks, notifications, authUser } = useAppState()
  const location = useLocation()

  const pendingTasks = tasks.filter(t => t.status !== 'DONE').length
  const unreadNotifications = notifications.filter(n => !n.isRead).length
  const isAdmin = authUser?.role === 'administrator'

  // Build nav sections dynamically
  const sections: NavSection[] = [
    ...navSections.slice(0, -1), // All sections except SYSTEM
    {
      label: 'SYSTEM',
      items: [
        ...(isAdmin ? [{ path: '/app/team-management', label: 'Team Management', icon: Shield }] : []),
        { path: '/app/settings', label: 'Settings', icon: Settings },
      ],
    },
  ]

  return (
    <aside
      className={cn(
        'sidebar h-screen flex flex-col transition-all duration-300 sticky top-0 z-40',
        sidebarCollapsed ? 'w-[72px]' : 'w-[260px]'
      )}
    >
      {/* Brand */}
      <div className="h-[72px] flex items-center px-5 border-b border-border">
        {!sidebarCollapsed ? (
          <div className="flex items-center gap-3">
            <FoxLogo className="w-10 h-10 rounded-full" />
            <div className="flex flex-col">
              <span className="text-[15px] font-bold tracking-wide text-gradient-gold">FOXBOX TEAM</span>
              <span className="text-[9px] font-semibold tracking-[0.2em] text-text-muted uppercase">Operating System</span>
            </div>
          </div>
        ) : (
          <FoxLogo className="w-9 h-9 rounded-full mx-auto" />
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 overflow-y-auto">
        {sections.map((section) => (
          <div key={section.label}>
            {!sidebarCollapsed && (
              <div className="sidebar-section-label">{section.label}</div>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = item.path === '/app'
                  ? location.pathname === '/app'
                  : location.pathname.startsWith(item.path)

                const badgeCount = item.path === '/app/tasks' ? pendingTasks
                  : item.path === '/app/discussions' ? unreadNotifications
                  : undefined

                return (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      className={cn('sidebar-nav-item', isActive && 'active')}
                    >
                      <item.icon
                        className={cn(
                          'w-5 h-5 flex-shrink-0',
                          isActive ? 'text-gold' : 'text-text-muted'
                        )}
                      />
                      {!sidebarCollapsed && (
                        <>
                          <span className="truncate flex-1">{item.label}</span>
                          {badgeCount !== undefined && badgeCount > 0 && (
                            <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-gold/15 text-gold text-[10px] font-bold flex items-center justify-center">
                              {badgeCount}
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Brand Footer */}
      {!sidebarCollapsed && (
        <div className="px-5 pb-4">
          <div className="py-4 border-t border-border">
            <div className="flex items-center gap-3">
              <FoxLogo className="w-8 h-8 rounded-full opacity-60" />
              <div className="flex flex-col">
                <span className="text-[11px] font-semibold text-text-muted tracking-wide">FOXBOX TEAM OS</span>
                <span className="text-[9px] text-text-muted/60 uppercase tracking-wider">Research. Collaborate. Scale.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Collapse Toggle */}
      <div className="px-3 pb-3">
        <button
          onClick={toggleSidebar}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-text-muted hover:bg-white/[0.03] hover:text-text-secondary transition-all duration-200"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span className="text-xs">Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}
