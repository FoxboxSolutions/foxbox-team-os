import { cn } from '@/lib/utils'

interface UserAvatarProps {
  name: string
  avatar?: string | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg',
  xl: 'w-20 h-20 text-2xl',
}

function getInitials(name: string): string {
  const safe = (name || '').trim()
  if (!safe) return 'U'
  const parts = safe.split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return parts[0]?.substring(0, 2).toUpperCase() || 'U'
}

export function UserAvatar({ name, avatar, size = 'md', className }: UserAvatarProps) {
  if (avatar) {
    return (
      <div className={cn('rounded-full overflow-hidden flex-shrink-0', sizeClasses[size], className)}>
        <img src={avatar} alt={name} className="w-full h-full object-cover" />
      </div>
    )
  }

  return (
    <div className={cn(
      'rounded-full flex items-center justify-center font-semibold bg-gold/15 text-gold border border-gold/20 flex-shrink-0',
      sizeClasses[size],
      className
    )}>
      {getInitials(name)}
    </div>
  )
}
