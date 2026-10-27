import { validateCompanionWithdrawalCentavos } from '@lets-be-friends/shared'

export function parseWithdrawalAmount(value: string, availableCentavos: number) {
  const pesos = Number(value.replace(/,/g, '').trim())
  const amountCentavos = Math.round(pesos * 100)
  if (!Number.isFinite(pesos) || pesos <= 0 || !Number.isSafeInteger(amountCentavos)) {
    return { ok: false as const, message: 'Enter a valid withdrawal amount.' }
  }
  try {
    validateCompanionWithdrawalCentavos(amountCentavos)
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : 'Withdrawal amount is invalid.' }
  }
  if (amountCentavos > availableCentavos) {
    return { ok: false as const, message: 'Available wallet balance is lower than this withdrawal amount.' }
  }
  return { ok: true as const, amountCentavos }
}

export function withdrawalStatusPresentation(status: 'queued' | 'submitting' | 'pending' | 'succeeded' | 'failed' | 'needs_review') {
  if (status === 'succeeded') return { label: 'Received', detail: 'The destination account received this withdrawal.', danger: false, tone: 'success' as const }
  if (status === 'failed') return { label: 'Returned', detail: 'The transfer failed and the amount returned to your available wallet balance.', danger: true, tone: 'danger' as const }
  if (status === 'needs_review') return { label: 'Needs review', detail: 'The result is uncertain. Funds stay reserved while support confirms the provider status.', danger: true, tone: 'danger' as const }
  if (status === 'pending') return { label: 'In transfer', detail: 'PayMongo accepted the transfer and is waiting for final status.', danger: false, tone: 'warning' as const }
  return { label: status === 'queued' ? 'Queued' : 'Submitting', detail: 'The withdrawal is being submitted securely.', danger: false, tone: 'warning' as const }
}
