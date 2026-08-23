import { cloneElement, useId, type ReactElement } from 'react'

export function FormField({ label, optional, hint, error, children }: {
  label: string
  optional?: boolean
  hint?: string
  error?: string
  children: ReactElement<{ id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }>
}) {
  const generatedId = useId()
  const fieldId = children.props.id ?? generatedId
  const helpId = `${fieldId}-help`
  return (
    <div className="field-row" data-invalid={Boolean(error) || undefined}>
      <label className="label" htmlFor={fieldId}>{label}{optional ? <span className="label-aux">Optional</span> : null}</label>
      {cloneElement(children, { id: fieldId, 'aria-invalid': Boolean(error) || undefined, 'aria-describedby': hint || error ? helpId : undefined })}
      {hint || error ? <span id={helpId} className="field-row-help" role={error ? 'alert' : undefined}>{error ?? hint}</span> : null}
    </div>
  )
}
