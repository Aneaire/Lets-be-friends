import { Image, Platform, Pressable, StyleSheet, View } from 'react-native'

import { ActionButton } from '@/design-system/atoms/ActionButton'
import { AppIcon } from '@/design-system/atoms/AppIcon'
import { Avatar } from '@/design-system/atoms/Avatar'
import { TextField } from '@/design-system/atoms/Field'
import { AppText } from '@/design-system/atoms/Typography'
import { Dialog, DialogPresentation } from '@/design-system/molecules/Dialog'
import { SegmentedControl } from '@/design-system/molecules/SegmentedControl'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'

import { AvatarCropper } from './AvatarCropper'
import type { AvatarCrop } from './avatarCrop'

type ProfilePhotoComposerProps = {
  authorName: string
  currentImageUri?: string
  selectedImageUri?: string
  crop: AvatarCrop
  caption: string
  shareToFeed: boolean
  busy: boolean
  onChoosePhoto: () => void
  onCropChange: (crop: AvatarCrop) => void
  onCaptionChange: (caption: string) => void
  onShareToFeedChange: (shareToFeed: boolean) => void
  onSave: () => void
  onClose: () => void
}

const dialogTitle = 'Update profile picture'
const dialogDescription = 'Choose the photo members will see next to your name.'

/**
 * The photo is chosen and framed inside the post card members will see it on,
 * so the profile update follows the same rhythm as the post composer.
 */
function ProfilePhotoComposerCard({
  authorName,
  currentImageUri,
  selectedImageUri,
  crop,
  caption,
  shareToFeed,
  busy,
  onChoosePhoto,
  onCropChange,
  onCaptionChange,
  onShareToFeedChange,
}: Omit<ProfilePhotoComposerProps, 'onSave' | 'onClose'>) {
  const theme = useAppTheme()
  const { colors } = theme
  const previewUri = selectedImageUri ?? currentImageUri

  return (
    <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <View style={styles.authorRow}>
        <Avatar uri={previewUri} name={authorName} size={32} />
        <View style={styles.authorCopy}>
          <AppText variant="bodyStrong" numberOfLines={1}>{authorName}</AppText>
          <AppText variant="caption" color={colors.textMuted}>Just now</AppText>
        </View>
      </View>

      {shareToFeed ? (
        <TextField
          accessibilityLabel="Profile picture caption"
          value={caption}
          onChangeText={onCaptionChange}
          placeholder="Say something about your new photo (optional)"
          multiline
          maxLength={1_000}
          style={styles.caption}
        />
      ) : null}

      {selectedImageUri ? (
        Platform.OS === 'web' ? (
          <AvatarCropper uri={selectedImageUri} crop={crop} onChange={onCropChange} />
        ) : (
          <Image
            accessibilityLabel="Selected profile photo"
            source={{ uri: selectedImageUri }}
            resizeMode="cover"
            style={[styles.photo, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}
          />
        )
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose a profile photo"
          onPress={onChoosePhoto}
          disabled={busy}
          style={({ pressed }) => [
            styles.drop,
            { borderColor: colors.border, backgroundColor: colors.surface },
            pressed && styles.pressed,
          ]}>
          <AppIcon name="image-outline" size={22} color={colors.textMuted} />
          <AppText variant="bodyStrong">Choose a photo</AppText>
          <AppText variant="caption" color={colors.textMuted}>PNG or JPG, 5 MB max.</AppText>
        </Pressable>
      )}

      {selectedImageUri ? (
        <ActionButton
          label="Choose another photo"
          onPress={onChoosePhoto}
          intent="self"
          secondary
          compact
          disabled={busy}
          style={styles.chooseAnother}
        />
      ) : null}

      <SegmentedControl
        label="Who can see this update?"
        options={[
          { value: 'public', label: 'Public', disabled: busy },
          { value: 'private', label: 'Private', disabled: busy },
        ]}
        value={shareToFeed ? 'public' : 'private'}
        onChange={(value) => onShareToFeedChange(value === 'public')}
        tone={shareToFeed ? 'social' : 'self'}
      />
      <AppText variant="caption" color={colors.textMuted}>
        {shareToFeed
          ? 'A post is added to the feed. Your profile picture changes too.'
          : 'Only your profile picture changes. No post is added to the feed.'}
      </AppText>
    </View>
  )
}

function ProfilePhotoComposerFooter({
  selectedImageUri,
  shareToFeed,
  busy,
  onSave,
  onClose,
}: Pick<ProfilePhotoComposerProps, 'selectedImageUri' | 'shareToFeed' | 'busy' | 'onSave' | 'onClose'>) {
  return (
    <View style={styles.footer}>
      <ActionButton label="Cancel" onPress={onClose} intent="self" secondary disabled={busy} style={styles.footerButton} />
      <ActionButton
        label={shareToFeed ? 'Post' : 'Save photo'}
        onPress={onSave}
        intent={shareToFeed ? 'social' : 'self'}
        disabled={!selectedImageUri || busy}
        loading={busy}
        style={styles.footerButton}
      />
    </View>
  )
}

export function ProfilePhotoComposerPresentation(props: ProfilePhotoComposerProps) {
  return (
    <DialogPresentation
      title={dialogTitle}
      description={dialogDescription}
      onClose={props.onClose}
      busy={props.busy}
      footer={<ProfilePhotoComposerFooter {...props} />}>
      <ProfilePhotoComposerCard {...props} />
    </DialogPresentation>
  )
}

export function ProfilePhotoComposer({ visible, ...props }: ProfilePhotoComposerProps & { visible: boolean }) {
  return (
    <Dialog
      visible={visible}
      title={dialogTitle}
      description={dialogDescription}
      onClose={props.onClose}
      busy={props.busy}
      footer={<ProfilePhotoComposerFooter {...props} />}>
      <ProfilePhotoComposerCard {...props} />
    </Dialog>
  )
}

const styles = StyleSheet.create({
  card: { gap: density.cardGap, borderWidth: 1, borderRadius: density.controlRadius, padding: density.compactCardPadding },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  authorCopy: { flex: 1, gap: 1 },
  caption: { minHeight: 72, maxHeight: 140 },
  photo: { width: '100%', aspectRatio: 1, borderWidth: 1, borderRadius: density.controlRadius },
  drop: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: density.controlRadius,
    padding: density.compactCardPadding,
  },
  chooseAnother: { alignSelf: 'flex-start', minHeight: 44 },
  footer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: density.cardGap },
  footerButton: { flexGrow: 1 },
  pressed: { opacity: 0.68 },
})
