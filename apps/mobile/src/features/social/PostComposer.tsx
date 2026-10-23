import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'

import { ActionButton } from '@/design-system/atoms/ActionButton'
import { AppIcon } from '@/design-system/atoms/AppIcon'
import { Avatar } from '@/design-system/atoms/Avatar'
import { TextField } from '@/design-system/atoms/Field'
import { AppText } from '@/design-system/atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'

import { PollComposer, emptyPollDraft, type PollDraft } from './PollComposer'
import { PostMediaGrid, type PreviewPostMediaItem } from './PostMediaGrid'
import { mediaPickerSelectionLimit } from './feedComposer'

export type PostComposerMention = {
  userId: string
  displayName: string
  username: string
}

export type PostComposerProps = {
  expanded: boolean
  body: string
  busy?: boolean
  media: PreviewPostMediaItem[]
  mediaLimit?: number
  remainingUploads?: number
  mentionSuggestions?: PostComposerMention[]
  /**
   * Viewer identity shown above the text field. Home passes the signed-in
   * member photo and name so the author can confirm which account is posting.
   */
  avatarUri?: string
  avatarName?: string
  /**
   * Optional poll state. When `pollOpen` is true the composer shows the
   * shared {@link PollComposer} and disables media selection, because polls
   * are text-only. Circle discussions can pass the same props to reuse this
   * composer: control `pollOpen` and `pollDraft` from the parent, keep media
   * and poll mutually exclusive, and submit `pollDraft` through
   * `feedPostPollPayload` (see `feedComposer`).
   */
  pollOpen?: boolean
  pollDraft?: PollDraft
  onPollChange?: (next: PollDraft) => void
  onTogglePoll?: () => void
  onExpand: () => void
  onBodyChange: (value: string) => void
  onCaretChange: (index: number) => void
  onChooseMedia: () => void
  onRemoveMedia: (index: number) => void
  onSelectMention: (username: string) => void
  onPublish: () => void
  style?: StyleProp<ViewStyle>
}

export function PostComposer({
  expanded,
  body,
  busy = false,
  media,
  mediaLimit = 5,
  remainingUploads,
  mentionSuggestions = [],
  pollOpen = false,
  pollDraft,
  onPollChange,
  onTogglePoll,
  onExpand,
  onBodyChange,
  onCaretChange,
  onChooseMedia,
  onRemoveMedia,
  onSelectMention,
  onPublish,
  avatarUri,
  avatarName,
  style,
}: PostComposerProps) {
  const theme = useAppTheme()
  const tooLong = body.length > 1_000
  const remainingSelections = mediaPickerSelectionLimit({ selected: media.length, remaining: remainingUploads, limit: mediaLimit })
  const mediaDisabled = busy || pollOpen || remainingSelections <= 0
  const publishDisabled = busy || tooLong || (!body.trim() && media.length === 0 && !pollOpen)
  const draft = pollDraft ?? emptyPollDraft()

  return (
    <View
      style={[
        styles.composer,
        expanded && styles.expanded,
        {
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surfaceRaised,
        },
        style,
      ]}
    >
      {!expanded ? (
        <View style={styles.collapsed}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create a post"
            onPress={onExpand}
            hitSlop={2}
            style={[
              styles.prompt,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <AppText color={theme.colors.textMuted} numberOfLines={1}>
              What could feel easier together?
            </AppText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add photos or videos"
            accessibilityState={{ disabled: mediaDisabled }}
            disabled={mediaDisabled}
            onPress={() => {
              onExpand()
              onChooseMedia()
            }}
            style={({ pressed }) => [
              styles.compactMediaButton,
              { borderColor: theme.colors.border },
              mediaDisabled && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <AppIcon name="images-outline" color={theme.colors.socialText} />
          </Pressable>
        </View>
      ) : (
        <View style={styles.copy}>
          {avatarName ? (
            <View style={styles.authorRow}>
              <Avatar uri={avatarUri} name={avatarName} size={32} />
              <AppText variant="caption" color={theme.colors.textMuted} numberOfLines={1}>
                Posting as {avatarName}
              </AppText>
            </View>
          ) : null}
          <TextField
            accessibilityLabel="Create a text post"
            value={body}
            onChangeText={(value) => {
              onBodyChange(value)
              onCaretChange(value.length)
            }}
            onSelectionChange={(event) => onCaretChange(event.nativeEvent.selection.start)}
            placeholder="Ask for help, share an idea, or start a conversation"
            multiline
            maxLength={1_001}
            invalid={tooLong}
            autoFocus
            style={styles.input}
          />

          {mentionSuggestions.length > 0 ? (
            <View style={[styles.mentionMenu, { borderColor: theme.colors.border }]}>
              {mentionSuggestions.map((suggestion) => (
                <Pressable
                  key={suggestion.userId}
                  accessibilityRole="button"
                  accessibilityLabel={`Mention ${suggestion.displayName} as ${suggestion.username}`}
                  onPress={() => onSelectMention(suggestion.username)}
                  style={({ pressed }) => [styles.mentionOption, pressed && styles.pressed]}
                >
                  <Avatar name={suggestion.displayName} size={28} />
                  <View style={styles.mentionCopy}>
                    <AppText variant="bodyStrong" numberOfLines={1}>
                      {suggestion.displayName}
                    </AppText>
                    <AppText variant="caption" color={theme.colors.socialText}>
                      @{suggestion.username}
                    </AppText>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}

          <PostMediaGrid mode="preview" media={media} onRemove={onRemoveMedia} />

          {pollOpen && onPollChange ? (
            <PollComposer value={draft} onChange={onPollChange} disabled={busy} />
          ) : null}

          <View style={styles.publishRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add photos or videos"
              accessibilityState={{ disabled: mediaDisabled }}
              disabled={mediaDisabled}
              onPress={onChooseMedia}
              style={({ pressed }) => [
                styles.mediaButton,
                mediaDisabled && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              <AppIcon name="images-outline" color={theme.colors.socialText} />
              <AppText variant="caption" color={theme.colors.socialText}>
                Photos or videos
              </AppText>
            </Pressable>
            {onTogglePoll ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={pollOpen ? 'Remove poll' : 'Add a poll'}
                accessibilityState={{ disabled: busy, selected: pollOpen }}
                disabled={busy}
                onPress={onTogglePoll}
                style={({ pressed }) => [
                  styles.mediaButton,
                  busy && styles.disabled,
                  pressed && styles.pressed,
                ]}
              >
                <AppIcon name="bar-chart-outline" color={theme.colors.socialText} />
                <AppText variant="caption" color={theme.colors.socialText}>
                  {pollOpen ? 'Remove poll' : 'Poll'}
                </AppText>
              </Pressable>
            ) : null}
            <AppText
              accessibilityRole={tooLong ? 'alert' : undefined}
              variant="caption"
              color={tooLong ? theme.colors.danger : theme.colors.textMuted}
            >
              {tooLong
                ? `${body.length}/1,000. Shorten the post to publish.`
                : `${body.length}/1,000`}
            </AppText>
            <ActionButton
              label="Post"
              onPress={onPublish}
              disabled={publishDisabled}
              loading={busy}
              compact
              style={styles.postButton}
            />
          </View>

          {remainingUploads !== undefined ? (
            <AppText variant="caption" color={theme.colors.textMuted}>
              {media.length}/{mediaLimit} selected, {remainingSelections} more available today
            </AppText>
          ) : null}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  composer: {
    borderWidth: 1,
    borderRadius: 13,
    padding: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  expanded: {
    padding: density.compactCardPadding,
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 10,
  },
  collapsed: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  copy: {
    flex: 1,
    gap: 7,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  prompt: {
    flex: 1,
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: density.compactCardPadding,
    justifyContent: 'center',
  },
  compactMediaButton: {
    width: density.compactControlHeight,
    height: density.compactControlHeight,
    borderWidth: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    minHeight: 72,
    maxHeight: 140,
  },
  mentionMenu: {
    borderWidth: 1,
    borderRadius: density.controlRadius,
    padding: 4,
    gap: 2,
    maxHeight: 200,
  },
  mentionOption: {
    minHeight: density.compactControlHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  mentionCopy: {
    flex: 1,
    gap: 1,
  },
  publishRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  mediaButton: {
    minHeight: density.compactControlHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  postButton: {
    minHeight: density.compactControlHeight,
    paddingHorizontal: 16,
  },
  pressed: {
    opacity: 0.68,
  },
  disabled: {
    opacity: 0.5,
  },
})
