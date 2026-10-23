import { StyleSheet, View } from 'react-native'

import { ActionButton } from '@/design-system/atoms/ActionButton'
import { AppText } from '@/design-system/atoms/Typography'
import { ConfirmationDialog } from '@/design-system/molecules/ConfirmationDialog'
import { evidenceDecisionCopy, evidenceSharedRowCopy, type EvidenceDecision, type EvidenceSharedRow } from '@/data/evidence'
import { useAppTheme } from '@/theme/ThemeProvider'
import { density } from '@/theme/tokens'

export type EvidenceRowState = EvidenceSharedRow & {
  decidedAt?: number
}

export type BookingEvidencePresentationProps = {
  participantRole: 'member_end' | 'companion_start'
  decision?: EvidenceDecision
  rows?: EvidenceRowState[]
  loading?: boolean
  busy?: 'upload' | 'skip' | null
  participantCompletedAt?: number
  otherParticipantCompletedAt?: number
  message?: string
  skipError?: string
  skipConfirmationVisible?: boolean
  onChooseImage: () => void
  onRequestSkip: () => void
  onCloseSkipConfirmation: () => void
  onConfirmSkip: () => void | Promise<void>
  /** False once the booking leaves the accepted state; the shared record stays visible but read-only. */
  canDecide?: boolean
}

export function BookingEvidencePresentation({
  participantRole,
  decision,
  rows = [],
  loading = false,
  canDecide = true,
  busy = null,
  participantCompletedAt,
  otherParticipantCompletedAt,
  message,
  skipError,
  skipConfirmationVisible = false,
  onChooseImage,
  onRequestSkip,
  onCloseSkipConfirmation,
  onConfirmSkip,
}: BookingEvidencePresentationProps) {
  const theme = useAppTheme()
  const copy = evidenceDecisionCopy(participantRole, decision)
  const sharedRows = rows.length > 0 ? rows : [{ role: participantRole, isViewer: true, decision }]

  return (
    <>
      <View style={[styles.panel, { backgroundColor: theme.colors.socialSoft, borderColor: theme.colors.social }]}>
        <View style={styles.copy}>
          <AppText variant="heading">{copy.label}</AppText>
          <AppText variant="caption" color={theme.colors.textMuted}>
            {loading ? 'Loading the live evidence decision.' : copy.detail}
          </AppText>
        </View>

        {!loading ? (
          <View style={styles.sharedRecord}>
            <AppText variant="label" color={theme.colors.textMuted}>SHARED SAFETY RECORD</AppText>
            {sharedRows.map((row) => {
              const rowCopy = evidenceSharedRowCopy(row)
              return (
                <View
                  key={row.role}
                  accessibilityLabel={`${rowCopy.label}: ${row.decision ?? 'not decided'}`}
                  style={[styles.sharedRow, { borderColor: theme.colors.border }]}>
                  <AppText variant="bodyStrong">{rowCopy.label}</AppText>
                  <AppText variant="caption" color={theme.colors.textMuted}>{rowCopy.detail}</AppText>
                </View>
              )
            })}
            <AppText variant="caption" color={theme.colors.textMuted}>
              Both people can see whether each decision exists. Images stay private to authorized safety review.
            </AppText>
          </View>
        ) : (
          <AppText color={theme.colors.textMuted}>Loading the shared safety record.</AppText>
        )}

        {!loading && !canDecide ? (
          <AppText variant="caption" color={theme.colors.textMuted}>
            The evidence window for this booking has closed. The shared record above stays available to both people.
          </AppText>
        ) : null}

        {!loading && canDecide && !decision ? (
          <>
            <AppText variant="caption" color={theme.colors.textMuted}>
              This optional image is private. It is retained for a limited period and can be opened only by an authorized reviewer during an active booking report. Access is audited. The other participant cannot view it.
            </AppText>
            <ActionButton
              label="Choose private evidence image"
              onPress={onChooseImage}
              loading={busy === 'upload'}
              disabled={busy !== null && busy !== 'upload'}
            />
            <ActionButton
              label="Skip evidence after warning"
              onPress={onRequestSkip}
              loading={busy === 'skip'}
              disabled={busy !== null && busy !== 'skip'}
              secondary
            />
          </>
        ) : null}

        {!loading && decision && !participantCompletedAt ? (
          <AppText variant="caption" color={theme.colors.textMuted}>
            Your evidence choice is recorded. You can now confirm completion after the experience ends.
          </AppText>
        ) : null}

        {participantCompletedAt ? (
          <AppText variant="caption" color={theme.colors.textMuted}>
            You confirmed completion{otherParticipantCompletedAt ? ', and the other person also confirmed.' : '. Waiting for the other person to confirm.'}
          </AppText>
        ) : null}
        {message ? <AppText accessibilityLiveRegion="polite" variant="caption">{message}</AppText> : null}
      </View>

      <ConfirmationDialog
        visible={skipConfirmationVisible}
        onClose={onCloseSkipConfirmation}
        onConfirm={onConfirmSkip}
        title="Skip private evidence?"
        description="No private evidence image will be available to help an authorized reviewer evaluate a later booking report. This one-time decision cannot be replaced in the mobile app."
        confirmLabel="Skip evidence"
        busyLabel="Saving decision"
        cancelLabel="Keep evidence option"
        intent="danger"
        busy={busy === 'skip'}>
        {skipError ? <AppText accessibilityRole="alert" variant="caption" color={theme.colors.danger}>{skipError}</AppText> : null}
      </ConfirmationDialog>
    </>
  )
}

const styles = StyleSheet.create({
  panel: { borderWidth: 1, borderRadius: 16, padding: density.cardPadding, gap: 10 },
  copy: { gap: density.textStackGap },
  sharedRecord: { gap: density.textStackGap },
  sharedRow: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: density.compactCardPadding, gap: 2 },
})
