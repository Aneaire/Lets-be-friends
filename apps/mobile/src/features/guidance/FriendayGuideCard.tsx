import { router } from 'expo-router'
import { Image, Pressable, StyleSheet, View } from 'react-native'

import { ActionButton } from '@/design-system/atoms/ActionButton'
import { AppText } from '@/design-system/atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'

import { FRIENDAY_GUIDANCE_LINES, FRIENDAY_GUIDANCE_TITLE } from './friendayGuidance'

const guideImage = require('../../../assets/images/frienday/frienday-cafe-conversation.jpg')

export function FriendayGuideCard({
  onPressGuide,
  onPressSafety,
  onPressFindCompanion,
  onPressCreateProfile,
}: {
  onPressGuide?: () => void
  onPressSafety?: () => void
  onPressFindCompanion?: () => void
  onPressCreateProfile?: () => void
}) {
  const theme = useAppTheme()
  const openGuide = onPressGuide ?? (() => router.push('/frienday-guide'))
  const openSafety = onPressSafety ?? (() => router.push('/safety' as never))
  const findCompanion = onPressFindCompanion ?? (() => router.push('/nearby' as never))
  const createProfile = onPressCreateProfile ?? (() => router.push('/companion' as never))

  return (
    <View
      accessibilityLabel="Frienday guidance"
      style={[styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceRaised }]}
    >
      <Image
        source={guideImage}
        style={[styles.image, { borderColor: theme.colors.border }]}
        resizeMode="cover"
        accessibilityLabel="Two people talking over coffee at a table in a bright public cafe"
      />
      <AppText variant="label" color={theme.colors.socialText}>
        FRIENDAY GUIDE
      </AppText>
      <AppText variant="bodyStrong">{FRIENDAY_GUIDANCE_TITLE}</AppText>
      {FRIENDAY_GUIDANCE_LINES.map((line) => (
        <AppText key={line.slice(0, 24)} color={theme.colors.textMuted}>
          {line}
        </AppText>
      ))}
      <View style={styles.actions}>
        <ActionButton label="Find a Companion" onPress={findCompanion} intent="social" compact style={styles.flexAction} />
        <ActionButton label="Create Companion profile" onPress={createProfile} intent="self" secondary compact style={styles.flexAction} />
      </View>
      <ActionButton label="Read the full Frienday guide" onPress={openGuide} intent="social" secondary compact />
      <Pressable accessibilityRole="button" accessibilityLabel="Read safety details" hitSlop={8} onPress={openSafety}>
        <AppText variant="caption" color={theme.colors.socialText}>
          Read safety details
        </AppText>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 14, gap: 8, marginVertical: 10 },
  image: { width: '100%', aspectRatio: 4 / 3, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  actions: { flexDirection: 'row', gap: 8, paddingTop: 4 },
  flexAction: { flex: 1 },
})
