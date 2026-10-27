import { Pressable, StyleSheet, View } from 'react-native'

import { Avatar } from '@/design-system/atoms/Avatar'
import { AppIcon } from '@/design-system/atoms/AppIcon'
import { AppText } from '@/design-system/atoms/Typography'
import { VerifiedBadge } from '@/design-system/atoms/VerifiedBadge'
import { BottomSheet } from '@/design-system/molecules/BottomSheet'
import { useAppTheme } from '@/theme/ThemeProvider'
import type { AccountSheetItem } from './accountSheet'

export function AccountSheet({
  visible,
  name,
  email,
  imageUrl,
  fullyVerified,
  items,
  signingOut,
  signOutError,
  onSelect,
  onSignOut,
  onClose,
}: {
  visible: boolean
  name: string
  email?: string
  imageUrl?: string
  fullyVerified: boolean
  items: AccountSheetItem[]
  signingOut: boolean
  signOutError: boolean
  onSelect: (item: AccountSheetItem) => void
  onSignOut: () => void
  onClose: () => void
}) {
  return (
    <BottomSheet
      visible={visible}
      title="Account"
      description="Profile, Companion tools, wallet, settings, and safety."
      closeLabel="Close account"
      busy={signingOut}
      onClose={onClose}>
      <AccountSheetContent
        name={name}
        email={email}
        imageUrl={imageUrl}
        fullyVerified={fullyVerified}
        items={items}
        signingOut={signingOut}
        signOutError={signOutError}
        onSelect={onSelect}
        onSignOut={onSignOut}
      />
    </BottomSheet>
  )
}

export function AccountSheetContent({
  name,
  email,
  imageUrl,
  fullyVerified,
  items,
  signingOut,
  signOutError,
  onSelect,
  onSignOut,
}: {
  name: string
  email?: string
  imageUrl?: string
  fullyVerified: boolean
  items: AccountSheetItem[]
  signingOut: boolean
  signOutError: boolean
  onSelect: (item: AccountSheetItem) => void
  onSignOut: () => void
}) {
  const theme = useAppTheme()
  return (
    <View style={styles.content}>
      <View style={[styles.identity, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
        <View style={styles.avatarWrap}>
          <Avatar uri={imageUrl} name={name} size={56} />
          {fullyVerified ? (
            <View style={styles.badge}>
              <VerifiedBadge label="Identity and Companion profile verified" />
            </View>
          ) : null}
        </View>
        <View style={styles.identityCopy}>
          <AppText variant="bodyStrong" numberOfLines={1}>{name}</AppText>
          {email ? <AppText variant="caption" color={theme.colors.textMuted} numberOfLines={1}>{email}</AppText> : null}
          {fullyVerified ? <AppText variant="caption" color={theme.colors.textMuted}>Identity and Companion profile verified.</AppText> : null}
        </View>
      </View>
      <View style={styles.list} accessibilityRole="menu" accessibilityLabel="Account">
        {items.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="menuitem"
            accessibilityLabel={item.label}
            accessibilityHint={item.detail}
            disabled={signingOut}
            onPress={() => onSelect(item)}
            style={({ pressed }) => [styles.row, { borderBottomColor: theme.colors.border, backgroundColor: item.highlight ? theme.colors.selfSoft : undefined }, pressed && styles.pressed]}>
            <AppIcon name={item.icon} color={theme.colors.selfText} size={22} />
            <View style={styles.rowCopy}>
              <AppText variant="bodyStrong">{item.label}</AppText>
              {item.detail ? <AppText variant="caption" color={theme.colors.textMuted}>{item.detail}</AppText> : null}
            </View>
            <AppIcon name="chevron-forward" color={theme.colors.textMuted} size={20} />
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="menuitem"
          accessibilityLabel={signingOut ? 'Signing out' : 'Sign out'}
          disabled={signingOut}
          onPress={onSignOut}
          style={({ pressed }) => [styles.row, styles.signOutRow, pressed && styles.pressed]}>
          <AppIcon name="log-out-outline" color={theme.colors.danger} size={22} />
          <View style={styles.rowCopy}>
            <AppText variant="bodyStrong" color={theme.colors.danger}>{signingOut ? 'Signing out' : 'Sign out'}</AppText>
            <AppText variant="caption" color={theme.colors.textMuted}>End this session on this device</AppText>
          </View>
        </Pressable>
      </View>
      {signOutError ? <AppText accessibilityRole="alert" variant="caption" color={theme.colors.danger}>Sign out could not be completed. Please try again.</AppText> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  content: { gap: 12 },
  identity: { borderWidth: 1, borderRadius: 16, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarWrap: { position: 'relative' },
  badge: { position: 'absolute', right: -2, bottom: -2 },
  identityCopy: { flex: 1, minWidth: 0, gap: 2 },
  list: { gap: 0 },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  signOutRow: { borderBottomWidth: 0 },
  pressed: { opacity: 0.62 },
})
