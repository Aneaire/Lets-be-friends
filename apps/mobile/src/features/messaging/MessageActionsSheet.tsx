import { ActionSheet, ActionSheetPresentation, type ActionSheetItem } from '@/design-system/molecules/ActionSheet'

export type MessageActionTarget = {
  id: string
  sentByViewer: boolean
  deleted: boolean
  booking: boolean
}

type MessageActionsProps = {
  message: MessageActionTarget | null
  canCompose?: boolean
  onClose: () => void
  onReply: () => void
  onEdit: () => void
  onDelete: () => void
  onUnsend: () => void
  onReport: () => void
}

function messageActionItems({ message, onReply, onEdit, onDelete, onUnsend, onReport, canCompose = true }: Omit<MessageActionsProps, 'onClose'>): ActionSheetItem[] {
  if (!message || message.deleted || message.booking) return []
  return message.sentByViewer
    ? [
        ...(canCompose ? [{ label: 'Reply', icon: 'arrow-undo-outline' as const, tone: 'social' as const, onPress: onReply }] : []),
        ...(canCompose ? [{ label: 'Edit message', icon: 'create-outline' as const, tone: 'self' as const, onPress: onEdit }] : []),
        { label: 'Delete message', icon: 'trash-outline', tone: 'danger', onPress: onDelete },
        { label: 'Unsend message', icon: 'eye-off-outline', tone: 'danger', onPress: onUnsend },
      ]
    : [
        ...(canCompose ? [{ label: 'Reply', icon: 'arrow-undo-outline' as const, tone: 'social' as const, onPress: onReply }] : []),
        { label: 'Report message', icon: 'flag-outline', tone: 'danger', onPress: onReport },
      ]
}

export function MessageActionsSheetPresentation(props: MessageActionsProps) {
  const items = messageActionItems(props)
  if (items.length === 0) return null

  return (
    <ActionSheetPresentation
      title="Message options"
      description={props.message?.sentByViewer
        ? 'Delete keeps a deleted notice. Unsend removes the message for both members.'
        : undefined}
      items={items}
      onClose={props.onClose}
    />
  )
}

export function MessageActionsSheet(props: MessageActionsProps) {
  const items = messageActionItems(props)
  if (items.length === 0) return null

  return (
    <ActionSheet
      visible
      title="Message options"
      description={props.message?.sentByViewer
        ? 'Delete keeps a deleted notice. Unsend removes the message for both members.'
        : undefined}
      items={items}
      onClose={props.onClose}
    />
  )
}
