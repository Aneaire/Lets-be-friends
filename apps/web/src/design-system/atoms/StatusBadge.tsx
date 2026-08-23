import type { HTMLAttributes } from 'react'

export function StatusBadge({ tone = 'neutral', className = '', ...props }: HTMLAttributes<HTMLSpanElement> & {
  tone?: 'neutral' | 'self' | 'social' | 'success' | 'warning' | 'danger'
}) {
  return <span className={`status-pill ${className}`.trim()} data-tone={tone} {...props} />
}
