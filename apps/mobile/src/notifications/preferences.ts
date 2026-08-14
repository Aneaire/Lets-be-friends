import type { PushPreference } from './logic'

export async function readPushPreference(_clerkUserId: string): Promise<PushPreference> {
  return { optedIn: false, pendingDisable: false }
}

export async function writePushPreference(_clerkUserId: string, _value: PushPreference) {}
