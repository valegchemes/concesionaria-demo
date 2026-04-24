/**
 * Empty State para Dashboard
 * Sin 'any' - Enterprise Grade
 */

import { LucideIcon, TrendingUp } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

// ============================================================================
// Tipos estrictos
// ============================================================================

interface EmptyStateProps {
  title: string
  description: string
  icon?: LucideIcon
  actionLabel?: string
  actionHref?: string
  compact?: boolean
}

// ============================================================================
// Componente
// ============================================================================

export function EmptyState({
  title,
  description,
  icon: Icon = TrendingUp,
  actionLabel,
  actionHref,
  compact = false,
}: EmptyStateProps) {
  const content = (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? 'py-8' : 'py-16'}`}>
      <div className={`rounded-full bg-muted ${compact ? 'p-3 mb-3' : 'p-4 mb-4'}`}>
        <Icon className={`text-muted-foreground ${compact ? 'h-6 w-6' : 'h-8 w-8'}`} />
      </div>
      <h3 className={`font-semibold text-foreground ${compact ? 'text-base mb-1' : 'text-lg mb-2'}`}>
        {title}
      </h3>
      <p className={`text-muted-foreground max-w-sm ${compact ? 'text-sm mb-3' : 'text-base mb-4'}`}>
        {description}
      </p>
      {actionLabel && actionHref && (
        <Link href={actionHref}>
          <Button size={compact ? 'sm' : 'default'}>
            {actionLabel}
          </Button>
        </Link>
      )}
    </div>
  )

  if (compact) {
    return content
  }

  return (
    <Card>
      <CardContent>{content}</CardContent>
    </Card>
  )
}
