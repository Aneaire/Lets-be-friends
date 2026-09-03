import { Platform, StyleSheet, View } from 'react-native'

import { ActionButton } from '@/design-system/atoms/ActionButton'
import { Avatar } from '@/design-system/atoms/Avatar'
import { TextField } from '@/design-system/atoms/Field'
import { AppText } from '@/design-system/atoms/Typography'
import { AppHeader } from '@/design-system/molecules/AppHeader'
import { FormField } from '@/design-system/molecules/FormField'
import { Screen } from '@/design-system/templates/Screen'
import { useAppTheme } from '@/theme/ThemeProvider'
import { AvatarCropper } from './AvatarCropper'
import type { AvatarCrop } from './avatarCrop'
import { PROFILE_BIO_MAX, PROFILE_NAME_MAX } from './profileEditFields'

export function ProfileEditContent({
  avatarUri,
  avatarName,
  displayName,
  bio,
  busy,
  canSave,
  imagePicked,
  crop,
  nameHint,
  nameError,
  bioHint,
  bioError,
  onChangeName,
  onChangeBio,
  onChoosePhoto,
  onCropChange,
  onSave,
  onCancel,
}: {
  avatarUri?: string
  avatarName: string
  displayName: string
  bio: string
  busy: boolean
  canSave: boolean
  imagePicked: boolean
  crop: AvatarCrop
  nameHint: string
  nameError?: string
  bioHint: string
  bioError?: string
  onChangeName: (text: string) => void
  onChangeBio: (text: string) => void
  onChoosePhoto: () => void
  onCropChange: (crop: AvatarCrop) => void
  onSave: () => void
  onCancel: () => void
}) {
  const theme = useAppTheme()
  const { colors } = theme

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="Edit profile" back onBack={onCancel} />
      <View style={styles.photoSection}>
        <Avatar uri={avatarUri} name={avatarName} size={88} />
        <View style={styles.photoCopy}>
          <AppText variant="bodyStrong">Profile photo</AppText>
          <AppText variant="caption" color={colors.textMuted}>Choose an existing image up to 5 MB.</AppText>
          <ActionButton label={imagePicked ? 'Choose another photo' : 'Choose photo'} onPress={onChoosePhoto} intent="self" secondary disabled={busy} style={styles.compactButton} />
        </View>
      </View>

      {Platform.OS === 'web' && imagePicked && avatarUri ? (
        <AvatarCropper uri={avatarUri} crop={crop} onChange={onCropChange} />
      ) : null}

      <FormField label="Display name" hint={nameHint} error={nameError}>
        <TextField accessibilityLabel="Display name" value={displayName} onChangeText={onChangeName} maxLength={PROFILE_NAME_MAX + 1} autoCapitalize="words" />
      </FormField>

      <FormField label="Bio" optional hint={bioHint} error={bioError}>
        <TextField accessibilityLabel="Bio" value={bio} onChangeText={onChangeBio} maxLength={PROFILE_BIO_MAX + 1} placeholder="A short introduction for your member profile" multiline style={styles.bio} />
      </FormField>

      <ActionButton label={busy ? 'Saving profile' : 'Save profile'} onPress={onSave} intent="self" disabled={!canSave} />
      <ActionButton label="Cancel" onPress={onCancel} intent="self" secondary disabled={busy} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 16 },
  photoSection: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 4 },
  photoCopy: { flex: 1, gap: 5 },
  compactButton: { alignSelf: 'flex-start', minHeight: 44, paddingHorizontal: 14 },
  bio: { minHeight: 132 },
})
