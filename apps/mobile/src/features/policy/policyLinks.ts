import { router } from 'expo-router'
import * as Linking from 'expo-linking'
import * as WebBrowser from 'expo-web-browser'
import { getPolicyDocument, type PolicyDocumentId } from '@lets-be-friends/shared'

/**
 * The website owns the canonical Terms and Privacy text. The app links there
 * when a web app URL is configured, and falls back to the local policy screen
 * only for development builds without that URL.
 */
export function policyWebUrl(documentId: PolicyDocumentId) {
  const configured = process.env.EXPO_PUBLIC_WEB_APP_URL?.trim()
  if (!configured) return null
  const base = /^https?:\/\//i.test(configured) ? configured : `https://${configured}`
  return `${base.replace(/\/+$/, '')}${getPolicyDocument(documentId).path}`
}

export async function openPolicyDocument(documentId: PolicyDocumentId) {
  const url = policyWebUrl(documentId)
  if (!url) {
    router.push(getPolicyDocument(documentId).path as never)
    return
  }
  try {
    await WebBrowser.openBrowserAsync(url)
  } catch {
    await Linking.openURL(url).catch(() => undefined)
  }
}
