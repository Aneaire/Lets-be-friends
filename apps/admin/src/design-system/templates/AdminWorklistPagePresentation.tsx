import { ChevronRight } from 'lucide-react'
import { useState, type Key, type ReactNode } from 'react'
import { Dialog } from '../../../../web/src/design-system/molecules/Dialog'

export function AdminWorklistPagePresentation<Row>({
  eyebrow,
  title,
  description,
  actions,
  filterControls,
  rows,
  getKey,
  renderSummary,
  renderDetails,
  renderDialogActions,
  getDialogTitle,
  getDialogDescription,
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
  renderSummary: (row: Row) => ReactNode
  renderDetails: (row: Row) => ReactNode
  renderDialogActions?: (row: Row) => ReactNode
  getDialogTitle: (row: Row) => string
  getDialogDescription?: (row: Row) => string | undefined
  loading: ReactNode
  empty: ReactNode
  ariaLabel: string
}) {
  const [selectedKey, setSelectedKey] = useState<Key | null>(null)
  const selectedRow = rows?.find((row) => getKey(row) === selectedKey)

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
              <article key={getKey(row)} className="worklist-row admin-worklist-row">
                <button
                  type="button"
                  className="admin-worklist-card"
                  aria-haspopup="dialog"
                  onClick={() => setSelectedKey(getKey(row))}
                >
                  <span className="admin-worklist-summary">{renderSummary(row)}</span>
                  <span className="admin-worklist-disclosure">
                    View details
                    <ChevronRight size={17} aria-hidden="true" />
                  </span>
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      {selectedRow ? (
        <Dialog
          open
          onClose={() => setSelectedKey(null)}
          title={getDialogTitle(selectedRow)}
          description={getDialogDescription?.(selectedRow)}
          size="large"
          className="admin-review-dialog"
          bodyClassName="admin-review-dialog-body"
          footer={renderDialogActions ? (
            <div className="admin-review-dialog-actions">
              {renderDialogActions(selectedRow)}
            </div>
          ) : undefined}
        >
          {renderDetails(selectedRow)}
        </Dialog>
      ) : null}
    </>
  )
}
