import { useEffect, useState, type HTMLAttributes } from 'react'

export function getInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || '?'
}

export function Avatar({
  name,
  src,
  size = 'medium',
  decorative = false,
  className = '',
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  name: string
  src?: string | null
  size?: 'small' | 'medium' | 'large'
  decorative?: boolean
}) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [src])
  const label = decorative ? undefined : src && !failed ? `Portrait of ${name}` : `${name} has no profile photo`

  return (
    <span
      className={`avatar ds-avatar ${size === 'large' ? 'avatar-lg' : size === 'small' ? 'ds-avatar-sm' : ''} ${className}`.trim()}
      role={decorative ? undefined : 'img'}
      aria-label={label}
      aria-hidden={decorative || undefined}
      {...props}
    >
      {src && !failed ? <img src={src} alt="" onError={() => setFailed(true)} /> : getInitials(name)}
    </span>
  )
}
