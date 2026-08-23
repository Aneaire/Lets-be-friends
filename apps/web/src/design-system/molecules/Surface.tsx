import type { HTMLAttributes } from 'react'

export function Surface({ density = 'default', tone = 'default', className = '', ...props }: HTMLAttributes<HTMLDivElement> & {
  density?: 'compact' | 'default'
  tone?: 'default' | 'sunk'
}) {
  return <div className={`ds-surface ${className}`.trim()} data-density={density} data-tone={tone} {...props} />
}
