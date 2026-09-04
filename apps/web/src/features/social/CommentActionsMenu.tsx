import { Flag, Pencil, Trash2 } from 'lucide-react'
import {
  ActionMenu,
  type ActionMenuItem,
} from '../../design-system/molecules/ActionMenu'

type CommentActionsMenuProps = {
  ownedByViewer: boolean
  disabled?: boolean
  onEdit?: () => void
  onDelete?: () => void
  onReport?: () => void
}

export function CommentActionsMenu({
  ownedByViewer,
  disabled = false,
  onEdit,
  onDelete,
  onReport,
}: CommentActionsMenuProps) {
  const items: ActionMenuItem[] = []

  if (ownedByViewer) {
    if (onEdit) {
      items.push({
        label: 'Edit comment',
        icon: <Pencil size={16} aria-hidden="true" />,
        tone: 'self',
        onSelect: onEdit,
      })
    }
    if (onDelete) {
      items.push({
        label: 'Delete comment',
        icon: <Trash2 size={16} aria-hidden="true" />,
        tone: 'danger',
        onSelect: onDelete,
      })
    }
  } else if (!ownedByViewer && onReport) {
    items.push({
      label: 'Report comment',
      icon: <Flag size={16} aria-hidden="true" />,
      tone: 'danger',
      onSelect: onReport,
    })
  }

  if (items.length === 0) return null

  return (
    <ActionMenu
      label="Comment options"
      items={items}
      disabled={disabled}
    />
  )
}
