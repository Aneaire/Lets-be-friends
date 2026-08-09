type MessageWithBooking = {
  booking?: {
    bookingId: string
    status?: string
  } | null
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
  const floatingBookingIndex = latestBookingStatus === 'request_sent' || latestBookingStatus === 'accepted'
    ? latestBookingIndex
    : -1

  return { lastIndexByBookingId, floatingBookingIndex, latestBookingStatus }
}
