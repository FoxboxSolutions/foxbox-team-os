import { checkPasswordStrength } from '@/lib/auth'

interface PasswordStrengthProps {
  password: string
}

export function PasswordStrength({ password }: PasswordStrengthProps) {
  if (!password) return null

  const strength = checkPasswordStrength(password)

  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full transition-all duration-300"
            style={{
              backgroundColor: i <= strength.score - 1 ? strength.color : 'rgba(255,255,255,0.06)',
            }}
          />
        ))}
      </div>
      <p className="text-[11px] text-text-muted">
        Password strength: <span style={{ color: strength.color }}>{strength.label}</span>
      </p>
    </div>
  )
}
