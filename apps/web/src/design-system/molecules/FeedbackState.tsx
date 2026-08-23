import type { ReactNode } from 'react'

export function InlineNotice({ tone = 'neutral', title, children }: { tone?: 'neutral' | 'success' | 'warning' | 'danger'; title?: string; children: ReactNode }) {
  return <div className="ds-inline-notice" data-tone={tone} role={tone === 'danger' ? 'alert' : 'status'}>{title ? <strong>{title}</strong> : null}<div>{children}</div></div>
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return <div className="ds-empty-state">{icon}<strong>{title}</strong>{description ? <p>{description}</p> : null}{action ? <div>{action}</div> : null}</div>
}
