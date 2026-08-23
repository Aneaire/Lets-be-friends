import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

export const IconButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string
  tone?: 'neutral' | 'self' | 'social' | 'danger'
  size?: 'small' | 'medium'
  children: ReactNode
}>(function IconButton({
  label,
  tone = 'neutral',
  size = 'medium',
  children,
  className = '',
  ...props
}, ref) {
  return (
    <button
      type="button"
      className={`icon-button ${className}`.trim()}
      data-tone={tone}
      data-size={size}
      aria-label={label}
      title={props.title ?? label}
      ref={ref}
      {...props}
    >
      {children}
    </button>
  )
})
