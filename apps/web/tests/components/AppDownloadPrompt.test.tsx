// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { AppDownloadPrompt } from '../../src/features/app-download/AppDownloadPrompt'
import { PLAY_STORE_URL, appDownloadDismissKey } from '../../src/features/app-download/appDownload'

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

describe('app download prompt', () => {
  it('offers the Android app after the member finishes onboarding', async () => {
    render(<AppDownloadPrompt viewerId="user_1" onboardingCompletedAt={1_700_000_000_000} />)
    const link = await screen.findByRole('link', { name: 'Get the Android app' })
    expect(link.getAttribute('href')).toBe(PLAY_STORE_URL)
    expect(link.getAttribute('target')).toBe('_blank')
  })

  it('does not offer the app before onboarding is complete', async () => {
    render(<AppDownloadPrompt viewerId="user_1" onboardingCompletedAt={undefined} />)
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Get the Android app' })).toBeNull())
  })

  it('remembers a dismissal for that account in this browser', async () => {
    render(<AppDownloadPrompt viewerId="user_1" onboardingCompletedAt={1} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Dismiss the app download offer' }))
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Get the Android app' })).toBeNull())
    expect(window.localStorage.getItem(appDownloadDismissKey('user_1'))).toBe('1')
  })

  it('does not restore the offer after a dismissal', async () => {
    window.localStorage.setItem(appDownloadDismissKey('user_1'), '1')
    render(<AppDownloadPrompt viewerId="user_1" onboardingCompletedAt={1} />)
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Get the Android app' })).toBeNull())
  })
})
