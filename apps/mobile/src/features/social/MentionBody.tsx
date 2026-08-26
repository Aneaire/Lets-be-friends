import { splitBodyIntoSegments, type StoredMention } from '@lets-be-friends/shared'

import { AppText } from '@/design-system/atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'

import { openMemberProfile } from './socialNavigation'

export function MentionBody({ body, mentions, numberOfLines }: { body: string; mentions?: StoredMention[]; numberOfLines?: number }) {
  const theme = useAppTheme()
  const segments = splitBodyIntoSegments(body, mentions ?? [])
  return (
    <AppText numberOfLines={numberOfLines}>
      {segments.map((segment, index) => segment.type === 'mention' ? (
        <AppText key={index} accessibilityRole="link" onPress={() => openMemberProfile(segment.userId)} variant="bodyStrong" color={theme.colors.socialText}>@{segment.username}</AppText>
      ) : (
        <AppText key={index}>{segment.text}</AppText>
      ))}
    </AppText>
  )
}
