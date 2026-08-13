import {
  MAX_TOP_UP_CENTAVOS,
  MIN_TOP_UP_CENTAVOS,
  formatPhp,
} from '@lets-be-friends/shared'

export type WalletTopUpStatus = 'creating' | 'awaiting_payment' | 'processing' | 'paid' | 'failed' | 'expired'

export function parseWalletAmount(input: string) {
  const trimmed = input.trim()
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(trimmed)) {
    return { ok: false as const, message: 'Enter a PHP amount with valid thousands separators and up to two decimal places.' }
  }
  const normalized = trimmed.replaceAll(',', '')
  const centavos = Math.round(Number(normalized) * 100)
  if (!Number.isSafeInteger(centavos) || centavos < MIN_TOP_UP_CENTAVOS || centavos > MAX_TOP_UP_CENTAVOS) {
    return { ok: false as const, message: 'Top-up amount must be between PHP 100 and PHP 100,000.' }
  }
  return { ok: true as const, amountCentavos: centavos }
}

export function walletBalanceRows(wallet: {
  availableCentavos: number
  reservedCentavos: number
  pendingCentavos: number
}) {
  return [
    { key: 'available', label: 'Available to book', value: formatPhp(wallet.availableCentavos) },
    { key: 'reserved', label: 'Reserved for accepted bookings', value: formatPhp(wallet.reservedCentavos) },
    { key: 'pending', label: 'Pending provider confirmation', value: formatPhp(wallet.pendingCentavos) },
  ] as const
}

export function topUpPresentation(status: WalletTopUpStatus, expiresAt?: number, now = Date.now()) {
  if (status === 'awaiting_payment' && expiresAt !== undefined && expiresAt <= now) {
    return { label: 'Expired', detail: 'This QR can no longer be used. Create a new top-up when ready.', active: false, payable: false }
  }
  switch (status) {
    case 'creating':
      return { label: 'Preparing QR', detail: 'PayMongo is preparing this top-up.', active: true, payable: false }
    case 'awaiting_payment':
      return { label: 'Awaiting payment', detail: 'Scan the QR Ph code. Balance is credited only after provider confirmation.', active: true, payable: true }
    case 'processing':
      return { label: 'Confirming payment', detail: 'PayMongo is confirming this payment. Check the refreshed balance and recent top-up status for the recorded result.', active: true, payable: false }
    case 'paid':
      return { label: 'Paid', detail: 'Provider confirmation was received and the wallet credit was recorded.', active: false, payable: false }
    case 'failed':
      return { label: 'Failed', detail: 'This top-up was not completed. Your wallet was not credited.', active: false, payable: false }
    case 'expired':
      return { label: 'Expired', detail: 'This QR can no longer be used. Create a new top-up when ready.', active: false, payable: false }
  }
}

export function formatWalletTimestamp(timestamp: number) {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(timestamp)
}

export function formatQrExpiry(expiresAt: number, now = Date.now()) {
  if (expiresAt <= now) return 'Expired'
  return `Expires ${formatWalletTimestamp(expiresAt)}`
}

export function isUnambiguousTopUpCreationError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : ''
  return message.includes('top-ups are not enabled')
    || message.includes('amount must be')
    || message.includes('authentication required')
    || message.includes('profile sync required')
    || message.includes('account is suspended')
    || message.includes('unresolved qr ph top-up is already active')
}
