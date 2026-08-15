import * as ImagePicker from 'expo-image-picker'
import { useMutation } from 'convex/react'
import { router, type ErrorBoundaryProps } from 'expo-router'
import { useRef, useState } from 'react'
import { Platform, StyleSheet, TextInput, View } from 'react-native'

import { mobileApi, type StorageId } from '@/backend/client'
import { ActionButton } from '@/components/ActionButton'
import { AppHeader } from '@/components/AppHeader'
import { useAppToastMessage } from '@/components/AppToast'
import { Avatar } from '@/components/Avatar'
import { Screen } from '@/components/Screen'
import { StateView } from '@/components/StateView'
import { AppText } from '@/components/Typography'
import { useMobileMember } from '@/member/MobileMember'
import { useAppTheme } from '@/theme/ThemeProvider'

const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024

export default function ProfileEditScreen() {
  const member = useMobileMember()

  if (member.status === 'signed_out') return <EditState title="Sign in to edit your profile" action="Sign in" onPress={() => router.replace('/auth')} />
  if (member.status === 'unconfigured') return <EditState title="Profile editing needs account services" detail="Connect your account to edit your member profile." />
  if (member.status === 'unavailable' || member.status === 'error') return <EditState title="Profile editing is unavailable" detail={member.message} />
  if (member.status !== 'ready') return <EditState title="Loading your profile" loading />

  return <ReadyProfileEdit viewer={member.viewer} />
}

function ReadyProfileEdit({ viewer }: { viewer: Extract<ReturnType<typeof useMobileMember>, { status: 'ready' }>['viewer'] }) {
  const theme = useAppTheme()
  const updateProfile = useMutation(mobileApi.users.updateProfile)
  const generateUploadUrl = useMutation(mobileApi.users.generateProfileImageUploadUrl)
  const [displayName, setDisplayName] = useState(viewer.displayName)
  const [bio, setBio] = useState(viewer.bio ?? '')
  const [imageAsset, setImageAsset] = useState<ImagePicker.ImagePickerAsset | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  useAppToastMessage(message)
  const busyRef = useRef(false)
  const nameLength = displayName.trim().length
  const canSave = nameLength > 0 && nameLength <= 80 && bio.trim().length <= 500 && !busy

  async function chooseImage() {
    if (busyRef.current) return
    setMessage('')
    try {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync(false)
        if (!permission.granted) {
          setMessage('Photo access is needed only to choose a profile image from your library.')
          return
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      })
      const asset = result.canceled ? undefined : result.assets[0]
      if (!asset) return
      if (asset.fileSize && asset.fileSize > MAX_PROFILE_IMAGE_BYTES) {
        setMessage('Choose an image smaller than 5 MB.')
        return
      }
      setImageAsset(asset)
    } catch {
      setMessage('The image library could not be opened. Please try again.')
    }
  }

  async function save() {
    if (!canSave || busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setMessage('')
    try {
      let profileImageStorageId: StorageId | undefined
      if (imageAsset) {
        const uploadUrl = await generateUploadUrl({})
        const response = await fetch(imageAsset.uri)
        if (!response.ok) throw new Error('Image could not be read')
        const blob = await response.blob()
        if (blob.size > MAX_PROFILE_IMAGE_BYTES) throw new Error('Image is too large')
        const upload = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': imageAsset.mimeType || blob.type || 'image/jpeg' },
          body: blob,
        })
        if (!upload.ok) throw new Error('Image upload failed')
        const result = await upload.json() as { storageId?: StorageId }
        if (!result.storageId) throw new Error('Image upload was incomplete')
        profileImageStorageId = result.storageId
      }

      await updateProfile({
        displayName: displayName.trim(),
        bio: bio.trim(),
        ...(profileImageStorageId ? { profileImageStorageId } : {}),
      })
      goBackOrProfile()
    } catch {
      setMessage('Your profile could not be saved. Check the name, bio, and image, then try again.')
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="Edit profile" back onBack={goBackOrProfile} />
      <View style={styles.photoSection}>
        <Avatar uri={imageAsset?.uri ?? viewer.profileImageUrl ?? undefined} name={displayName || viewer.displayName} size={88} />
        <View style={styles.photoCopy}>
          <AppText variant="bodyStrong">Profile photo</AppText>
          <AppText variant="caption" color={theme.colors.textMuted}>Choose an existing image up to 5 MB.</AppText>
          <ActionButton label={imageAsset ? 'Choose another photo' : 'Choose photo'} onPress={() => void chooseImage()} intent="self" secondary disabled={busy} style={styles.compactButton} />
        </View>
      </View>

      <View style={styles.field}>
        <View style={styles.labelRow}><AppText variant="bodyStrong">Display name</AppText><AppText variant="caption" color={nameLength > 80 ? theme.colors.danger : theme.colors.textMuted}>{nameLength}/80</AppText></View>
        <TextInput
          accessibilityLabel="Display name"
          value={displayName}
          onChangeText={(value) => { setDisplayName(value); setMessage('') }}
          maxLength={81}
          autoCapitalize="words"
          style={[styles.input, theme.typography.body, { color: theme.colors.text, borderColor: nameLength > 80 ? theme.colors.danger : theme.colors.border, backgroundColor: theme.colors.surfaceRaised }]}
        />
      </View>

      <View style={styles.field}>
        <View style={styles.labelRow}><AppText variant="bodyStrong">Bio</AppText><AppText variant="caption" color={bio.trim().length > 500 ? theme.colors.danger : theme.colors.textMuted}>{bio.trim().length}/500</AppText></View>
        <TextInput
          accessibilityLabel="Bio"
          value={bio}
          onChangeText={(value) => { setBio(value); setMessage('') }}
          placeholder="A short introduction for your member profile"
          placeholderTextColor={theme.colors.textMuted}
          multiline
          maxLength={501}
          textAlignVertical="top"
          style={[styles.input, styles.bio, theme.typography.body, { color: theme.colors.text, borderColor: bio.trim().length > 500 ? theme.colors.danger : theme.colors.border, backgroundColor: theme.colors.surfaceRaised }]}
        />
      </View>

      <ActionButton label={busy ? 'Saving profile' : 'Save profile'} onPress={() => void save()} intent="self" disabled={!canSave} />
      <ActionButton label="Cancel" onPress={goBackOrProfile} intent="self" secondary disabled={busy} />
    </Screen>
  )
}

function EditState({ title, detail, action, onPress, loading = false }: { title: string; detail?: string; action?: string; onPress?: () => void; loading?: boolean }) {
  return <Screen scroll={false} contentStyle={styles.state}><StateView eyebrow="PROFILE" title={title} detail={detail} actionLabel={action} onAction={onPress} loading={loading} intent="self" /></Screen>
}

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return <EditState title="Profile editing is temporarily unavailable" detail="No profile changes were saved." action="Try again" onPress={retry} />
}

function goBackOrProfile() {
  if (router.canGoBack()) router.back()
  else router.replace('/profile')
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 48, gap: 18 },
  state: { paddingHorizontal: 16 },
  photoSection: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 4 },
  photoCopy: { flex: 1, gap: 5 },
  compactButton: { alignSelf: 'flex-start', minHeight: 44, paddingHorizontal: 14 },
  field: { gap: 8 },
  labelRow: { minHeight: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11 },
  bio: { minHeight: 132 },
})
