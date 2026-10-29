import { ConfirmationDialog } from '@/design-system/molecules/ConfirmationDialog'

import type { memberBlockConfirmationCopy } from './MemberSafetyActionsPresentation'

/**
 * Shared block confirmation so the inline safety actions and the profile
 * overflow menu ask the same question with the same copy.
 */
export function MemberBlockConfirmation({
  confirmation,
  blocked,
  busy,
  visible,
  onClose,
  onConfirm,
}: {
  confirmation: ReturnType<typeof memberBlockConfirmationCopy>
  blocked: boolean
  busy: boolean
  visible: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
}) {
  return (
    <ConfirmationDialog
      visible={visible}
      onClose={onClose}
      onConfirm={onConfirm}
      title={confirmation.title}
      description={confirmation.description}
      confirmLabel={confirmation.confirmLabel}
      busyLabel={blocked ? 'Unblocking member' : 'Blocking member'}
      cancelLabel="Keep current safety setting"
      intent={confirmation.intent}
      busy={busy}
    />
  )
}
