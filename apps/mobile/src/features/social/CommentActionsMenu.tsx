import { useState } from 'react'
import { Alert } from 'react-native'

import { IconButton } from '@/design-system/atoms/IconButton'
import { AppText } from '@/design-system/atoms/Typography'
import { ActionSheet, type ActionSheetItem } from '@/design-system/molecules/ActionSheet'
import { ReportAction } from '@/features/safety/ReportAction'

import { commentDeleteDialog, commentEditError, commentMenuActions } from './commentActions'
import { EditCommentSheet } from './EditCommentSheet'
import { useAppTheme } from '@/theme/ThemeProvider'

export function CommentActionsMenu({ ownComment, commentId, body, onEdit, onDelete }: {
  ownComment: boolean
  commentId: string
  body: string
  onEdit: (body: string) => Promise<unknown>
  onDelete?: () => Promise<unknown>
}) {
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editBody, setEditBody] = useState(body)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const theme = useAppTheme()
  const menuActions = commentMenuActions(ownComment)
  const canDelete = ownComment && onDelete !== undefined

  function beginEditing() {
    setEditBody(body)
    setError('')
    setEditing(true)
  }

  function beginReporting() {
    setTimeout(() => setReportOpen(true), 220)
  }

  function confirmDelete() {
    setOptionsOpen(false)
    setTimeout(() => {
      Alert.alert(commentDeleteDialog.title, commentDeleteDialog.body, [
        { text: commentDeleteDialog.cancelLabel, style: 'cancel' },
        {
          text: commentDeleteDialog.confirmLabel,
          style: 'destructive',
          onPress: () => void deleteComment(),
        },
      ])
    }, 220)
  }

  async function deleteComment() {
    if (!onDelete || deleting) return
    setDeleting(true)
    setError('')
    try {
      await onDelete()
    } catch {
      setError('This comment could not be deleted. Please try again.')
    } finally {
      setDeleting(false)
    }
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

  const items: ActionSheetItem[] = menuActions.flatMap((action): ActionSheetItem[] => {
    if (action === 'edit') return [{ label: 'Edit comment', icon: 'create-outline', tone: 'self', onPress: beginEditing }]
    if (action === 'delete' && canDelete) return [{ label: 'Delete comment', icon: 'trash-outline', tone: 'danger', onPress: confirmDelete }]
    if (action === 'report') return [{ label: 'Report comment', icon: 'flag-outline', tone: 'danger', onPress: beginReporting }]
    return []
  })

  return (
    <>
      <IconButton
        label="Comment options"
        icon="ellipsis-horizontal"
        disabled={busy || deleting}
        onPress={() => setOptionsOpen(true)}
      />
      <ActionSheet
        visible={optionsOpen}
        title={ownComment ? 'Your comment' : 'Comment options'}
        items={items}
        busy={busy || deleting}
        onClose={() => setOptionsOpen(false)}
      />
      {!editing && error ? <AppText accessibilityRole="alert" variant="caption" color={theme.colors.danger}>{error}</AppText> : null}
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
