import { usePaginatedQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { Button } from '../../design-system/atoms/Button'
import { Dialog } from '../../design-system/molecules/Dialog'
import { ReferralRow } from './ReferralRow'

export function ReferralListDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const page = usePaginatedQuery(
    api.referrals.myReferralPage,
    open ? {} : 'skip',
    { initialNumItems: 10 },
  )

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="All referrals"
      description="Friends who joined with your link."
      size="medium"
      footer={<Button intent="ghost" onClick={onClose}>Close</Button>}
    >
      {page.status === 'LoadingFirstPage' ? (
        <p className="text-meta">Loading referrals...</p>
      ) : page.results.length === 0 ? (
        <p className="text-meta">No friends have joined with your link yet.</p>
      ) : (
        <div className="space-y-3">
          <ul className="space-y-2">
            {page.results.map((item) => <ReferralRow key={item._id} item={item} />)}
          </ul>
          {page.status === 'CanLoadMore' && (
            <Button intent="ghost" size="small" onClick={() => page.loadMore(10)}>
              Load more
            </Button>
          )}
          {page.status === 'LoadingMore' && <p className="text-meta">Loading more...</p>}
        </div>
      )}
    </Dialog>
  )
}
