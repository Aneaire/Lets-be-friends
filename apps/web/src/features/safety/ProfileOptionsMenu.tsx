import { useMutation, useQuery } from 'convex/react'
import { Ban, Bell, BellOff, Bookmark, Flag, Heart, LockOpen } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { ActionMenu, type ActionMenuItem } from '../../design-system/molecules/ActionMenu'
import { ConfirmationDialog } from '../../design-system/molecules/Dialog'
import { describeConvexError } from '../../lib/convexErrors'
import { memberBlockConfirmationCopy } from './profileOptions'

type ProfileOptionsMenuProps = {
  userId: Id<'users'>
  displayName: string
  following: boolean
  saved: boolean
  onToggleFollow: () => void | Promise<void>
  onToggleSave: () => void | Promise<void>
  onReport: () => void | Promise<void>
  onNotice: (message: string) => void
  onError: (message: string) => void
}

/**
 * Secondary profile actions live behind one overflow menu so the profile keeps
 * a short action list. Safety changes stay inside the same menu as reporting.
 */
export function ProfileOptionsMenu({
  userId,
  displayName,
  following,
  saved,
  onToggleFollow,
  onToggleSave,
  onReport,
  onNotice,
  onError,
}: ProfileOptionsMenuProps) {
  const relationship = useQuery(api.safety.relationship, { userId })
  const setMuted = useMutation(api.safety.setMuted)
  const setBlocked = useMutation(api.safety.setBlocked)
  const [busy, setBusy] = useState<'mute' | 'block' | null>(null)
  const [blockOpen, setBlockOpen] = useState(false)
  const [blockError, setBlockError] = useState('')
  const muted = Boolean(relationship?.muted)
  const blocked = Boolean(relationship?.blocked)
  const safetyDisabled = relationship === undefined || busy !== null
  const confirmation = memberBlockConfirmationCopy(displayName, blocked)

  function reportError(error: unknown, fallback: string) {
    onError(error instanceof Error ? describeConvexError(error) : fallback)
  }

  async function toggleMute() {
    if (relationship === undefined || busy !== null) return
    setBusy('mute')
    try {
      await setMuted({ userId, muted: !relationship.muted })
      onNotice(relationship.muted ? `Notifications from ${displayName} are back on.` : `${displayName} is muted. Their posts are hidden and their notifications stopped.`)
    } catch (error) {
      reportError(error, 'The safety setting could not be updated.')
    } finally {
      setBusy(null)
    }
  }

  async function confirmBlockChange() {
    if (relationship === undefined || busy !== null) return
    setBusy('block')
    setBlockError('')
    try {
      await setBlocked({ userId, blocked: !relationship.blocked })
      onNotice(relationship.blocked ? `${displayName} is unblocked.` : `${displayName} is blocked.`)
      setBlockOpen(false)
    } catch (error) {
      setBlockError(error instanceof Error ? describeConvexError(error) : 'The safety setting could not be updated.')
    } finally {
      setBusy(null)
    }
  }

  const items: ActionMenuItem[] = [
    {
      label: following ? 'Unfollow' : 'Follow',
      icon: <Heart size={16} fill={following ? 'currentColor' : 'none'} aria-hidden="true" />,
      onSelect: () => void onToggleFollow(),
    },
    {
      label: saved ? 'Remove from saved' : 'Save profile',
      icon: <Bookmark size={16} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />,
      onSelect: () => void onToggleSave(),
    },
    {
      label: muted ? 'Unmute' : 'Mute',
      icon: muted ? <Bell size={16} aria-hidden="true" /> : <BellOff size={16} aria-hidden="true" />,
      disabled: safetyDisabled,
      onSelect: () => void toggleMute(),
    },
    {
      label: blocked ? 'Unblock member' : 'Block member',
      icon: blocked ? <LockOpen size={16} aria-hidden="true" /> : <Ban size={16} aria-hidden="true" />,
      tone: blocked ? 'neutral' : 'danger',
      disabled: safetyDisabled,
      onSelect: () => { setBlockError(''); setBlockOpen(true) },
    },
    {
      label: 'Report this profile',
      icon: <Flag size={16} aria-hidden="true" />,
      tone: 'danger',
      onSelect: () => void onReport(),
    },
  ]

  return (
    <>
      <ActionMenu label={`${displayName} profile options`} panelLabel="Profile options" items={items} disabled={busy !== null} />
      <ConfirmationDialog
        open={blockOpen}
        onClose={() => { if (busy === null) setBlockOpen(false) }}
        onConfirm={confirmBlockChange}
        title={confirmation.title}
        description={confirmation.description}
        confirmLabel={confirmation.confirmLabel}
        cancelLabel="Keep current safety setting"
        intent={confirmation.intent}
        busy={busy === 'block'}
      >
        {blockError ? <div className="notice notice-danger text-meta" role="alert">{blockError}</div> : null}
      </ConfirmationDialog>
    </>
  )
}
