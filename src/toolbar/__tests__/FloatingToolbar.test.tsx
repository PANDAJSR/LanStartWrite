import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FloatingToolbarApp } from '../FloatingToolbar'

describe('FloatingToolbar', () => {
  it('posts create-window command on click', async () => {
    const user = userEvent.setup()
    const calls: Array<{ command: string; payload?: unknown }> = []
    window.lanstart = {
      postCommand: async (command, payload) => {
        calls.push({ command, payload })
        return null
      },
      getEvents: async () => ({ items: [], latest: 0 }),
      getKv: async () => {
        throw new Error('kv_not_found')
      },
      putKv: async () => null,
      getUiState: async () => ({}),
      putUiStateKey: async () => null,
      deleteUiStateKey: async () => null,
      apiRequest: async () => ({ status: 200, body: { ok: true } })
    }

    render(<FloatingToolbarApp />)
    await user.click(await screen.findByRole('button', { name: '新建窗口' }))

    expect(calls.length).toBeGreaterThan(0)
    expect(calls.map((c) => c.command)).toContain('create-window')
  })

  it('posts toggle-subwindow command on click', async () => {
    const user = userEvent.setup()
    const calls: Array<{ command: string; payload?: unknown }> = []
    window.lanstart = {
      postCommand: async (command, payload) => {
        calls.push({ command, payload })
        return null
      },
      getEvents: async () => ({ items: [], latest: 0 }),
      getKv: async () => {
        throw new Error('kv_not_found')
      },
      putKv: async () => null,
      getUiState: async () => ({}),
      putUiStateKey: async () => null,
      deleteUiStateKey: async () => null,
      apiRequest: async () => ({ status: 200, body: { ok: true } })
    }

    render(<FloatingToolbarApp />)
    await user.click(await screen.findByRole('button', { name: '事件' }))

    expect(calls.map((c) => c.command)).toContain('toggle-subwindow')
  })

  it('does not raise unhandled rejection on quit', async () => {
    const user = userEvent.setup()
    window.lanstart = {
      postCommand: async () => {
        throw new Error('command_failed')
      },
      getEvents: async () => ({ items: [], latest: 0 }),
      getKv: async () => {
        throw new Error('kv_not_found')
      },
      putKv: async () => null,
      getUiState: async () => ({}),
      putUiStateKey: async () => null,
      deleteUiStateKey: async () => null,
      apiRequest: async () => ({ status: 200, body: { ok: true } })
    }

    const unhandled = vi.fn()
    window.addEventListener('unhandledrejection', unhandled as any)

    render(<FloatingToolbarApp />)
    await user.click(await screen.findByRole('button', { name: '退出' }))
    await new Promise((r) => setTimeout(r, 0))

    expect(unhandled).toHaveBeenCalledTimes(0)
    window.removeEventListener('unhandledrejection', unhandled as any)
  })
})
