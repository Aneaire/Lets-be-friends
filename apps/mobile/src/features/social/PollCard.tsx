import { useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native'

import { AppText } from '@/design-system/atoms/Typography'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density, radii, spacing } from '@/theme/tokens'

import { pollOptionResultLabel, pollTotalLabel, pollVotable } from './pollPresentation'

export type MobilePollOption = {
  id: string
  label: string
  voteCount: number
  percentage: number
}

export type MobilePoll = {
  question: string
  options: MobilePollOption[]
  totalVotes: number
  closesAt?: number
  closed: boolean
  votedOptionId?: string
}

export function PollCard({
  poll,
  disabled = false,
  onVote,
}: {
  poll: MobilePoll
  disabled?: boolean
  onVote: (optionId: string) => Promise<void>
}) {
  const theme = useAppTheme()
  const [selected, setSelected] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const hasVoted = Boolean(poll.votedOptionId)
  const canVote = pollVotable(poll.votedOptionId, poll.closed, disabled)

  async function vote() {
    if (!selected || busy) return
    setBusy(true)
    setError('')
    try {
      await onVote(selected)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your vote could not be recorded.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <View
      accessibilityLabel={`Poll: ${poll.question}`}
      style={[styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
    >
      <View style={styles.head}>
        <AppText variant="bodyStrong" style={styles.question}>{poll.question}</AppText>
        <AppText variant="caption" color={theme.colors.textMuted}>
          {pollTotalLabel(poll.totalVotes, poll.closed)}
        </AppText>
      </View>
      <View accessibilityRole="radiogroup">
        {poll.options.map((option) => {
          const voted = poll.votedOptionId === option.id
          const isSelected = selected === option.id
          const active = voted || isSelected
          return (
            <Pressable
              key={option.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: active, disabled: !canVote || busy }}
              disabled={!canVote || busy}
              onPress={() => {
                setSelected(option.id)
                setError('')
              }}
              style={[styles.option, { borderColor: active ? theme.colors.social : theme.colors.border, backgroundColor: theme.colors.surfaceRaised }]}
            >
              <View
                style={[styles.fill, { width: `${Math.min(100, Math.max(0, option.percentage))}%`, backgroundColor: theme.colors.socialSoft }]}
              />
              <View style={[styles.marker, { borderColor: active ? theme.colors.social : theme.colors.borderStrong, backgroundColor: active ? theme.colors.social : 'transparent' }]} />
              <AppText variant="body" style={styles.label} numberOfLines={2}>{option.label}</AppText>
              <AppText variant="caption" color={voted ? theme.colors.socialText : theme.colors.textMuted}>
                {pollOptionResultLabel(option.percentage, option.voteCount)}
              </AppText>
            </Pressable>
          )
        })}
      </View>
      {canVote ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Vote"
          disabled={!selected || busy}
          onPress={() => void vote()}
          style={[styles.vote, { backgroundColor: theme.colors.socialControl, opacity: !selected || busy ? 0.5 : 1 }]}
        >
          {busy ? <ActivityIndicator color={theme.colors.accentText} /> : <AppText variant="bodyStrong" color={theme.colors.accentText}>Vote</AppText>}
        </Pressable>
      ) : null}
      {hasVoted ? <AppText variant="caption" color={theme.colors.textMuted}>Your vote is in. Results stay live.</AppText> : null}
      {poll.closed && !hasVoted ? <AppText variant="caption" color={theme.colors.textMuted}>This poll is closed.</AppText> : null}
      {error ? <AppText variant="caption" color={theme.colors.danger}>{error}</AppText> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: density.compactCardPadding,
    gap: density.textStackGap,
    marginTop: density.cardGap,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  question: { flex: 1 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: density.textStackGap,
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingVertical: density.compactCardPadding,
    paddingHorizontal: density.compactCardPadding,
    marginTop: density.cardGap,
  },
  fill: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  marker: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5 },
  label: { flex: 1 },
  vote: {
    alignSelf: 'flex-start',
    borderRadius: radii.sm,
    minHeight: density.compactControlHeight,
    justifyContent: 'center',
    paddingHorizontal: density.contentGap,
    marginTop: density.cardGap,
  },
})
