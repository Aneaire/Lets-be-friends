import { useQuery } from 'convex/react'

import { useMobileAuth } from '@/auth/MobileAuth'
import { canAccessMemberRoutes } from '@/auth/routeAccess'
import { mobileApi } from '@/backend/client'
import { aggregateUnreadCount } from '@/data/messageViewModels'
import { useMobileMember } from '@/member/MobileMember'

import { AppTabsPresentation } from './AppTabsPresentation'

export default function AppTabs() {
  const auth = useMobileAuth()
  const member = useMobileMember()
  return member.status === 'ready'
    ? <ReadyMemberTabs />
    : <AppTabsPresentation signedIn={canAccessMemberRoutes(auth.status)} />
}

function ReadyMemberTabs() {
  const conversations = useQuery(mobileApi.conversations.list, {})
  return <AppTabsPresentation signedIn unreadCount={conversations ? aggregateUnreadCount(conversations) : 0} />
}
