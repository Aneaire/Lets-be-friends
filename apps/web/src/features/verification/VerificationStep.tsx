import { Check } from 'lucide-react'
import type { ReactNode } from 'react'

export function VerificationStep({
  step,
  title,
  icon,
  completed,
  headingId,
  status,
  children,
}: {
  step: number
  title: string
  icon: ReactNode
  completed: boolean
  headingId: string
  status?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="verification-step" data-complete={completed} aria-labelledby={headingId}>
      <div className="verification-step-marker" aria-hidden="true">
        {completed ? <Check size={20} /> : <span>{step}</span>}
      </div>
      <div className="verification-step-body">
        <div className="verification-step-heading">
          <div className="verification-step-title">
            {icon}
            <h2 id={headingId} className="text-h2">{title}</h2>
          </div>
          {status}
        </div>
        {children}
      </div>
    </section>
  )
}
