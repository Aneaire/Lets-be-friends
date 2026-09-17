import type { FunctionReturnType } from 'convex/server'
import { withoutLeadingReplyMention } from '@lets-be-friends/shared'
import { Pressable, StyleSheet, View } from 'react-native'

import { api as generatedApi } from '../../../../web/convex/_generated/api'

import { Avatar } from '@/design-system/atoms/Avatar'
import { AppText } from '@/design-system/atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'
import { radii, spacing } from '@/theme/tokens'

import { featuredCommentActionLabel } from './featuredCommentPresentation'
import { MentionBody } from './MentionBody'
import { openMemberProfile } from './socialNavigation'

type FeedItem = FunctionReturnType<typeof generatedApi.social.feedPage>['page'][number]
type FeedPost = Extract<FeedItem, { kind: 'post' }>['post']

export type FeaturedComment = NonNullable<FeedPost['featuredComment']>

export function FeaturedCommentPreview({ comment, onOpenThread }: {
  comment: FeaturedComment
  onOpenThread: () => void
}) {
  const theme = useAppTheme()
  const openAuthorProfile = () => openMemberProfile(String(comment.authorId))
  const profileLabel = `View ${comment.authorDisplayName}'s profile`
  const actionLabel = featuredCommentActionLabel(comment.threadInteractionCount)

  return (
    <View style={[styles.container, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
      <AppText variant="label" color={theme.colors.textMuted}>Most discussed</AppText>
      <View style={styles.comment}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={profileLabel}
          onPress={openAuthorProfile}
          hitSlop={6}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Avatar uri={comment.authorProfileImageUrl ?? undefined} name={comment.authorDisplayName} size={32} />
        </Pressable>
        <View style={styles.copy}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={profileLabel}
            onPress={openAuthorProfile}
            hitSlop={6}
            style={({ pressed }) => [styles.author, pressed && styles.pressed]}
          >
            <AppText variant="bodyStrong" numberOfLines={1}>{comment.authorDisplayName}</AppText>
          </Pressable>
          <MentionBody
            body={withoutLeadingReplyMention(comment.body, comment.replyToAuthorUsername)}
            mentions={comment.mentions}
            numberOfLines={4}
          />
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
        onPress={onOpenThread}
        hitSlop={6}
        style={({ pressed }) => [styles.action, pressed && styles.pressed]}
      >
        <AppText variant="caption" color={theme.colors.socialText}>{actionLabel}</AppText>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xxs,
    marginTop: spacing.xs,
    padding: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.sm,
  },
  comment: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  author: {
    alignSelf: 'flex-start',
  },
  action: {
    alignSelf: 'flex-start',
  },
  pressed: {
    opacity: 0.68,
  },
})
