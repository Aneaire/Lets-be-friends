import { cloneElement, useId, type ReactElement, type ReactNode } from 'react'

export function FormField({ label, optional, aux, hint, error, className = '', children }: {
  label: string
  optional?: boolean
  aux?: ReactNode
  hint?: string
  error?: string
  className?: string
  children: ReactElement<{ id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }>
}) {
  const generatedId = useId()
  const fieldId = children.props.id ?? generatedId
  const helpId = `${fieldId}-help`
  return (
    <div className={`field-row ${className}`.trim()} data-invalid={Boolean(error) || undefined}>
      <label className="label" htmlFor={fieldId}>
        {label}
        {optional ? <span className="label-aux">Optional</span> : null}
        {aux ? <span className="label-aux">{aux}</span> : null}
      </label>
      {cloneElement(children, { id: fieldId, 'aria-invalid': Boolean(error) || undefined, 'aria-describedby': hint || error ? helpId : undefined })}
      {hint || error ? <span id={helpId} className="field-row-help" role={error ? 'alert' : undefined}>{error ?? hint}</span> : null}
    </div>
  )
}
