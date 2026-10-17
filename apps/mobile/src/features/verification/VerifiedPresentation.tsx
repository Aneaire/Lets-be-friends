import { Image, Pressable, StyleSheet, View } from 'react-native'

import { ActionButton } from '@/design-system/atoms/ActionButton'
import { AppText } from '@/design-system/atoms/Typography'
import { AppHeader } from '@/design-system/molecules/AppHeader'
import { StateView } from '@/design-system/molecules/StateView'
import { Screen, Section } from '@/design-system/templates/Screen'
import { density, radii } from '@/theme/tokens'
import { useAppTheme } from '@/theme/ThemeProvider'

export type VerifiedTarget = 'explore' | 'nearby' | 'profile' | 'safety' | 'companion' | 'status'

const heroImage = require('../../../assets/images/verification/frienday-verified-hero-1024.webp')
const meetImage = require('../../../assets/images/verification/frienday-verified-meet-1024.webp')
const planImage = require('../../../assets/images/verification/frienday-verified-plan-1024.webp')
const onlineImage = require('../../../assets/images/verification/frienday-verified-online-1024.webp')

// The happy path of a verification approval, reached from the "Identity
// verification approved" notification. It never claims verification for a
// member without a current approval; those members get an honest status panel.
export function VerifiedPresentation({
  approved,
  verificationLabel,
  verificationDetail,
  onBack,
  onNavigate,
}: {
  approved: boolean
  verificationLabel: string
  verificationDetail: string
  onBack: () => void
  onNavigate: (target: VerifiedTarget) => void
}) {
  const theme = useAppTheme()

  if (!approved) {
    return (
      <Screen contentStyle={styles.stateContent}>
        <AppHeader title="Verification result" back onBack={onBack} />
        <StateView
          eyebrow="Not approved yet"
          title={verificationLabel}
          detail={verificationDetail}
          actionLabel="Review your verification status"
          onAction={() => onNavigate('status')}
          intent="self"
        />
      </Screen>
    )
  }

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="Identity approved" back onBack={onBack} />

      <View style={[styles.hero, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <AppText variant="display">You are verified. Start making friends.</AppText>
        <AppText color={theme.colors.textMuted}>
          Your identity check passed safety review. You can now explore people, send your first booking request, and share your own Strengths as a Companion.
        </AppText>
        <View style={[styles.privacyNote, { borderLeftColor: theme.colors.success, backgroundColor: theme.colors.surfaceRaised }]}>
          <AppText variant="caption" color={theme.colors.textMuted}>
            Nothing from your identity check appears on your public profile. Only the safety team can see your ID and selfie.
          </AppText>
        </View>
      </View>

      <Image
        source={heroImage}
        style={[styles.heroImage, { borderColor: theme.colors.border }]}
        resizeMode="cover"
        accessibilityLabel="Two people who just met greeting each other warmly over coffee in a bright public cafe"
      />
      <AppText variant="caption" color={theme.colors.textMuted}>
        Every booking starts with a clear plan and a public place, so the first meeting stays easy and relaxed.
      </AppText>

      <Section>
        <AppText variant="label" color={theme.colors.socialText}>YOUR FIRST STEPS</AppText>
        <AppText variant="title">Three easy ways to begin</AppText>
        <AppText color={theme.colors.textMuted}>You choose the people, the plan, and the pace. Nothing is scheduled without your request.</AppText>
      </Section>

      <VerifiedStep
        image={meetImage}
        imageLabel="Two people laughing together in conversation in a bright public cafe"
        title="Find someone to spend time with"
        body="Browse people by Strength, activity, session format, and city. Read how they describe their time before you decide."
        linkLabel="Explore people"
        onPress={() => onNavigate('explore')}
      />
      <VerifiedStep
        image={planImage}
        imageLabel="A person planning a session on a phone beside a notebook and a cup of coffee at home"
        title="See who is nearby"
        body="Open Nearby to see approved Companions around your area. Request a day, a duration, and how you would like to meet. You see the full price before anything is sent."
        linkLabel="Open Nearby"
        onPress={() => onNavigate('nearby')}
      />
      <VerifiedStep
        image={onlineImage}
        imageLabel="Two people enjoying a friendly online session together on a laptop video call"
        title="Meet online or in a public place"
        body="An online session is an easy first step. For in-person plans, keep the first meeting public and share the plan with someone you trust."
        linkLabel="How safety works"
        onPress={() => onNavigate('safety')}
      />

      <Section style={{ ...styles.actions, borderColor: theme.colors.border, backgroundColor: theme.colors.surface }}>
        <AppText variant="heading">You are ready when you are.</AppText>
        <AppText color={theme.colors.textMuted}>Take your time, look around, and start with whichever step feels comfortable.</AppText>
        <ActionButton label="Explore people" onPress={() => onNavigate('explore')} intent="social" />
        <ActionButton label="Review your member profile" onPress={() => onNavigate('profile')} intent="self" secondary />
        <Pressable accessibilityRole="link" accessibilityLabel="Create a Companion profile" onPress={() => onNavigate('companion')} style={styles.inlineLink}>
          <AppText variant="bodyStrong" color={theme.colors.selfText}>Share your own Strengths as a Companion</AppText>
        </Pressable>
      </Section>
    </Screen>
  )
}

function VerifiedStep({
  image,
  imageLabel,
  title,
  body,
  linkLabel,
  onPress,
}: {
  image: number
  imageLabel: string
  title: string
  body: string
  linkLabel: string
  onPress: () => void
}) {
  const theme = useAppTheme()

  return (
    <View style={[styles.step, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
      <Image source={image} style={styles.stepImage} resizeMode="cover" accessibilityLabel={imageLabel} />
      <View style={styles.stepBody}>
        <AppText variant="heading">{title}</AppText>
        <AppText color={theme.colors.textMuted}>{body}</AppText>
        <Pressable accessibilityRole="link" accessibilityLabel={linkLabel} onPress={onPress} style={styles.inlineLink}>
          <AppText variant="bodyStrong" color={theme.colors.socialText}>{linkLabel}</AppText>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  content: { gap: density.cardGap },
  stateContent: { flexGrow: 1 },
  hero: { borderWidth: 1, borderRadius: radii.md, padding: density.cardPadding, gap: density.textSectionGap },
  privacyNote: { borderLeftWidth: 2, borderRadius: radii.sm, padding: density.cardPadding },
  heroImage: { width: '100%', aspectRatio: 4 / 3, borderRadius: radii.md, borderWidth: 1 },
  step: { borderWidth: 1, borderRadius: radii.md, overflow: 'hidden', marginTop: density.sectionGap },
  stepImage: { width: '100%', aspectRatio: 4 / 3 },
  stepBody: { padding: density.cardPadding, gap: density.textStackGap },
  actions: { borderWidth: 1, borderRadius: radii.md, padding: density.cardPadding, gap: density.cardGap },
  inlineLink: { minHeight: density.compactControlHeight, justifyContent: 'center' },
})
