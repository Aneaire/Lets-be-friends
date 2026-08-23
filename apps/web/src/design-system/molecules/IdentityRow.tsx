import type { ReactNode } from 'react'
import { Avatar } from '../atoms/Avatar'

export function IdentityRow({ name, imageUrl, meta, action, size = 'medium' }: {
  name: string
  imageUrl?: string | null
  meta?: ReactNode
  action?: ReactNode
  size?: 'small' | 'medium' | 'large'
}) {
  return (
    <div className="ds-identity-row">
      <Avatar name={name} src={imageUrl} size={size} decorative />
      <div className="ds-identity-copy"><strong>{name}</strong>{meta ? <span>{meta}</span> : null}</div>
      {action ? <div className="ds-identity-action">{action}</div> : null}
    </div>
  )
}
