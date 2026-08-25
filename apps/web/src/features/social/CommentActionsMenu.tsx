import { Flag, Pencil } from 'lucide-react'
import {
  ActionMenu,
  type ActionMenuItem,
} from '../../design-system/molecules/ActionMenu'

type CommentActionsMenuProps = {
  ownedByViewer: boolean
  disabled?: boolean
  onEdit?: () => void
  onReport?: () => void
}

export function CommentActionsMenu({
  ownedByViewer,
  disabled = false,
  onEdit,
  onReport,
}: CommentActionsMenuProps) {
  const items: ActionMenuItem[] = []

  if (ownedByViewer && onEdit) {
    items.push({
      label: 'Edit comment',
      icon: <Pencil size={16} aria-hidden="true" />,
      tone: 'self',
      onSelect: onEdit,
    })
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
