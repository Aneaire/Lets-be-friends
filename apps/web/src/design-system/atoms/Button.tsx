import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type ButtonIntent = 'neutral' | 'self' | 'social' | 'danger' | 'ghost'
export type ButtonSize = 'small' | 'medium' | 'large'

export function Button({
  intent = 'neutral',
  size = 'medium',
  block = false,
  loading = false,
  loadingLabel = 'Loading',
  leadingIcon,
  children,
  className = '',
  disabled,
  type = 'button',
  'aria-label': ariaLabel,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  intent?: ButtonIntent
  size?: ButtonSize
  block?: boolean
  loading?: boolean
  loadingLabel?: ReactNode
  leadingIcon?: ReactNode
}) {
  const intentClass = intent === 'ghost' ? 'btn-ghost' : `btn-${intent}`
  return (
    <button
      type={type}
      className={`btn ${intentClass} ${size === 'small' ? 'btn-sm' : size === 'large' ? 'btn-lg' : ''} ${block ? 'btn-block' : ''} ${className}`.trim()}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      aria-label={ariaLabel ?? (loading && typeof children === 'string' ? `${children}, loading` : undefined)}
      {...props}
    >
      {loading ? <span className="ds-spinner" aria-hidden="true" /> : leadingIcon}
      <span>{loading ? loadingLabel : children}</span>
    </button>
  )
}
