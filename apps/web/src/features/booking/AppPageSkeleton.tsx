import { WorkspaceShell } from '../../design-system/templates/WorkspaceShell'

const CALENDAR_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const CALENDAR_CELL_COUNT = 42

function RailSection({ rows, withCounts = false }: { rows: number; withCounts?: boolean }) {
  return (
    <div className="rail-section">
      <div className="rail-section-title">
        <span className="skeleton skeleton-line app-page-skeleton-rail-title" />
      </div>
      {Array.from({ length: rows }, (_, index) => (
        <span key={index} className="rail-link">
          <span className="skeleton skeleton-line app-page-skeleton-rail-label" />
          {withCounts && <span className="skeleton app-page-skeleton-count" />}
        </span>
      ))}
    </div>
  )
}

export function BookingsViewSkeleton() {
  return (
    <div className="booking-views">
      <div className="booking-view-switcher">
        {[0, 1].map((index) => (
          <span key={index} className="booking-view-switch">
            <span className="skeleton skeleton-line app-page-skeleton-switch-label" />
          </span>
        ))}
      </div>
      <div className="booking-calendar-layout">
        <section className="booking-calendar-panel">
          <header className="booking-calendar-header">
            <div>
              <span className="skeleton skeleton-line app-page-skeleton-eyebrow" />
              <span className="skeleton skeleton-line app-page-skeleton-month" />
            </div>
            <div className="booking-calendar-navigation">
              {[0, 1, 2].map((index) => (
                <span key={index} className="skeleton app-page-skeleton-nav-button" />
              ))}
            </div>
          </header>
          <div className="booking-calendar-grid">
            {CALENDAR_WEEKDAYS.map((weekday) => (
              <div key={weekday} className="booking-calendar-weekday">
                <span className="skeleton skeleton-line app-page-skeleton-weekday" />
              </div>
            ))}
            {Array.from({ length: CALENDAR_CELL_COUNT }, (_, index) => (
              <div key={index} className="booking-calendar-day">
                <span className="skeleton skeleton-line app-page-skeleton-day-number" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

export function AppPageSkeleton() {
  return (
    <div className="app-page-skeleton">
      <p className="sr-only" role="status">Loading your bookings.</p>
      <div aria-hidden="true">
        <WorkspaceShell
          variant="bookings"
          title={<span className="skeleton skeleton-line app-page-skeleton-title" />}
          status={
            <span className="workspace-status-item app-page-skeleton-status">
              <span className="skeleton skeleton-line app-page-skeleton-status-label" />
              <span className="skeleton app-page-skeleton-pill" />
            </span>
          }
          actions={<span className="skeleton skeleton-button app-page-skeleton-action" />}
          mobileNavigation={
            <>
              {[0, 1].map((index) => (
                <span key={index} className="workspace-mobile-nav-link">
                  <span className="skeleton skeleton-line app-page-skeleton-mobile-label" />
                  <span className="skeleton app-page-skeleton-count" />
                </span>
              ))}
            </>
          }
          rail={
            <>
              <RailSection rows={2} withCounts />
              <RailSection rows={2} />
            </>
          }>
          <section>
            <header className="flex items-baseline justify-between gap-3 mb-3">
              <span className="skeleton skeleton-line app-page-skeleton-section-title" />
              <div className="flex items-center gap-2">
                <span className="skeleton skeleton-line app-page-skeleton-count-label" />
                <span className="skeleton skeleton-button app-page-skeleton-balance" />
              </div>
            </header>
            <BookingsViewSkeleton />
          </section>
        </WorkspaceShell>
      </div>
    </div>
  )
}
