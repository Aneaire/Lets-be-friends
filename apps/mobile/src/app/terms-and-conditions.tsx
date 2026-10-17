import { currentPolicyVersion, policyEffectiveDate, termsSections } from '@lets-be-friends/shared'

import { router } from 'expo-router'

import { AppHeader } from '@/design-system/molecules/AppHeader'
import { AppText } from '@/design-system/atoms/Typography'
import { Screen, Section } from '@/design-system/templates/Screen'
import { useAppTheme } from '@/theme/ThemeProvider'

export default function TermsAndConditionsScreen() {
  const theme = useAppTheme()
  return (
    <Screen>
      <AppHeader title="Terms and Conditions" onBack={() => { if (router.canGoBack()) router.back(); else router.replace('/onboarding') }} subtitle={`Version ${currentPolicyVersion}`} back />
      <AppText variant="caption" color={theme.colors.textMuted}>Effective {policyEffectiveDate}.</AppText>
      {termsSections.map((section) => (
        <Section key={section.heading}>
          <AppText variant="heading">{section.heading}</AppText>
          {section.paragraphs.map((paragraph) => (
            <AppText key={paragraph.slice(0, 32)} variant="body" color={theme.colors.textMuted}>{paragraph}</AppText>
          ))}
        </Section>
      ))}
    </Screen>
  )
}
