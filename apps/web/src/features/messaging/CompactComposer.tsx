import { Send } from 'lucide-react'
import { Button } from '../../design-system/atoms/Button'
import { Textarea } from '../../design-system/atoms/Field'

export function CompactComposer({ value, placeholder = 'Write a message', disabled = false, sending = false, maxLength = 2000, onChange, onSubmit }: {
  value: string
  placeholder?: string
  disabled?: boolean
  sending?: boolean
  maxLength?: number
  onChange: (value: string) => void
  onSubmit: () => void
}) {
  const canSubmit = Boolean(value.trim()) && !disabled && !sending
  return (
    <form className="ds-compact-composer" onSubmit={(event) => { event.preventDefault(); if (canSubmit) onSubmit() }}>
      <Textarea aria-label="Message" rows={1} maxLength={maxLength} value={value} placeholder={placeholder} disabled={disabled} onChange={(event) => onChange(event.currentTarget.value)} />
      <Button type="submit" intent="social" size="small" disabled={!canSubmit} loading={sending} leadingIcon={<Send size={16} aria-hidden="true" />}>Send</Button>
    </form>
  )
}
