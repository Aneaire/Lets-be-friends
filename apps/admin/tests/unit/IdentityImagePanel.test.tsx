// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ readReviewImage: vi.fn() }))

vi.mock('convex/react', () => ({ useAction: () => state.readReviewImage }))
vi.mock('../../../web/convex/_generated/api', () => ({ api: { identityRecords: { readReviewImage: 'identityRecords.readReviewImage' } } }))

import { IdentityImagePanel } from '../../src/features/identity/IdentityImagePanel'

function thumbnail(label: string) {
  return screen.getByRole('button', { name: `Open ${label} larger` })
}

function expectImageRendered(label: string) {
  const button = thumbnail(label)
  expect(button.querySelector('img')).toBeTruthy()
  return button
}

const originalCreate = URL.createObjectURL
const originalRevoke = URL.revokeObjectURL

function grant(displayUntil: number) {
  return { bytes: new ArrayBuffer(8), contentType: 'image/jpeg', displayUntil }
}

describe('identity image panel', () => {
  beforeEach(() => {
    state.readReviewImage.mockReset()
    state.readReviewImage.mockImplementation(async () => grant(Date.now() + 5 * 60 * 1000))
    URL.createObjectURL = vi.fn(() => 'blob:mock-image')
    URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    cleanup()
    URL.createObjectURL = originalCreate
    URL.revokeObjectURL = originalRevoke
    document.body.style.overflow = ''
  })

  it('renders every retained image without waiting for a click', async () => {
    render(<IdentityImagePanel verificationRequestId="req-1" imageKinds={['id_front', 'id_back', 'selfie']} />)

    await waitFor(() => expectImageRendered('Front of ID'))
    expectImageRendered('Back of ID')
    expectImageRendered('Current selfie')
    // One read per image, all issued on open rather than on demand.
    expect(state.readReviewImage).toHaveBeenCalledTimes(3)
    expect(state.readReviewImage).toHaveBeenCalledWith({ verificationRequestId: 'req-1', kind: 'id_front' })
  })

  it('only reads the images that are retained', async () => {
    render(<IdentityImagePanel verificationRequestId="req-1" imageKinds={['id_front']} />)

    await waitFor(() => expectImageRendered('Front of ID'))
    expect(screen.queryByRole('button', { name: 'Open Back of ID larger' })).toBeNull()
    expect(state.readReviewImage).toHaveBeenCalledTimes(1)
    expect(state.readReviewImage).not.toHaveBeenCalledWith(expect.objectContaining({ kind: 'selfie' }))
  })

  it('opens an image larger from its thumbnail and closes on Escape', async () => {
    render(<IdentityImagePanel verificationRequestId="req-1" imageKinds={['id_front']} />)
    await waitFor(() => expectImageRendered('Front of ID'))

    fireEvent.click(thumbnail('Front of ID'))

    const dialog = await screen.findByRole('dialog', { name: 'Front of ID at full size' })
    expect(dialog).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Open in new tab' }).getAttribute('href')).toBe('blob:mock-image')
    expect(document.body.style.overflow).toBe('hidden')

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.body.style.overflow).toBe('')
  })

  it('shows the reason instead of an image when one cannot be read', async () => {
    state.readReviewImage.mockImplementation(async ({ kind }: { kind: string }) => {
      if (kind === 'id_back') throw new Error('This identity image is not retained')
      return grant(Date.now() + 5 * 60 * 1000)
    })
    render(<IdentityImagePanel verificationRequestId="req-1" imageKinds={['id_front', 'id_back']} />)

    await waitFor(() => expectImageRendered('Front of ID'))
    expect(screen.getByText('This identity image is not retained')).toBeTruthy()
    // An unavailable image is not clickable.
    expect((screen.getByRole('button', { name: /Back of ID/ }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('releases the images when the access grant lapses and reloads on demand', async () => {
    let calls = 0
    state.readReviewImage.mockImplementation(async () => {
      calls += 1
      // The first grant lapses almost immediately, the reload gets a full window.
      return grant(Date.now() + (calls === 1 ? 20 : 5 * 60 * 1000))
    })
    render(<IdentityImagePanel verificationRequestId="req-1" imageKinds={['id_front']} />)
    await waitFor(() => expectImageRendered('Front of ID'))

    await waitFor(() => expect(screen.getByText('Image access expired. Reload to view them again.')).toBeTruthy())
    expect(screen.queryByRole('button', { name: 'Open Front of ID larger' })).toBeNull()
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Reload images' }))
    await waitFor(() => expectImageRendered('Front of ID'))
    expect(state.readReviewImage).toHaveBeenCalledTimes(2)
  })

  it('says so when nothing is retained', () => {
    render(<IdentityImagePanel verificationRequestId="req-1" imageKinds={[]} />)
    expect(screen.getByText('No identity images are retained for this attempt.')).toBeTruthy()
    expect(state.readReviewImage).not.toHaveBeenCalled()
  })
  it('asks for every kind when the caller does not know which are retained', async () => {
    // This is the state between a frontend deploy and the backend deploy that
    // adds the retained-kinds field: it must not crash or show nothing.
    render(<IdentityImagePanel verificationRequestId="req-1" />)

    await waitFor(() => expectImageRendered('Front of ID'))
    expect(state.readReviewImage).toHaveBeenCalledTimes(3)
  })
  // Holds the fetch open until the test releases it, so the loading state is
  // observable. Every pending call must be released, not just the last one.
  function deferredLoader() {
    const resolvers: Array<() => void> = []
    return {
      impl: async () => {
        await new Promise<void>((resolve) => { resolvers.push(resolve) })
        return grant(Date.now() + 5 * 60 * 1000)
      },
      releaseAll: async () => {
        await act(async () => {
          for (const resolve of resolvers.splice(0)) resolve()
          await Promise.resolve()
          await Promise.resolve()
        })
      },
    }
  }

  it('draws a placeholder per expected image while loading, then replaces them', async () => {
    const loader = deferredLoader()
    state.readReviewImage.mockImplementation(loader.impl)
    const view = render(<IdentityImagePanel verificationRequestId="req-1" imageKinds={['id_front', 'id_back', 'selfie']} />)

    // One skeleton per requested image, with the grid still announced as busy.
    await waitFor(() => expect(view.container.querySelectorAll('.identity-image-skeleton')).toHaveLength(3))
    expect(screen.getByText('Loading identity images...')).toBeTruthy()
    expect(view.container.querySelector('.identity-image-grid')?.getAttribute('aria-busy')).toBe('true')
    expect(screen.queryByRole('button', { name: 'Open Front of ID larger' })).toBeNull()

    await loader.releaseAll()

    await waitFor(() => expect(view.container.querySelectorAll('.identity-image-skeleton')).toHaveLength(0))
    for (const label of ['Front of ID', 'Back of ID', 'Current selfie']) expectImageRendered(label)
    expect(view.container.querySelector('.identity-image-grid')?.getAttribute('aria-busy')).toBeNull()
  })

  it('keeps the current images on screen while a reload fetches new bytes', async () => {
    render(<IdentityImagePanel verificationRequestId="req-1" imageKinds={['id_front']} />)
    await waitFor(() => expectImageRendered('Front of ID'))
    const firstUrl = thumbnail('Front of ID').querySelector('img')?.getAttribute('src')

    const loader = deferredLoader()
    state.readReviewImage.mockImplementation(loader.impl)
    fireEvent.click(screen.getByRole('button', { name: 'Reload images' }))

    // The old blob must not be revoked while it is still displayed.
    const reloading = await screen.findByRole('button', { name: 'Loading...' })
    expect((reloading as HTMLButtonElement).disabled).toBe(true)
    expect(thumbnail('Front of ID').querySelector('img')?.getAttribute('src')).toBe(firstUrl)
    expect(globalThis.URL.revokeObjectURL).not.toHaveBeenCalled()

    await loader.releaseAll()
    await waitFor(() => expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith(firstUrl))
    expectImageRendered('Front of ID')
  })
})
