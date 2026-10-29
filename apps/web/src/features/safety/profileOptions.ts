export type MemberBlockConfirmation = {
  title: string
  description: string
  confirmLabel: string
  intent: 'neutral' | 'danger'
}

/**
 * Shared block confirmation copy so web and mobile ask the same question in
 * the same words before a member connection changes.
 */
export function memberBlockConfirmationCopy(displayName: string, blocked: boolean): MemberBlockConfirmation {
  return blocked
    ? {
        title: `Unblock ${displayName}?`,
        description: 'They will be able to contact and discover you again.',
        confirmLabel: 'Unblock member',
        intent: 'neutral',
      }
    : {
        title: `Block ${displayName}?`,
        description: 'New messages, bookings, follows, comments, and discovery between you will stop. Existing booking history, messages, reports, and safety records stay available.',
        confirmLabel: 'Block member',
        intent: 'danger',
      }
}
