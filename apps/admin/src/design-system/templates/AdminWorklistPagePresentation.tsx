import type { Key, ReactNode } from 'react'

export function AdminWorklistPagePresentation<Row>({
  eyebrow,
  title,
  description,
  actions,
  filterControls,
  rows,
  getKey,
  renderRecord,
  loading,
  empty,
  ariaLabel,
}: {
  eyebrow: ReactNode
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  filterControls?: ReactNode
  rows: readonly Row[] | undefined
  getKey: (row: Row) => Key
  renderRecord: (row: Row) => ReactNode
  loading: ReactNode
  empty: ReactNode
  ariaLabel: string
}) {
  return (
    <>
      <header className="admin-page-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="text-h1 mt-2">{title}</h1>
          {description ? <p className="lede mt-2">{description}</p> : null}
        </div>
        {actions ? <div className="admin-page-header-actions">{actions}</div> : null}
      </header>

      {filterControls ? (
        <div className="admin-filter-row" aria-label={`${ariaLabel} filters`}>
          {filterControls}
        </div>
      ) : null}

      {rows === undefined ? (
        <div className="admin-empty" role="status">{loading}</div>
      ) : rows.length === 0 ? (
        <div className="admin-empty">{empty}</div>
      ) : (
        <section className="panel" aria-label={ariaLabel}>
          <div className="worklist">
            {rows.map((row) => (
              <article key={getKey(row)} className="worklist-row">
                {renderRecord(row)}
              </article>
            ))}
          </div>
        </section>
      )}
    </>
  )
}
