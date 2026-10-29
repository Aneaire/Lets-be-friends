import {
  MemberSafetyActionsPresentation,
} from './MemberSafetyActionsPresentation'
import { MemberBlockConfirmation } from './MemberSafetyConfirmation'
import { useMemberSafetyControls } from './useMemberSafetyControls'

export function MemberSafetyActions({
  userId,
  displayName,
}: {
  userId: string
  displayName: string
}) {
  const safety = useMemberSafetyControls({ userId, displayName })

  return (
    <>
      <MemberSafetyActionsPresentation
        relationship={safety.relationship}
        busy={safety.busy}
        message={safety.message}
        onToggleMute={safety.toggleMute}
        onChangeBlock={safety.requestBlockChange}
      />
      <MemberBlockConfirmation
        confirmation={safety.confirmation}
        blocked={safety.blocked}
        busy={safety.busy === 'block'}
        visible={safety.confirmationOpen}
        onClose={safety.closeConfirmation}
        onConfirm={safety.confirmBlockChange}
      />
    </>
  )
}
