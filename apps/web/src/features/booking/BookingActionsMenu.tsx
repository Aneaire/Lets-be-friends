import { ActionMenu, type ActionMenuItem } from '../../design-system/molecules/ActionMenu'

type BookingActionsMenuProps = {
  onCancel?: () => void
  onEditRequest?: () => void
  onReport: () => void
}

export function BookingActionsMenu({ onCancel, onEditRequest, onReport }: BookingActionsMenuProps) {
  const items: ActionMenuItem[] = []
  if (onCancel) items.push({ label: 'Cancel booking', tone: 'danger', onSelect: onCancel })
  if (onEditRequest) items.push({ label: 'Edit request', tone: 'social', onSelect: onEditRequest })
  items.push({ label: 'Report', tone: 'danger', onSelect: onReport })

  return <ActionMenu label="More booking actions" panelLabel="Booking actions" items={items} />
}
