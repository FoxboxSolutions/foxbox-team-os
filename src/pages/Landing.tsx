import { useNavigate } from 'react-router-dom'
import { useEffect, useState, useCallback } from 'react'
import {
  Search,
  Package,
  Target,
  ShoppingCart,
  BarChart3,
  Truck,
  Zap,
  Users,
  Layers,
  Shield,
  ArrowRight,
  Trophy,
  CheckSquare,
  MessageSquare,
  Palette,
  DollarSign,
  FileText,
  Globe,
  ChevronRight,
} from 'lucide-react'
import { db } from '@/lib/db'

const workflowSteps = [
  { num: '01', label: 'IDEA', description: 'A product catches our attention.' },
  { num: '02', label: 'RESEARCH', description: 'Analyze supplier, pricing, competition and market potential.' },
  { num: '03', label: 'CALCULATE', description: 'Calculate product cost, shipping, investment and potential profit.' },
  { num: '04', label: 'TEST', description: 'Launch a controlled test and measure performance.' },
  { num: '05', label: 'APPROVE', description: 'Decide whether the product deserves further investment.' },
  { num: '06', label: 'PURCHASE', description: 'Move approved products into purchasing.' },
  { num: '07', label: 'SCALE', description: 'Scale products that prove themselves.' },
]

const coreTools = [
  { icon: Search, title: 'Product Research', description: 'Research products with real data. Calculate costs, margins, and COD economics.' },
  { icon: Users, title: 'Team Hub', description: 'Share insights, announcements, and product opportunities with the team.' },
  { icon: CheckSquare, title: 'Task Management', description: 'Assign tasks, track progress, and keep the team aligned.' },
  { icon: MessageSquare, title: 'Discussions', description: 'Channel-based team communication for every topic.' },
  { icon: Palette, title: 'Creative Lab', description: 'Manage ad creatives, track performance, identify winners.' },
  { icon: Package, title: 'COD Center', description: 'Manage orders, track confirmations, monitor deliveries.' },
  { icon: ShoppingCart, title: 'Order Management', description: 'Full order lifecycle from creation to delivery.' },
  { icon: Truck, title: 'Delivery Tracking', description: 'Multi-carrier delivery management with wilaya analytics.' },
  { icon: DollarSign, title: 'Finance', description: 'Track revenue, expenses, and real profit per product.' },
  { icon: BarChart3, title: 'Analytics', description: 'Performance analytics across products, orders, and wilayas.' },
  { icon: Trophy, title: 'Winners', description: 'Your validated winning products knowledge base.' },
  { icon: FileText, title: 'Files & Media', description: 'Centralized storage for images, videos, and documents.' },
]

const benefits = [
  { icon: Zap, title: 'One Platform', description: 'Replace multiple tools with one unified system.' },
  { icon: Shield, title: 'Data-Driven', description: 'Every decision backed by real numbers.' },
  { icon: Target, title: 'Focused Workflow', description: 'From idea to winner in one clear pipeline.' },
  { icon: Users, title: 'Team Aligned', description: 'Everyone works with the same information.' },
  { icon: Layers, title: 'Scalable Process', description: 'Turn product selection into a repeatable system.' },
  { icon: Globe, title: 'COD Optimized', description: 'Built specifically for Algerian COD operations.' },
]

const stats = [
  { value: '10x', label: 'Faster Decisions' },
  { value: '35%+', label: 'Average Margins' },
  { value: '100%', label: 'Team Alignment' },
  { value: '24/7', label: 'Operations Hub' },
]

export function Landing() {
  const navigate = useNavigate()
  const [scrollY, setScrollY] = useState(0)

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const navOpacity = Math.min(scrollY / 200, 0.95)

  const handleCtaClick = useCallback(() => {
    const authUser = db.getCurrentAuthUser()
    if (!authUser) {
      navigate('/login')
    } else if (authUser.status === 'approved') {
      navigate('/app')
    } else if (authUser.status === 'pending') {
      navigate('/pending-approval')
    } else if (authUser.status === 'rejected') {
      navigate('/account-rejected')
    } else if (authUser.status === 'suspended') {
      navigate('/account-suspended')
    } else {
      navigate('/login')
    }
  }, [navigate])

  return (
    <div className="min-h-screen bg-[#070707] text-[#F5F5F5]">
      {/* ============================================
          NAVIGATION - Floating Premium
          ============================================ */}
      <nav
        className="fixed top-4 left-4 right-4 z-50 transition-all duration-500"
        style={{ opacity: 1 }}
      >
        <div
          className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between rounded-2xl liquid-glass"
          style={{ backgroundColor: `rgba(7, 7, 7, ${navOpacity})` }}
        >
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="FOXBOX" className="w-9 h-9 rounded-full" />
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-wide text-gradient-gold font-serif">FOXBOX TEAM</span>
              <span className="text-[8px] font-semibold tracking-[0.2em] text-[#5A5A60] uppercase">Operating System</span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <a href="#features" className="text-sm text-[#8D8D93] hover:text-[#F5F5F5] transition-colors duration-300 hidden md:block">
              Features
            </a>
            <a href="#workflow" className="text-sm text-[#8D8D93] hover:text-[#F5F5F5] transition-colors duration-300 hidden md:block">
              Workflow
            </a>
            <button
              onClick={handleCtaClick}
              className="btn-primary text-sm px-5 py-2.5 cursor-pointer btn-premium"
            >
              ENTER FOXBOX TEAM
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      {/* ============================================
          HERO - Cinematic Chess Premium
          ============================================ */}
      <section className="relative h-[700px] md:h-[800px] lg:h-[850px] flex items-center overflow-hidden">
        {/* Chess Background Image - Full Cover */}
        <div className="absolute inset-0">
          <img
            src="/hero-chess.jpg"
            alt=""
            className="w-full h-full object-cover"
            style={{ objectPosition: '55% center' }}
          />
        </div>

        {/* 50% Black Overlay */}
        <div
          className="absolute inset-0"
          style={{ background: 'rgba(0, 0, 0, 0.50)' }}
        />

        {/* Premium Gradient Overlay for Text Readability */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(90deg, rgba(0,0,0,0.80) 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0.30) 100%)',
          }}
        />

        {/* Subtle Vignette */}
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4) 100%)',
          }}
        />

        {/* Very Subtle Gold Ambient Glow */}
        <div className="absolute top-1/3 left-1/3 w-[600px] h-[400px] bg-[radial-gradient(ellipse,rgba(212,175,55,0.06)_0%,transparent_70%)] pointer-events-none" />

        {/* Hero Content - Left Aligned */}
        <div className="relative z-10 w-full max-w-[1400px] mx-auto px-6 lg:px-12">
          <div className="max-w-2xl">
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#D4AF37]/20 bg-[#D4AF37]/5 mb-8 backdrop-blur-sm">
              <div className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] animate-pulse" />
              <span className="text-[11px] font-semibold text-[#D4AF37] tracking-[0.2em] uppercase">FOXBOX TEAM OS</span>
            </div>

            {/* Main Headline - Premium Serif */}
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-serif font-bold tracking-tight mb-8 leading-[0.95]">
              <span className="block text-[#F5F5F5]">RESEARCH.</span>
              <span className="block text-[#F5F5F5] mt-2">STRATEGIZE.</span>
              <span className="block text-gradient-gold mt-2">WIN.</span>
              <span className="block text-[#F5F5F5] mt-2">TOGETHER.</span>
            </h1>

            {/* Supporting Text */}
            <p className="text-lg md:text-xl text-[#B0B0B0] max-w-xl mb-10 leading-relaxed font-light">
              One powerful workspace for product research, team collaboration, COD operations and e-commerce growth.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-start gap-4">
              <button
                onClick={handleCtaClick}
                className="btn-primary text-base px-8 py-4 cursor-pointer btn-premium"
              >
                ENTER FOXBOX TEAM
                <ArrowRight className="w-5 h-5" />
              </button>
              <a
                href="#workflow"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl border border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#D4AF37]/10 transition-all duration-300 text-base font-medium cursor-pointer"
              >
                EXPLORE THE PLATFORM
              </a>
            </div>

            {/* Trust Indicators */}
            <div className="flex items-center gap-8 mt-16 pt-8 border-t border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#D4AF37]/10 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-[#D4AF37]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#F5F5F5]">Internal Only</p>
                  <p className="text-[11px] text-[#5A5A60]">Team exclusive access</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#D4AF37]/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-[#D4AF37]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#F5F5F5]">5 Team Members</p>
                  <p className="text-[11px] text-[#5A5A60]">Active collaborators</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-40">
          <span className="text-[10px] text-[#8D8D93] tracking-[0.2em] uppercase">Scroll</span>
          <div className="w-px h-8 bg-gradient-to-b from-[#D4AF37]/50 to-transparent" />
        </div>
      </section>

      {/* ============================================
          STATS BAR - Social Proof
          ============================================ */}
      <section className="py-16 px-6 border-y border-white/[0.04]">
        <div className="max-w-[1400px] mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-4xl md:text-5xl font-serif font-bold text-gradient-gold mb-2">{stat.value}</p>
                <p className="text-xs text-[#5A5A60] tracking-[0.15em] uppercase">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================
          HOW IT WORKS - Premium Pipeline
          ============================================ */}
      <section id="workflow" className="py-32 px-6">
        <div className="max-w-[1400px] mx-auto">
          <div className="text-center mb-20">
            <p className="text-xs font-semibold tracking-[0.3em] text-[#D4AF37] uppercase mb-4">Workflow</p>
            <h2 className="text-5xl md:text-6xl font-serif font-bold mb-6">
              From Idea to <span className="text-gradient-gold">Winner</span>
            </h2>
            <p className="text-[#8D8D93] max-w-xl mx-auto text-lg">
              A clear, data-driven pipeline that transforms product ideas into profitable winners.
            </p>
          </div>

          <div className="relative">
            {/* Connecting Line */}
            <div className="absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(212,175,55,0.2)] to-transparent hidden lg:block" />

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-6">
              {workflowSteps.map((step, i) => (
                <div key={step.num} className="relative group">
                  <div className="flex flex-col items-center gap-4 p-6 rounded-2xl liquid-glass hover:liquid-glass-gold transition-all duration-500 cursor-default">
                    <span className="text-3xl font-serif font-bold text-gradient-gold">{step.num}</span>
                    <span className="text-sm font-bold tracking-[0.15em] text-[#F5F5F5]">{step.label}</span>
                    <span className="text-[11px] text-[#5A5A60] text-center leading-relaxed">{step.description}</span>
                  </div>
                  {i < workflowSteps.length - 1 && (
                    <ChevronRight className="absolute top-1/2 -right-3 w-4 h-4 text-[#D4AF37]/30 hidden lg:block -translate-y-1/2" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============================================
          FEATURES - Premium Grid
          ============================================ */}
      <section id="features" className="py-32 px-6 bg-[radial-gradient(ellipse_at_center,rgba(212,175,55,0.03)_0%,transparent_60%)]">
        <div className="max-w-[1400px] mx-auto">
          <div className="text-center mb-20">
            <p className="text-xs font-semibold tracking-[0.3em] text-[#D4AF37] uppercase mb-4">Platform</p>
            <h2 className="text-5xl md:text-6xl font-serif font-bold mb-6">
              Everything You <span className="text-gradient-gold">Need</span>
            </h2>
            <p className="text-[#8D8D93] max-w-xl mx-auto text-lg">
              One platform to research, collaborate, test, sell, and scale.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {coreTools.map((tool, i) => (
              <div
                key={tool.title}
                className="group p-8 rounded-2xl liquid-glass hover:liquid-glass-gold transition-all duration-500 cursor-pointer premium-card"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="w-12 h-12 rounded-xl bg-[rgba(212,175,55,0.08)] border border-[rgba(212,175,55,0.12)] flex items-center justify-center mb-5 group-hover:bg-[rgba(212,175,55,0.15)] transition-all duration-300">
                  <tool.icon className="w-6 h-6 text-[#D4AF37]" />
                </div>
                <h3 className="text-lg font-semibold text-[#F5F5F5] mb-3 font-serif">{tool.title}</h3>
                <p className="text-sm text-[#5A5A60] leading-relaxed">{tool.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================
          BENEFITS - Premium Cards
          ============================================ */}
      <section className="py-32 px-6">
        <div className="max-w-[1400px] mx-auto">
          <div className="text-center mb-20">
            <p className="text-xs font-semibold tracking-[0.3em] text-[#D4AF37] uppercase mb-4">Benefits</p>
            <h2 className="text-5xl md:text-6xl font-serif font-bold mb-6">
              Why <span className="text-gradient-gold">FOXBOX</span> Team
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {benefits.map((b, i) => (
              <div
                key={b.title}
                className="flex items-start gap-5 p-8 rounded-2xl liquid-glass hover:liquid-glass-gold transition-all duration-500 cursor-default premium-card"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="w-12 h-12 rounded-xl bg-[rgba(212,175,55,0.08)] border border-[rgba(212,175,55,0.12)] flex items-center justify-center flex-shrink-0">
                  <b.icon className="w-6 h-6 text-[#D4AF37]" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[#F5F5F5] mb-2 font-serif">{b.title}</h3>
                  <p className="text-sm text-[#5A5A60] leading-relaxed">{b.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================
          PHILOSOPHY - Cinematic Quote
          ============================================ */}
      <section className="py-40 px-6 bg-[radial-gradient(ellipse_at_center,rgba(212,175,55,0.05)_0%,transparent_60%)]">
        <div className="max-w-4xl mx-auto text-center">
          <div className="mb-8">
            <div className="w-px h-16 bg-gradient-to-b from-transparent via-[#D4AF37]/30 to-transparent mx-auto" />
          </div>
          <p className="text-xs font-semibold tracking-[0.3em] text-[#D4AF37] uppercase mb-10">Philosophy</p>
          <blockquote className="text-3xl md:text-4xl lg:text-5xl font-serif font-light text-[#F5F5F5] leading-snug mb-10">
            "We don't scale products because they look good.
            <span className="block mt-4 text-gradient-gold font-medium">We scale products because the numbers prove they deserve it.</span>"
          </blockquote>
          <div className="mt-8">
            <div className="w-px h-16 bg-gradient-to-b from-transparent via-[#D4AF37]/30 to-transparent mx-auto" />
          </div>
        </div>
      </section>

      {/* ============================================
          FINAL CTA - Premium
          ============================================ */}
      <section className="py-32 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-5xl md:text-6xl font-serif font-bold mb-8">
            Ready to <span className="text-gradient-gold">Operate</span>?
          </h2>
          <p className="text-xl text-[#8D8D93] mb-12 max-w-2xl mx-auto">
            Enter the command center of FOXBOX. One platform for your entire e-commerce operation.
          </p>
          <button
            onClick={handleCtaClick}
            className="btn-primary text-lg px-12 py-5 cursor-pointer btn-premium"
          >
            ENTER FOXBOX TEAM
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* ============================================
          FOOTER - Premium Minimal
          ============================================ */}
      <footer className="border-t border-white/[0.04] py-12 px-6">
        <div className="max-w-[1400px] mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <img src="/logo.png" alt="FOXBOX" className="w-8 h-8 rounded-full opacity-60" />
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-[#5A5A60] tracking-wide font-serif">FOXBOX TEAM OS</span>
                <span className="text-[10px] text-[#5A5A60]/60 uppercase tracking-[0.15em]">Internal Platform</span>
              </div>
            </div>
            <div className="flex items-center gap-8">
              <a href="#features" className="text-xs text-[#5A5A60] hover:text-[#8D8D93] transition-colors duration-300">Features</a>
              <a href="#workflow" className="text-xs text-[#5A5A60] hover:text-[#8D8D93] transition-colors duration-300">Workflow</a>
              <span className="text-xs text-[#5A5A60]/40">Private. Internal. Team Only.</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
