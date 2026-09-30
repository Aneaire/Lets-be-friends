import { useMutation, useQuery } from 'convex/react'
import { useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { mobileApi, type BookingId } from '@/backend/client'
import { ActionButton } from '@/design-system/atoms/ActionButton'
import { AppText } from '@/design-system/atoms/Typography'
import { useAppToastMessage } from '@/design-system/molecules/AppToast'
import { CompactComposer } from '@/features/messaging/CompactComposer'
import { MessageBubble } from '@/features/messaging/MessageBubble'
import { TrustThread } from '@/features/booking/TrustThread'
import {
  bookingChatAvailability,
  buildTrustThreadItems,
  validateBookingMessageBody,
} from '@/data/bookingMessages'
import { formatMessageTimestamp, messageCounter } from '@/data/messageViewModels'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'
import type { BookingStatus } from '@lets-be-friends/shared'

export function BookingThread({
  bookingId,
  status,
  memberCompletedAt,
  companionCompletedAt,
  otherName = 'Member',
}: {
  bookingId: BookingId
  status: BookingStatus
  memberCompletedAt?: number
  companionCompletedAt?: number
  otherName?: string
}) {
  const theme = useAppTheme()
  const availability = bookingChatAvailability(status)
  const messages = useQuery(mobileApi.bookings.messages, availability.canRead ? { bookingId } : 'skip')
  const sendMessage = useMutation(mobileApi.bookings.sendMessage)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  useAppToastMessage(error)
  const sendingRef = useRef(false)
  const counter = messageCounter(body)
  const trustItems = buildTrustThreadItems({ status, memberCompletedAt, companionCompletedAt })

  async function send() {
    if (sendingRef.current) return
    const validated = validateBookingMessageBody(body)
    if (!validated.ok) {
      setError(validated.message)
      return
    }
    if (counter.overLimit) {
      setError(`Messages can be up to 2,000 characters.`)
      return
    }
    sendingRef.current = true
    setSending(true)
    setError('')
    try {
      await sendMessage({ bookingId, body: validated.body })
      setBody('')
    } catch {
      setError('Your booking message could not be sent. Please try again.')
    } finally {
      sendingRef.current = false
      setSending(false)
    }
  }

  return (
    <View accessibilityLabel="Booking messages" style={[styles.container, { borderColor: theme.colors.border }]}>
      <TrustThread items={trustItems} />
      {!messages ? (
        <AppText color={theme.colors.textMuted}>Loading booking messages.</AppText>
      ) : messages.length === 0 ? (
        <AppText color={theme.colors.textMuted}>{availability.emptyCopy}</AppText>
      ) : (
        <View style={styles.messages}>
          {messages.map((message) => (
            <MessageBubble
              key={String(message._id)}
              direction={message.sentByViewer ? 'outgoing' : 'incoming'}
              authorName={message.senderDisplayName ?? otherName}
              body={message.body}
              timestamp={formatMessageTimestamp(message.createdAt)}
            />
          ))}
        </View>
      )}
      {availability.canSend ? (
        <View style={styles.composer}>
          <CompactComposer
            value={body}
            placeholder="Message about this booking"
            maxLength={2_100}
            sending={sending}
            disabled={counter.overLimit}
            canSubmit={Boolean(body.trim()) && !counter.overLimit && !sending}
            onChange={(value) => { setBody(value); setError('') }}
            onSubmit={() => void send()}
            hint="Keep plans and important context in this booking thread."
          />
          <AppText variant="caption" color={counter.overLimit ? theme.colors.danger : theme.colors.textMuted}>
            {counter.count.toLocaleString()}/2,000 characters
          </AppText>
        </View>
      ) : (
        <AppText color={theme.colors.textMuted}>{availability.lockedCopy}</AppText>
      )}
    </View>
  )
}

export function BookingThreadFallback({ onOpenInbox }: { onOpenInbox: () => void }) {
  return (
    <View style={styles.fallback}>
      <AppText variant="caption">The exact conversation for this booking is not available yet. You can check your Messages inbox.</AppText>
      <ActionButton label="Open Messages inbox" onPress={onOpenInbox} secondary />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 16,
    padding: density.cardPadding,
    gap: density.cardGap,
  },
  messages: {
    gap: density.cardGap,
  },
  composer: {
    gap: density.textStackGap,
  },
  fallback: {
    gap: density.cardGap,
  },
})
