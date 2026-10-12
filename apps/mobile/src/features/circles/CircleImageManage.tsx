import { useMutation } from 'convex/react'
import * as ImagePicker from 'expo-image-picker'
import { useState } from 'react'
import { Image, Platform, StyleSheet, View } from 'react-native'

import { mobileApi, type CircleId } from '@/backend/client'
import { ActionButton } from '@/design-system/atoms/ActionButton'
import { AppText } from '@/design-system/atoms/Typography'
import { InlineNotice } from '@/design-system/molecules/FeedbackState'
import { useAppTheme } from '@/theme/ThemeProvider'

import { circleActionError, circleImageKindLabel } from './circlePresentation'
import { isCircleImageSafeMessage, uploadCircleImage } from './circleImageUpload'

/**
 * Host-only Circle icon and cover management. Uses the existing Circle image
 * APIs: generateCircleImageUploadUrl, setCircleImage, removeCircleImage.
 */
export function CircleImageManage({ circleId, iconUrl, coverUrl, active }: {
  circleId: CircleId
  iconUrl?: string | null
  coverUrl?: string | null
  active: boolean
}) {
  const generateUploadUrl = useMutation(mobileApi.circles.generateCircleImageUploadUrl)
  const setImage = useMutation(mobileApi.circles.setCircleImage)
  const removeImage = useMutation(mobileApi.circles.removeCircleImage)
  const [busy, setBusy] = useState('')
  const [confirmRemove, setConfirmRemove] = useState<'icon' | 'cover' | null>(null)
  const [error, setError] = useState('')

  async function chooseImage(kind: 'icon' | 'cover') {
    if (busy || !active) return
    setBusy(kind)
    setError('')
    setConfirmRemove(null)
    try {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync(false)
        if (!permission.granted) {
          setError('Photo access is needed to choose a Circle image. The current image stays in place.')
          return
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, allowsMultipleSelection: false, quality: 1 })
      if (result.canceled || !result.assets[0]) return
      const asset = result.assets[0]
      await uploadCircleImage({
        circleId,
        kind,
        asset: { uri: asset.uri, type: asset.type, mimeType: asset.mimeType, fileName: asset.fileName, fileSize: asset.fileSize },
        deps: { generateUploadUrl: generateUploadUrl, setImage },
      })
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : ''
      if (isCircleImageSafeMessage(message)) setError(message)
      else setError(circleActionError(cause, 'The Circle image could not be updated.'))
    } finally {
      setBusy('')
    }
  }

  async function remove(kind: 'icon' | 'cover') {
    if (busy || !active) return
    setBusy(`remove-${kind}`)
    setError('')
    try {
      await removeImage({ circleId, kind })
      setConfirmRemove(null)
    } catch (cause) {
      setError(circleActionError(cause, 'The Circle image could not be removed.'))
    } finally {
      setBusy('')
    }
  }

  return (
    <CircleImageManageView
      iconUrl={iconUrl}
      coverUrl={coverUrl}
      active={active}
      busy={busy}
      confirmRemove={confirmRemove}
      error={error}
      onChoose={kind => void chooseImage(kind)}
      onAskRemove={kind => { if (!busy) setConfirmRemove(kind) }}
      onCancelRemove={() => { if (!busy) setConfirmRemove(null) }}
      onRemove={kind => void remove(kind)}
    />
  )
}

export function CircleImageManageView({
  iconUrl,
  coverUrl,
  active,
  busy,
  confirmRemove,
  error,
  onChoose,
  onAskRemove,
  onCancelRemove,
  onRemove,
}: {
  iconUrl?: string | null
  coverUrl?: string | null
  active: boolean
  busy: string
  confirmRemove: 'icon' | 'cover' | null
  error: string
  onChoose: (kind: 'icon' | 'cover') => void
  onAskRemove: (kind: 'icon' | 'cover') => void
  onCancelRemove: () => void
  onRemove: (kind: 'icon' | 'cover') => void
}) {
  const theme = useAppTheme()
  const kinds = ['icon', 'cover'] as const
  return (
    <View style={[styles.panel, { borderColor: theme.colors.border }]}>
      <AppText variant="heading">Circle images</AppText>
      <AppText color={theme.colors.textMuted}>
        Static JPEG, PNG, or WebP still images, 5 MB or smaller. Choose a square image for the icon and a wide image for the cover.
      </AppText>
      {error ? (
        <InlineNotice title="Circle image failed" tone="danger">
          {error}
        </InlineNotice>
      ) : null}
      {kinds.map(kind => {
        const current = kind === 'icon' ? iconUrl : coverUrl
        const label = circleImageKindLabel(kind)
        return (
          <View key={kind} style={styles.kind}>
            <AppText variant="bodyStrong">{kind === 'icon' ? 'Icon, square (1:1)' : 'Cover, wide (4:1)'}</AppText>
            {current ? (
              <Image
                source={{ uri: current }}
                accessibilityRole="image"
                accessibilityLabel={`Current ${label}`}
                style={kind === 'icon' ? styles.icon : styles.cover}
              />
            ) : (
              <AppText color={theme.colors.textMuted}>
                {kind === 'icon' ? 'No icon yet. The Circle marker is shown instead.' : 'No cover yet.'}
              </AppText>
            )}
            <View style={styles.row}>
              <ActionButton
                compact
                label={busy === kind ? `Uploading ${kind}` : `Choose ${kind}`}
                intent="self"
                loading={busy === kind}
                disabled={!active || Boolean(busy)}
                onPress={() => onChoose(kind)}
              />
              {current ? (
                confirmRemove === kind ? (
                  <>
                    <ActionButton
                      compact
                      label={busy === `remove-${kind}` ? 'Removing' : `Confirm remove ${kind}`}
                      intent="danger"
                      loading={busy === `remove-${kind}`}
                      onPress={() => onRemove(kind)}
                    />
                    <ActionButton compact label="Keep image" intent="neutral" secondary disabled={Boolean(busy)} onPress={onCancelRemove} />
                  </>
                ) : (
                  <ActionButton
                    compact
                    label={`Remove ${kind}`}
                    intent="danger"
                    secondary
                    disabled={!active || Boolean(busy)}
                    onPress={() => onAskRemove(kind)}
                  />
                )
              ) : null}
            </View>
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  panel: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 14, gap: 12 },
  kind: { gap: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  icon: { width: 56, height: 56, borderRadius: 28 },
  cover: { width: '100%', aspectRatio: 4, borderRadius: 16 },
})
