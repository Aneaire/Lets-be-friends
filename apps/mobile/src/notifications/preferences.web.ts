import type { PushOptInPromptState, PushPreference } from './logic'

export async function readPushPreference(_clerkUserId: string): Promise<PushPreference> {
  return { optedIn: false, pendingDisable: false }
}

export async function writePushPreference(_clerkUserId: string, _value: PushPreference) {}

export async function readPushOptInPrompt(
  _clerkUserId: string,
  _installationId: string,
): Promise<PushOptInPromptState> {
  return { handled: false }
}

export async function writePushOptInPrompt(
  _clerkUserId: string,
  _installationId: string,
  _value: PushOptInPromptState,
) {}
