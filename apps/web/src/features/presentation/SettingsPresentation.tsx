import { cloneElement, type ReactElement, type ReactNode } from 'react'

export type SettingsLinkElementProps = {
  className?: string
  children?: ReactNode
}

export function SettingsSection({
  headingId,
  title,
  description,
  children,
}: {
  headingId: string
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="settings-section" aria-labelledby={headingId}>
      <div className="settings-section-heading">
        <div>
          <h2 id={headingId} className="text-h2">{title}</h2>
          <p className="text-meta mt-1">{description}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

export function SettingsLinkRow({
  link,
  icon,
  title,
  description,
  actionLabel,
}: {
  link: ReactElement<SettingsLinkElementProps>
  icon: ReactNode
  title: string
  description: ReactNode
  actionLabel: string
}) {
  return cloneElement(
    link,
    { className: 'settings-link-row' },
    icon,
    <span key="copy" className="settings-row-copy">
      <strong>{title}</strong>
      <span>{description}</span>
    </span>,
    <span key="action" className="settings-link-action">{actionLabel}</span>,
  )
}
