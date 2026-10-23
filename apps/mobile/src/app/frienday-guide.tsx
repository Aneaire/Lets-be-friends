import { router } from 'expo-router'
import { StyleSheet, View } from 'react-native'

import {
  friendayCheckins,
  friendayNotAllowed,
  friendayPromise,
  friendaySafetyGroups,
  friendaySteps,
} from '@lets-be-friends/shared'

import { ActionButton } from '@/design-system/atoms/ActionButton'
import { AppText } from '@/design-system/atoms/Typography'
import { AppHeader } from '@/design-system/molecules/AppHeader'
import { Screen, Section } from '@/design-system/templates/Screen'
import { density, radii } from '@/theme/tokens'
import { useAppTheme } from '@/theme/ThemeProvider'

export default function FriendayGuideScreen() {
  const theme = useAppTheme()

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader
        title="Frienday guide"
        back
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      />

      <Section style={styles.intro}>
        <AppText variant="label" color={theme.colors.socialText}>THE AGREEMENT</AppText>
        <AppText variant="title">How a Frienday works</AppText>
        <AppText color={theme.colors.textMuted}>
          A Frienday is the agreed time when a Companion and a member meet and complete a booked activity. The Companion offers help and the member books help.
        </AppText>
      </Section>

      <Section>
        <AppText variant="heading">Step by step</AppText>
        {friendaySteps.map((step, index) => (
          <View key={step.title} style={[styles.step, { borderColor: theme.colors.border }]}>
            <AppText variant="label" color={theme.colors.socialText}>{String(index + 1).padStart(2, '0')}</AppText>
            <View style={styles.stepCopy}>
              <AppText variant="bodyStrong">{step.title}</AppText>
              <AppText color={theme.colors.textMuted}>{step.body}</AppText>
            </View>
          </View>
        ))}
      </Section>

      <Section>
        <AppText variant="heading">Optional check-in photos</AppText>
        {friendayCheckins.map((checkin) => (
          <View key={checkin.title} style={[styles.panel, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
            <AppText variant="bodyStrong">{checkin.title}</AppText>
            <AppText variant="caption" color={theme.colors.socialText}>{checkin.when}</AppText>
            <AppText color={theme.colors.textMuted}>{checkin.purpose}</AppText>
          </View>
        ))}
      </Section>

      <Section>
        <AppText variant="heading">Safety before, during, and after</AppText>
        {friendaySafetyGroups.map((group) => (
          <View key={group.title} style={styles.group}>
            <AppText variant="bodyStrong">{group.title}</AppText>
            {group.items.map((item) => (
              <View key={item} style={styles.bulletRow}>
                <View style={[styles.bullet, { backgroundColor: theme.colors.social }]} />
                <AppText color={theme.colors.textMuted} style={styles.bulletText}>{item}</AppText>
              </View>
            ))}
          </View>
        ))}
      </Section>

      <Section>
        <AppText variant="heading">What is not allowed</AppText>
        {friendayNotAllowed.map((item) => (
          <View key={item} style={styles.bulletRow}>
            <View style={[styles.bullet, { backgroundColor: theme.colors.danger }]} />
            <AppText color={theme.colors.textMuted} style={styles.bulletText}>{item}</AppText>
          </View>
        ))}
      </Section>

      <Section>
        <AppText variant="heading">Our promise to each other</AppText>
        {friendayPromise.map((item) => (
          <View key={item} style={styles.bulletRow}>
            <View style={[styles.bullet, { backgroundColor: theme.colors.self }]} />
            <AppText color={theme.colors.textMuted} style={styles.bulletText}>{item}</AppText>
          </View>
        ))}
      </Section>

      <ActionButton
        label="Open Safety Center"
        onPress={() => router.push('/safety')}
        intent="self"
        secondary
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { gap: density.cardGap },
  intro: { gap: density.textStackGap },
  step: { flexDirection: 'row', gap: density.cardGap, paddingVertical: density.cardGap, borderTopWidth: StyleSheet.hairlineWidth },
  stepCopy: { flex: 1, gap: 3 },
  panel: { borderWidth: 1, borderRadius: radii.md, padding: density.cardPadding, gap: 4, marginTop: density.cardGap },
  group: { gap: 6, marginTop: density.cardGap },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 8 },
  bulletText: { flex: 1, minWidth: 0 },
})
