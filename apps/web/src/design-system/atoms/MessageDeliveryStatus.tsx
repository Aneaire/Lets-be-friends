import { Circle, CircleCheck } from 'lucide-react'

export function MessageDeliveryStatus({ state }: { state: 'sending' | 'sent' }) {
  const label = state === 'sent' ? 'Message sent' : 'Sending message'

  return (
    <span className="ds-message-delivery" data-state={state} role="img" aria-label={label} title={label}>
      {state === 'sent'
        ? <CircleCheck size={13} strokeWidth={2.2} aria-hidden="true" />
        : <Circle size={13} strokeWidth={2.2} aria-hidden="true" />}
    </span>
  )
}
