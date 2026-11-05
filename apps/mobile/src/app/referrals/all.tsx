import { usePaginatedQuery } from 'convex/react'
import { router } from 'expo-router'

import { mobileApi } from '@/backend/client'
import { PageSkeleton } from '@/design-system/templates/PageSkeleton'
import { ReferralState } from '@/features/referral/ReferralState'
import { ReferralsAllView } from '@/features/referral/ReferralsAllView'
import { useMobileMember } from '@/member/MobileMember'

export default function AllReferralsScreen() {
  const member = useMobileMember()
  if (member.status === 'signed_out') {
    return <ReferralState title="Sign in to view referrals" detail="Your referral activity is connected to your member account." action="Sign in" onPress={() => router.replace('/auth')} />
  }
  if (member.status === 'unconfigured') {
    return <ReferralState title="Referrals need account services" detail="This build cannot connect to your member account." action="Return to Profile" onPress={() => router.replace('/profile')} />
  }
  if (member.status === 'unavailable' || member.status === 'error') {
    return <ReferralState title="Referrals are unavailable" detail={member.message} action="Return to Profile" onPress={() => router.replace('/profile')} />
  }
  if (member.status !== 'ready') return <PageSkeleton variant="profile" />
  return <ReadyAllReferrals />
}

function ReadyAllReferrals() {
  const page = usePaginatedQuery(mobileApi.referrals.myReferralPage, {}, { initialNumItems: 20 })

  return (
    <ReferralsAllView
      items={page.results}
      status={page.status}
      onLoadMore={() => page.loadMore(20)}
      onBack={() => router.back()}
    />
  )
}
