import { router } from 'expo-router'
import { Pressable, StyleSheet } from 'react-native'

import type { PolicyDocumentId } from '@lets-be-friends/shared'

import { AppHeader } from '@/design-system/molecules/AppHeader'
import { AppText } from '@/design-system/atoms/Typography'
import { Screen, Section } from '@/design-system/templates/Screen'
import { useAppTheme } from '@/theme/ThemeProvider'

import { policyDocumentPresentation } from './policyPresentation'

export function PolicyDocumentScreen({ documentId }: { documentId: PolicyDocumentId }) {
  const theme = useAppTheme()
  const policy = policyDocumentPresentation(documentId)

  return (
    <Screen>
      <AppHeader
        title={policy.title}
        onBack={() => { if (router.canGoBack()) router.back(); else router.replace('/onboarding') }}
        subtitle={`Version ${policy.version}`}
        back
      />
      <AppText variant="caption" color={theme.colors.textMuted}>Effective {policy.effectiveDate}.</AppText>
      {policy.sections.map((section) => (
        <Section key={section.heading}>
          <AppText variant="heading">{section.heading}</AppText>
          {section.paragraphs.map((paragraph) => (
            <AppText key={paragraph.slice(0, 32)} variant="body" color={theme.colors.textMuted}>{paragraph}</AppText>
          ))}
        </Section>
      ))}
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={policy.relatedLabel}
        onPress={() => router.push(policy.relatedPath)}
        style={({ pressed }) => [styles.relatedLink, pressed && styles.pressed]}>
        <AppText variant="bodyStrong" color={theme.colors.selfText} style={styles.relatedText}>{policy.relatedLabel}</AppText>
      </Pressable>
    </Screen>
  )
}

const styles = StyleSheet.create({
  relatedLink: { marginTop: 24, paddingVertical: 8, alignSelf: 'flex-start' },
  relatedText: { textDecorationLine: 'underline' },
  pressed: { opacity: 0.62 },
})
