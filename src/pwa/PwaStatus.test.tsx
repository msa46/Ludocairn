import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type {
  RegisterWorker,
  RegisterWorkerCallbacks,
  UpdateServiceWorker,
} from './register'
import { PwaStatus } from './PwaStatus'

afterEach(() => vi.restoreAllMocks())

function captureRegistration(
  updateSW: UpdateServiceWorker = vi.fn().mockResolvedValue(undefined),
) {
  let callbacks: RegisterWorkerCallbacks | undefined
  const registerWorker: RegisterWorker = vi.fn((nextCallbacks) => {
    callbacks = nextCallbacks
    return updateSW
  })

  return {
    registerWorker,
    updateSW,
    callbacks() {
      if (!callbacks) throw new Error('PWA registration was not started')
      return callbacks
    },
  }
}

describe('PwaStatus', () => {
  it('renders nothing while the installed version is current', () => {
    const registration = captureRegistration()
    const { container } = render(
      <PwaStatus
        prepareForReload={() => true}
        registerWorker={registration.registerWorker}
      />,
    )

    expect(container).toBeEmptyDOMElement()
    expect(registration.registerWorker).toHaveBeenCalledOnce()
  })

  it('shows a dismissible offline-ready status', () => {
    const registration = captureRegistration()
    render(
      <PwaStatus
        prepareForReload={() => true}
        registerWorker={registration.registerWorker}
      />,
    )

    act(() => registration.callbacks().onOfflineReady())

    expect(screen.getByRole('status')).toHaveTextContent(
      'Ludocairn is ready to use offline.',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss PWA status' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows an update action only after onNeedRefresh', () => {
    const registration = captureRegistration()
    render(
      <PwaStatus
        prepareForReload={() => true}
        registerWorker={registration.registerWorker}
      />,
    )

    expect(
      screen.queryByRole('button', { name: 'Update and reload' }),
    ).not.toBeInTheDocument()

    act(() => registration.callbacks().onNeedRefresh())

    expect(
      screen.getByRole('button', { name: 'Update and reload' }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))
    expect(
      screen.queryByRole('button', { name: 'Update and reload' }),
    ).not.toBeInTheDocument()
  })

  it('flushes pending state before updateSW(true)', async () => {
    const events: string[] = []
    const updateSW = vi.fn(async (reloadPage?: boolean) => {
      events.push(`update:${String(reloadPage)}`)
    })
    const registration = captureRegistration(updateSW)
    render(
      <PwaStatus
        prepareForReload={() => {
          events.push('flush')
          return true
        }}
        registerWorker={registration.registerWorker}
      />,
    )
    act(() => registration.callbacks().onNeedRefresh())

    fireEvent.click(screen.getByRole('button', { name: 'Update and reload' }))

    await act(async () => undefined)
    expect(events).toEqual(['flush', 'update:true'])
  })

  it('refuses activation when reload preparation fails', () => {
    const registration = captureRegistration()
    render(
      <PwaStatus
        prepareForReload={() => false}
        registerWorker={registration.registerWorker}
      />,
    )
    act(() => registration.callbacks().onNeedRefresh())

    fireEvent.click(screen.getByRole('button', { name: 'Update and reload' }))

    expect(registration.updateSW).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Save the session or export it before updating.',
    )
  })

  it('keeps registration errors non-destructive and dismissible', () => {
    const registration = captureRegistration()
    render(
      <PwaStatus
        prepareForReload={() => true}
        registerWorker={registration.registerWorker}
      />,
    )

    act(() =>
      registration
        .callbacks()
        .onRegisterError(new Error('service worker unavailable')),
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Offline support could not be started. You can keep using the app.',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss PWA status' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('keeps a rejected activation non-destructive and recoverable', async () => {
    const registration = captureRegistration(
      vi.fn().mockRejectedValue(new Error('activation failed')),
    )
    render(
      <PwaStatus
        prepareForReload={() => true}
        registerWorker={registration.registerWorker}
      />,
    )
    act(() => registration.callbacks().onNeedRefresh())

    fireEvent.click(screen.getByRole('button', { name: 'Update and reload' }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'The update could not be applied. You can keep using this version.',
      ),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss PWA status' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('disposes registration listeners on unmount', () => {
    const registration = captureRegistration()
    const removeEventListener = vi.spyOn(document, 'removeEventListener')
    const clearInterval = vi.spyOn(window, 'clearInterval')
    const { unmount } = render(
      <PwaStatus
        prepareForReload={() => true}
        registerWorker={registration.registerWorker}
      />,
    )

    unmount()

    expect(removeEventListener).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function),
    )
    expect(clearInterval).toHaveBeenCalledOnce()
  })
})
