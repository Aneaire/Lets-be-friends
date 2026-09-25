type MessageWithBooking = {
  booking?: {
    bookingId: string
    status?: string
  } | null
}

export function isActiveBookingStatus(status: string | undefined) {
  return status === 'request_sent' || status === 'accepted'
}

export function bookingMessagePresentation(messages: MessageWithBooking[]) {
  const lastIndexByBookingId = new Map<string, number>()
  let latestBookingIndex = -1

  messages.forEach((message, index) => {
    if (!message.booking) return
    lastIndexByBookingId.set(message.booking.bookingId, index)
    latestBookingIndex = index
  })

  const latestBookingStatus = latestBookingIndex >= 0
    ? messages[latestBookingIndex]?.booking?.status
    : undefined
  const floatingBookingIndex = isActiveBookingStatus(latestBookingStatus)
    ? latestBookingIndex
    : -1

  return { lastIndexByBookingId, floatingBookingIndex, latestBookingStatus }
}

export type BookingThreadEntry<Booking> = {
  booking: Booking
  messageIndex: number
}

export function conversationBookingThread<Booking extends { bookingId: string; status?: string }>(
  messages: Array<{ booking?: Booking | null }>,
): { current?: BookingThreadEntry<Booking>; history: BookingThreadEntry<Booking>[] } {
  const latestByBookingId = new Map<string, BookingThreadEntry<Booking>>()

  messages.forEach((message, messageIndex) => {
    if (!message.booking) return
    latestByBookingId.set(message.booking.bookingId, { booking: message.booking, messageIndex })
  })

  const distinct = [...latestByBookingId.values()].sort((a, b) => b.messageIndex - a.messageIndex)
  const current = distinct.find((entry) => isActiveBookingStatus(entry.booking.status))
  const history = current
    ? distinct.filter((entry) => entry.booking.bookingId !== current.booking.bookingId)
    : distinct

  return { current, history }
}
