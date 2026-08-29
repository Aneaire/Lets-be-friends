import {
  Image,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'

import { AppIcon } from '@/design-system/atoms/AppIcon'
import { AppText } from '@/design-system/atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'

import { postImagePressLabel, type PostImagePressContext } from './postImagePresentation'

export type DisplayPostMediaItem = {
  storageId: string
  kind: string
  url?: string | null
}

export type PreviewPostMediaItem = {
  key: string
  kind: string
  previewUrl?: string | null
}

type DisplayPostMediaGridProps = {
  mode?: 'display'
  media: DisplayPostMediaItem[]
  onOpenVideo: (url: string) => void
  onOpenImage?: (item: DisplayPostMediaItem & { url: string }, index: number, total: number) => void
  imagePressContext?: PostImagePressContext
  style?: StyleProp<ViewStyle>
}

type PreviewPostMediaGridProps = {
  mode: 'preview'
  media: PreviewPostMediaItem[]
  onRemove: (index: number) => void
  style?: StyleProp<ViewStyle>
}

export type PostMediaGridProps = DisplayPostMediaGridProps | PreviewPostMediaGridProps

export function PostMediaGrid(props: PostMediaGridProps) {
  return props.mode === 'preview'
    ? <PreviewMediaGrid {...props} />
    : <DisplayMediaGrid {...props} />
}

function DisplayMediaGrid({ media, onOpenVideo, onOpenImage, imagePressContext = 'feed', style }: DisplayPostMediaGridProps) {
  const theme = useAppTheme()
  const availableMedia = media.filter((item): item is DisplayPostMediaItem & { url: string } => Boolean(item.url))

  if (availableMedia.length === 0) return null

  const compact = availableMedia.length > 1

  return (
    <View style={[styles.grid, style]}>
      {availableMedia.map((item, index) => (
        <View
          key={`${item.storageId}-${index}`}
          style={[
            styles.tile,
            compact ? styles.compactTile : styles.fullTile,
            { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
          ]}
        >
          {item.kind === 'image' ? (
            onOpenImage ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={postImagePressLabel(imagePressContext, index, availableMedia.length)}
                onPress={() => onOpenImage(item, index, availableMedia.length)}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <Image
                  source={{ uri: item.url }}
                  resizeMode="cover"
                  accessibilityRole="image"
                  accessibilityLabel={`Post image ${index + 1} of ${availableMedia.length}`}
                  style={styles.image}
                />
              </Pressable>
            ) : (
              <Image
                source={{ uri: item.url }}
                resizeMode="cover"
                accessibilityRole="image"
                accessibilityLabel={`Post image ${index + 1} of ${availableMedia.length}`}
                style={styles.image}
              />
            )
          ) : (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`Open post video ${index + 1} of ${availableMedia.length}`}
              onPress={() => onOpenVideo(item.url)}
              style={({ pressed }) => [styles.video, pressed && styles.pressed]}
            >
              <AppIcon name="play-circle-outline" color={theme.colors.socialText} size={24} />
              <AppText variant="bodyStrong" color={theme.colors.socialText}>Open video</AppText>
              {!compact ? <AppText variant="caption" color={theme.colors.textMuted}>Opens in your device's supported video app</AppText> : null}
            </Pressable>
          )}
        </View>
      ))}
    </View>
  )
}

function PreviewMediaGrid({ media, onRemove, style }: PreviewPostMediaGridProps) {
  const theme = useAppTheme()

  if (media.length === 0) return null

  const compact = media.length > 1

  return (
    <View style={[styles.grid, style]}>
      {media.map((item, index) => (
        <View
          key={item.key}
          style={[
            styles.tile,
            compact ? styles.compactTile : styles.fullTile,
            { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
          ]}
        >
          {item.kind === 'image' && item.previewUrl ? (
            <Image
              source={{ uri: item.previewUrl }}
              resizeMode="cover"
              accessibilityRole="image"
              accessibilityLabel={`Selected post photo ${index + 1} of ${media.length}`}
              style={styles.image}
            />
          ) : (
            <View accessibilityRole="image" accessibilityLabel={`Selected post video ${index + 1} of ${media.length}`} style={styles.video}>
              <AppIcon name="videocam-outline" color={theme.colors.socialText} size={24} />
              <AppText variant="caption">Video {index + 1} ready</AppText>
            </View>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove selected media ${index + 1}`}
            onPress={() => onRemove(index)}
            style={[styles.remove, { backgroundColor: theme.colors.inverse }]}
          >
            <AppIcon name="close" color={theme.colors.inverseText} size={18} />
          </Pressable>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  tile: {
    position: 'relative',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
  },
  fullTile: {
    width: '100%',
  },
  compactTile: {
    width: '49%',
  },
  image: {
    width: '100%',
    aspectRatio: 4 / 3,
  },
  video: {
    minHeight: 92,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  remove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  pressed: {
    opacity: 0.68,
  },
})
