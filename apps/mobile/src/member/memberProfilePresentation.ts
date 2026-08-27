export function memberSafetyDisclosure(expanded: boolean) {
  return {
    label: 'Safety and privacy',
    hint: expanded ? 'Hide safety actions' : 'Show report, mute, and block actions',
    icon: expanded ? 'chevron-up' as const : 'chevron-down' as const,
  }
}
