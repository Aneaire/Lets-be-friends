export const ImpactFeedbackStyle = {
  Light: 'light',
  Medium: 'medium',
  Heavy: 'heavy',
  Soft: 'soft',
  Rigid: 'rigid',
} as const

export const AndroidHaptics = {
  Context_Click: 'context-click',
  Confirm: 'confirm',
} as const

export async function selectionAsync() {}

export async function impactAsync() {}

export async function performAndroidHapticsAsync() {}
