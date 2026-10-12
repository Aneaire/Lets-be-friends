import { useMutation } from 'convex/react'
import { router } from 'expo-router'
import { useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { mobileApi, type UserId } from '@/backend/client'
import { ActionButton } from '@/design-system/atoms/ActionButton'
import { AppText } from '@/design-system/atoms/Typography'
import { StateView } from '@/design-system/molecules/StateView'
import { SocialFeedCard } from '@/features/social/SocialFeedCard'
import { useAppTheme } from '@/theme/ThemeProvider'

import { toProfileFeedItem, visibleMemberPosts, type MemberPost } from './memberContent'

export function MemberProfilePosts({
  ownerName,
  posts,
  signedIn,
  emptyDescription,
  showSignInPrompt = true,
}: {
  ownerName: string
  posts: MemberPost[] | undefined
  signedIn: boolean
  emptyDescription: string
  showSignInPrompt?: boolean
}) {
  const theme = useAppTheme()
  const toggleFollow = useMutation(mobileApi.social.toggleFollow)
  const [followBusy, setFollowBusy] = useState<Record<string, boolean>>({})
  const followRequests = useRef(new Set<string>())

  if (posts === undefined) {
    return (
      <View style={styles.section}>
        <AppText variant="heading">{ownerName} posts</AppText>
        <AppText variant="caption" color={theme.colors.textMuted}>Loading posts.</AppText>
      </View>
    )
  }

  const visible = visibleMemberPosts(posts)
  if (!visible.length) {
    return (
      <View style={styles.section}>
        <AppText variant="heading">{ownerName} posts</AppText>
        <StateView
          embedded
          title="No posts yet"
          detail={emptyDescription}
        />
        {!signedIn && showSignInPrompt ? (
          <ActionButton label="Sign in to follow and react" onPress={() => router.push('/auth')} intent="social" secondary />
        ) : null}
      </View>
    )
  }

  async function updateFollowing(authorId: string) {
    if (followRequests.current.has(authorId)) return undefined
    followRequests.current.add(authorId)
    setFollowBusy((state) => ({ ...state, [authorId]: true }))
    try {
      return await toggleFollow({ userId: authorId as UserId })
    } finally {
      followRequests.current.delete(authorId)
      setFollowBusy((state) => {
        if (!state[authorId]) return state
        const next = { ...state }
        delete next[authorId]
        return next
      })
    }
  }

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <AppText variant="heading">{ownerName} posts</AppText>
        <AppText variant="caption" color={theme.colors.textMuted}>
          {visible.length === 1 ? '1 public post' : `${visible.length} public posts`}
        </AppText>
      </View>
      {!signedIn && showSignInPrompt ? (
        <AppText variant="caption" color={theme.colors.textMuted}>
          Sign in to like, save, follow, comment, or share.
        </AppText>
      ) : null}
      <View style={styles.list}>
        {visible.map((post) => {
          const item = toProfileFeedItem(post, ownerName)
          const authorId = String(post.authorId)
          return (
            <SocialFeedCard
              key={post._id}
              item={item as never}
              signedIn={signedIn}
              following={post.followingAuthor}
              followBusy={Boolean(followBusy[authorId])}
              onToggleFollow={signedIn && !post.ownPost ? () => updateFollowing(authorId) : undefined}
              onAction={() => undefined}
            />
          )
        })}
      </View>
      {!signedIn ? (
        <ActionButton label="Sign in" onPress={() => router.push('/auth')} intent="social" secondary />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  section: { gap: 10, marginTop: 8 },
  header: { gap: 2 },
  list: { gap: 10 },
})
