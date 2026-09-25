import { Image, Pressable, StyleSheet, View } from 'react-native'

import { AppIcon } from '@/design-system/atoms/AppIcon'
import { AppText } from '@/design-system/atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'

export type ReviewContentData = {
  reviewerDisplayName: string
  rating: number
  body?: string
  imageUrl?: string | null
}

export function ReviewContent({
  review,
  onOpenImage,
}: {
  review: ReviewContentData
  onOpenImage?: () => void
}) {
  const theme = useAppTheme()
  const filled = Math.round(review.rating)

  return (
    <View style={styles.content}>
      <View style={styles.stars} accessibilityRole="text" accessibilityLabel={`${review.rating.toFixed(1)} out of 5 stars`}>
        {Array.from({ length: 5 }, (_, index) => (
          <AppIcon
            key={index}
            name={index < filled ? 'star' : 'star-outline'}
            size={16}
            color={index < filled ? theme.colors.socialText : theme.colors.textMuted}
          />
        ))}
        <AppText variant="caption" color={theme.colors.textMuted}>{review.rating.toFixed(1)}</AppText>
      </View>
      {review.body ? <AppText>{review.body}</AppText> : null}
      {review.imageUrl ? (
        onOpenImage ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open photo shared with ${review.reviewerDisplayName}'s review`}
            onPress={onOpenImage}
            style={({ pressed }) => [styles.imageWrap, pressed && styles.pressed]}
          >
            <Image
              accessibilityLabel={`Photo shared with ${review.reviewerDisplayName}'s review`}
              source={{ uri: review.imageUrl }}
              resizeMode="cover"
              style={styles.image}
            />
          </Pressable>
        ) : (
          <Image
            accessibilityLabel={`Photo shared with ${review.reviewerDisplayName}'s review`}
            source={{ uri: review.imageUrl }}
            resizeMode="cover"
            style={styles.image}
          />
        )
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  content: { minWidth: 0, gap: density.textStackGap },
  stars: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  imageWrap: { width: '100%', overflow: 'hidden', borderRadius: 8 },
  image: { width: '100%', height: 180, borderRadius: 10 },
  pressed: { opacity: 0.68 },
})
