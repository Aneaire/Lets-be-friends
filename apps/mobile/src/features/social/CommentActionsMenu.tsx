import { useState } from 'react'

import { IconButton } from '@/design-system/atoms/IconButton'
import { ActionSheet, type ActionSheetItem } from '@/design-system/molecules/ActionSheet'
import { ReportAction } from '@/features/safety/ReportAction'

import { commentActionKind, commentEditError } from './commentActions'
import { EditCommentSheet } from './EditCommentSheet'

export function CommentActionsMenu({ ownComment, commentId, body, onEdit }: {
  ownComment: boolean
  commentId: string
  body: string
  onEdit: (body: string) => Promise<unknown>
}) {
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editBody, setEditBody] = useState(body)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const actionKind = commentActionKind(ownComment)

  function beginEditing() {
    setEditBody(body)
    setError('')
    setEditing(true)
  }

  function beginReporting() {
    setTimeout(() => setReportOpen(true), 220)
  }

  async function saveEdit() {
    if (busy || commentEditError(editBody)) return
    setBusy(true)
    setError('')
    try {
      await onEdit(editBody)
      setEditing(false)
    } catch {
      setError('This comment could not be updated. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const items: ActionSheetItem[] = actionKind === 'edit'
    ? [{ label: 'Edit comment', icon: 'create-outline', tone: 'social', onPress: beginEditing }]
    : [{ label: 'Report comment', icon: 'flag-outline', tone: 'danger', onPress: beginReporting }]

  return (
    <>
      <IconButton
        label="Comment options"
        icon="ellipsis-horizontal"
        disabled={busy}
        onPress={() => setOptionsOpen(true)}
      />
      <ActionSheet
        visible={optionsOpen}
        title={ownComment ? 'Your comment' : 'Comment options'}
        items={items}
        busy={busy}
        onClose={() => setOptionsOpen(false)}
      />
      <EditCommentSheet
        visible={editing}
        body={editBody}
        busy={busy}
        error={error}
        onBodyChange={(value) => { setEditBody(value); setError('') }}
        onSave={() => void saveEdit()}
        onClose={() => { if (!busy) { setEditing(false); setError('') } }}
      />
      {!ownComment ? (
        <ReportAction
          targetType="comment"
          targetId={commentId}
          label="Report comment"
          open={reportOpen}
          onOpenChange={setReportOpen}
          showTrigger={false}
        />
      ) : null}
    </>
  )
}
