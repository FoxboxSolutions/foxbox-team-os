import { Outlet } from 'react-router-dom'

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-obsidian flex items-center justify-center px-4 py-12">
      {/* Subtle gold ambient glow */}
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[radial-gradient(ellipse,rgba(212,175,55,0.04)_0%,transparent_70%)] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img src="/logo.png" alt="FOXBOX" className="w-14 h-14 rounded-full mb-4" />
          <h1 className="text-2xl font-serif font-bold text-gradient-gold tracking-wide">FOXBOX TEAM</h1>
          <p className="text-xs text-text-muted tracking-[0.2em] uppercase mt-1">Operating System</p>
        </div>

        {/* Auth Card */}
        <div className="glass-card p-8 rounded-2xl">
          <Outlet />
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-[11px] text-text-muted">
            Private. Internal. Team Only.
          </p>
        </div>
      </div>
    </div>
  )
}
