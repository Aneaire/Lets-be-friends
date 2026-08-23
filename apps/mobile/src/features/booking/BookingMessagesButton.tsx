import { useQuery } from 'convex/react'
import { router } from 'expo-router'
import { useState } from 'react'

import { mobileApi, type UserId } from '@/backend/client'
import { useAppTheme } from '@/theme/ThemeProvider'

import { ActionButton } from '@/design-system/atoms/ActionButton'
import { AppText } from '@/design-system/atoms/Typography'

export function BookingMessagesButton({ otherUserId }: { otherUserId?: string }) {
  const theme = useAppTheme()
  const conversationId = useQuery(
    mobileApi.conversations.between,
    otherUserId ? { otherUserId: otherUserId as UserId } : 'skip',
  )
  const [message, setMessage] = useState('')
  const loading = Boolean(otherUserId) && conversationId === undefined

  function openConversation() {
    setMessage('')
    if (!otherUserId) {
      setMessage('Messages are unavailable because the other participant could not be identified.')
      return
    }
    if (conversationId === undefined) return
    if (conversationId === null) {
      setMessage('The exact conversation for this booking is not available yet. You can check your Messages inbox.')
      return
    }
    router.push({ pathname: '/conversation/[id]', params: { id: String(conversationId) } })
  }

  return (
    <>
      <ActionButton
        label={loading ? 'Finding conversation' : 'Open Messages'}
        onPress={openConversation}
        disabled={loading || !otherUserId}
      />
      {message ? <AppText accessibilityLiveRegion="polite" variant="caption" color={theme.colors.textMuted}>{message}</AppText> : null}
      {conversationId === null ? <ActionButton label="Open Messages inbox" onPress={() => router.push('/messages')} secondary /> : null}
    </>
  )
}
