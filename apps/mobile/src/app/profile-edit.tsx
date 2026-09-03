import * as ImagePicker from 'expo-image-picker'
import { useMutation } from 'convex/react'
import { router, type ErrorBoundaryProps } from 'expo-router'
import { useRef, useState } from 'react'
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native'

import { mobileApi, type StorageId } from '@/backend/client'
import { useAppToastMessage } from '@/design-system/molecules/AppToast'
import { ProfileEditContent } from '@/member/ProfileEditContent'
import { canSaveProfileEdit, profileEditFieldCopy } from '@/member/profileEditFields'
import { cropProfileImage } from '@/member/cropProfileImage'
import { defaultAvatarCrop, normalizeAvatarCrop, type AvatarCrop } from '@/member/avatarCrop'
import { preparePostMedia, uploadPostMedia, type PreparedPostMedia } from '@/features/social/postMediaUpload'
import { useMobileMember } from '@/member/MobileMember'
import { Screen } from '@/design-system/templates/Screen'
import { PageSkeleton } from '@/design-system/templates/PageSkeleton'
import { StateView } from '@/design-system/molecules/StateView'
import { useAppTheme } from '@/theme/ThemeProvider'

const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024

export default function ProfileEditScreen() {
  const member = useMobileMember()

  if (member.status === 'signed_out') return <EditState title="Sign in to edit your profile" action="Sign in" onPress={() => router.replace('/auth')} />
  if (member.status === 'unconfigured') return <EditState title="Profile editing needs account services" detail="Connect your account to edit your member profile." />
  if (member.status === 'unavailable' || member.status === 'error') return <EditState title="Profile editing is unavailable" detail={member.message} />
  if (member.status !== 'ready') return <PageSkeleton variant="profileForm" />

  return <ReadyProfileEdit viewer={member.viewer} />
}

function ReadyProfileEdit({ viewer }: { viewer: Extract<ReturnType<typeof useMobileMember>, { status: 'ready' }>['viewer'] }) {
  const theme = useAppTheme()
  const updateProfile = useMutation(mobileApi.users.updateProfile)
  const generateUploadUrl = useMutation(mobileApi.users.generateProfileImageUploadUrl)
  const [displayName, setDisplayName] = useState(viewer.displayName)
  const [bio, setBio] = useState(viewer.bio ?? '')
  const [imageAsset, setImageAsset] = useState<ImagePicker.ImagePickerAsset | null>(null)
  const [avatarCrop, setAvatarCrop] = useState<AvatarCrop>(defaultAvatarCrop)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  useAppToastMessage(message)
  const busyRef = useRef(false)
  const { nameLength, bioLength, nameHint, nameError, bioHint, bioError } = profileEditFieldCopy(displayName, bio)
  const canSave = canSaveProfileEdit(nameLength, bioLength, busy)

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
        allowsEditing: Platform.OS !== 'web',
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
      setAvatarCrop(defaultAvatarCrop)
    } catch {
      setMessage('The image library could not be opened. Please try again.')
    }
  }

  async function prepareProfileImage(asset: ImagePicker.ImagePickerAsset): Promise<PreparedPostMedia> {
    if (Platform.OS === 'web') {
      const cropped = await cropProfileImage(asset.uri, normalizeAvatarCrop(avatarCrop))
      return { uri: asset.uri, mimeType: cropped.mimeType, fileSize: cropped.blob.size, body: cropped.blob }
    }
    return preparePostMedia({ uri: asset.uri, mimeType: asset.mimeType || 'image/jpeg' })
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
        const prepared = await prepareProfileImage(imageAsset)
        if (prepared.fileSize > MAX_PROFILE_IMAGE_BYTES) throw new Error('Image is too large')
        profileImageStorageId = await uploadPostMedia(uploadUrl, prepared) as StorageId
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
    <KeyboardAvoidingView
      style={[styles.kav, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ProfileEditContent
        avatarUri={imageAsset?.uri ?? viewer.profileImageUrl ?? undefined}
        avatarName={displayName || viewer.displayName}
        displayName={displayName}
        bio={bio}
        busy={busy}
        canSave={canSave}
        imagePicked={Boolean(imageAsset)}
        crop={avatarCrop}
        nameHint={nameHint}
        nameError={nameError}
        bioHint={bioHint}
        bioError={bioError}
        onChangeName={(value) => { setDisplayName(value); setMessage('') }}
        onChangeBio={(value) => { setBio(value); setMessage('') }}
        onChoosePhoto={() => void chooseImage()}
        onCropChange={setAvatarCrop}
        onSave={() => void save()}
        onCancel={goBackOrProfile}
      />
    </KeyboardAvoidingView>
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
  kav: { flex: 1 },
  state: { paddingHorizontal: 16 },
})
