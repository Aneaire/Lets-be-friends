import { StyleSheet } from 'react-native'

import { StateView } from '@/design-system/molecules/StateView'
import { Screen } from '@/design-system/templates/Screen'

export function ReferralState({
  title,
  detail,
  action,
  onPress,
}: {
  title: string
  detail?: string
  action?: string
  onPress?: () => void
}) {
  return (
    <Screen scroll={false} contentStyle={styles.state}>
      <StateView
        eyebrow="INVITE FRIENDS"
        title={title}
        detail={detail}
        actionLabel={action}
        onAction={onPress}
        intent="social"
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  state: { paddingHorizontal: 16 },
})
