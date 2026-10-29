import { useState } from 'react'

import { IconButton } from '@/design-system/atoms/IconButton'
import { ActionSheet, type ActionSheetItem } from '@/design-system/molecules/ActionSheet'

import { MemberBlockConfirmation } from './MemberSafetyConfirmation'
import { ReportAction } from './ReportAction'
import {
  profileSafetyMenuEntries,
  type ProfileSafetyMenuKind,
  type ProfileSafetyMenuRelationship,
} from './profileSafetyMenu'
import { useMemberSafetyControls } from './useMemberSafetyControls'

/**
 * Compact profile options: report, mute, and block live behind the header
 * overflow menu instead of trailing buttons at the end of the profile.
 */
export function ProfileSafetyMenu({ profileId, userId, displayName, reportTarget = 'profile', onNotice }: {
  profileId: string
  userId: string
  displayName: string
  /** Member screens report a member instead of a Companion profile. */
  reportTarget?: 'profile' | 'member'
  onNotice?: (message: string) => void
}) {
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const safety = useMemberSafetyControls({ userId, displayName, onNotice })
  const relationship: ProfileSafetyMenuRelationship | undefined = safety.relationship
  const entries = profileSafetyMenuEntries({ relationship, busy: safety.busy, reportTarget })

  function beginReporting() {
    setTimeout(() => setReportOpen(true), 220)
  }

  function beginBlockChange() {
    setTimeout(() => safety.requestBlockChange(), 220)
  }

  function run(kind: ProfileSafetyMenuKind) {
    if (kind === 'report') beginReporting()
    else if (kind === 'mute') safety.toggleMute()
    else beginBlockChange()
  }

  const items: ActionSheetItem[] = entries.map((entry) => ({
    label: entry.label,
    icon: entry.icon,
    tone: entry.tone,
    disabled: entry.disabled,
    onPress: () => run(entry.kind),
  }))

  return (
    <>
      <IconButton
        label={`${displayName} profile options`}
        icon="ellipsis-horizontal"
        onPress={() => setOptionsOpen(true)}
      />
      <ActionSheet
        visible={optionsOpen}
        title="Profile options"
        items={items}
        busy={safety.busy !== null}
        onClose={() => setOptionsOpen(false)}
      />
      <ReportAction
        targetType={reportTarget === 'member' ? 'user' : 'profile'}
        targetId={profileId}
        label="Report this profile"
        open={reportOpen}
        onOpenChange={setReportOpen}
        showTrigger={false}
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
