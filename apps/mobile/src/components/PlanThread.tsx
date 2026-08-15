import { StyleSheet, View } from 'react-native'

import { buildPlanThread } from '@/data/planThread'
import { useAppTheme } from '@/theme/ThemeProvider'

import { AppIcon } from './AppIcon'
import { AppText } from './Typography'

export function PlanThread(props: Parameters<typeof buildPlanThread>[0]) {
  const theme = useAppTheme()
  const steps = buildPlanThread(props)
  return <View accessibilityLabel="Plan Thread" style={[styles.container, { borderColor: theme.colors.border }]}><View style={styles.heading}><AppIcon name="git-branch-outline" color={theme.colors.socialText} /><View><AppText variant="heading">Plan Thread</AppText><AppText variant="caption" color={theme.colors.textMuted}>From first request to shared reflection</AppText></View></View><View style={styles.steps}>{steps.map((step, index) => <View key={step.key} style={styles.step}>{index < steps.length - 1 ? <View style={[styles.line, { backgroundColor: step.state === 'done' ? theme.colors.social : theme.colors.border }]} /> : null}<View style={[styles.dot, { borderColor: step.state === 'stopped' ? theme.colors.danger : step.state === 'upcoming' ? theme.colors.borderStrong : theme.colors.social, backgroundColor: step.state === 'done' ? theme.colors.social : theme.colors.background }]}>{step.state === 'done' ? <AppIcon name="checkmark" color={theme.colors.accentText} size={12} /> : null}</View><View style={styles.copy}><AppText variant="bodyStrong" color={step.state === 'stopped' ? theme.colors.danger : theme.colors.text}>{step.title}</AppText><AppText variant="caption" color={theme.colors.textMuted}>{step.detail}</AppText></View></View>)}</View></View>
}

const styles = StyleSheet.create({
  container: { borderWidth: 1, borderRadius: 20, padding: 16, gap: 18 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  steps: { gap: 0 },
  step: { minHeight: 66, flexDirection: 'row', gap: 12, position: 'relative' },
  line: { position: 'absolute', left: 10, top: 23, bottom: -2, width: 2 },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  copy: { flex: 1, gap: 2, paddingBottom: 14 },
})
