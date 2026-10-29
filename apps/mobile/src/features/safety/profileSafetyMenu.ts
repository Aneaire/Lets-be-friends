import type { AppIconName } from '@/design-system/atoms/AppIcon'

export type ProfileSafetyMenuKind = 'report' | 'mute' | 'block'

export type ProfileSafetyMenuRelationship = {
  blocked: boolean
  muted: boolean
  blockedByOther: boolean
}

export type ProfileSafetyMenuEntry = {
  kind: ProfileSafetyMenuKind
  label: string
  icon: AppIconName
  tone: 'neutral' | 'danger'
  disabled: boolean
}

/**
 * Keeps the profile overflow menu truthful: block and mute mirror the current
 * relationship, and stay disabled until that relationship is known.
 */
export function profileSafetyMenuEntries({ relationship, busy = null, reportTarget = 'profile' }: {
  relationship?: ProfileSafetyMenuRelationship
  busy?: 'block' | 'mute' | null
  reportTarget?: 'profile' | 'member'
}): ProfileSafetyMenuEntry[] {
  const disabled = relationship === undefined || busy !== null
  const muted = Boolean(relationship?.muted)
  const blocked = Boolean(relationship?.blocked)

  return [
    {
      kind: 'report',
      label: reportTarget === 'member' ? 'Report this member' : 'Report this profile',
      icon: 'flag-outline',
      tone: 'danger',
      disabled: busy !== null,
    },
    {
      kind: 'mute',
      label: muted ? 'Unmute' : 'Mute',
      icon: muted ? 'notifications-outline' : 'notifications-off-outline',
      tone: 'neutral',
      disabled,
    },
    {
      kind: 'block',
      label: blocked ? 'Unblock member' : 'Block member',
      icon: blocked ? 'lock-open-outline' : 'ban-outline',
      tone: blocked ? 'neutral' : 'danger',
      disabled,
    },
  ]
}
