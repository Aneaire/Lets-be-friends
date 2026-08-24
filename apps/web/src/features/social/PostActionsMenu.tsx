import { Flag, Pencil, Trash2 } from 'lucide-react'
import { ActionMenu, type ActionMenuItem } from '../../design-system/molecules/ActionMenu'

type PostActionsMenuProps = {
  ownedByViewer: boolean
  disabled?: boolean
  onEdit?: () => void
  onDelete?: () => void
  onReport?: () => void
}

export function PostActionsMenu({ ownedByViewer, disabled = false, onEdit, onDelete, onReport }: PostActionsMenuProps) {
  const items: ActionMenuItem[] = []

  if (ownedByViewer) {
    if (onEdit) items.push({ label: 'Edit post', icon: <Pencil size={16} aria-hidden="true" />, tone: 'self', onSelect: onEdit })
    if (onDelete) items.push({ label: 'Delete post', icon: <Trash2 size={16} aria-hidden="true" />, tone: 'danger', onSelect: onDelete })
  } else if (onReport) {
    items.push({ label: 'Report post', icon: <Flag size={16} aria-hidden="true" />, tone: 'danger', onSelect: onReport })
  }

  if (items.length === 0) return null

  return <ActionMenu label="Post options" items={items} disabled={disabled} />
}
