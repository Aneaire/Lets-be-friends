export type ReferralRowItem = {
  _id: string
  referredDisplayName: string
  status: string
  rewardedBookings: number
  totalRewardedBookings: number
}

export function ReferralRow({ item }: { item: ReferralRowItem }) {
  return (
    <li className="flex items-center justify-between gap-3 border-t border-[color:var(--rule)] pt-2 first:border-t-0 first:pt-0">
      <div>
        <p className="text-body">{item.referredDisplayName}</p>
        <p className="text-meta">{item.rewardedBookings} of {item.totalRewardedBookings} bookings rewarded</p>
      </div>
      <span className="status-pill" data-tone={item.status === 'completed' ? 'success' : 'social'}>
        {item.status === 'completed' ? 'complete' : item.status}
      </span>
    </li>
  )
}
