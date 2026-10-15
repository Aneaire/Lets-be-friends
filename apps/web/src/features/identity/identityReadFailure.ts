export type IdentityReadFailureReason =
  | 'service_unavailable'
  | 'blur'
  | 'glare'
  | 'cropped'
  | 'wrong_side'
  | 'not_a_document'
  | 'unreadable'
  | 'retryable'
  | 'unknown'

// Member-facing copy for why an ID read failed. The server stores the reason as a
// key so the wording stays here, in one place, and never blames the photo for a
// problem that was ours.
const readFailureMessages: Record<IdentityReadFailureReason, string> = {
  service_unavailable: 'Identity checks are briefly unavailable. Please try again in a few minutes.',
  blur: 'The photo was too blurred to read. Hold the camera steady and take a new photo in even light.',
  glare: 'A reflection covered part of your ID. Move away from direct light and take a new photo.',
  cropped: 'Part of your ID was cut off. Fit all four corners inside the frame and take a new photo.',
  wrong_side: 'That looks like the back of your ID. Add the front, where the photo and main details are.',
  not_a_document: 'We could not find a government ID in that photo. Add a clear photo of the front of your ID.',
  unreadable: 'The details on your ID were not readable. Move closer, avoid shadows, and take a new photo.',
  retryable: 'Your photo looks usable, but we could not finish reading it on our side. Please try again.',
  unknown: 'We could not read that ID. Add a clearer photo of the front and try again.',
}

export function identityReadFailureMessage(reason: string | undefined): string {
  return reason && reason in readFailureMessages
    ? readFailureMessages[reason as IdentityReadFailureReason]
    : readFailureMessages.unknown
}
