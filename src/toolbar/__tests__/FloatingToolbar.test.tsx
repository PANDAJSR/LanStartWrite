import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FloatingToolbarApp } from '../FloatingToolbar'

describe('FloatingToolbar', () => {
  it('posts create-window command on click', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (typeof url === 'string' && url.includes('/commands')) return new Response(JSON.stringify({ ok: true }))
      if (typeof url === 'string' && url.includes('/kv/')) return new Response(JSON.stringify({ ok: false }), { status: 404 })
      return new Response(JSON.stringify({ ok: true, items: [], latest: 0 }))
    })
    vi.stubGlobal('fetch', fetchMock as any)

    render(<FloatingToolbarApp />)
    await user.click(await screen.findByRole('button', { name: '新建窗口' }))

    const calls = fetchMock.mock.calls.filter((c) => String(c[0]).includes('/commands'))
    expect(calls.length).toBeGreaterThan(0)
    const commands = calls
      .map((c) => JSON.parse(String(c[1]?.body ?? '{}')) as { command?: string })
      .map((b) => b.command)
      .filter(Boolean)
    expect(commands).toContain('create-window')
  })

  it('posts toggle-subwindow command on click', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (typeof url === 'string' && url.includes('/commands')) return new Response(JSON.stringify({ ok: true }))
      if (typeof url === 'string' && url.includes('/kv/')) return new Response(JSON.stringify({ ok: false }), { status: 404 })
      return new Response(JSON.stringify({ ok: true, items: [], latest: 0 }))
    })
    vi.stubGlobal('fetch', fetchMock as any)

    render(<FloatingToolbarApp />)
    await user.click(await screen.findByRole('button', { name: '事件' }))

    const calls = fetchMock.mock.calls.filter((c) => String(c[0]).includes('/commands'))
    const bodies = calls.map((c) => JSON.parse(String(c[1]?.body ?? '{}')) as { command?: string })
    const commands = bodies.map((b) => b.command).filter(Boolean)
    expect(commands).toContain('toggle-subwindow')
  })

  it('does not raise unhandled rejection on quit', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async () => {
      throw new Error('fetch_failed')
    })
    vi.stubGlobal('fetch', fetchMock as any)

    const unhandled = vi.fn()
    window.addEventListener('unhandledrejection', unhandled as any)

    render(<FloatingToolbarApp />)
    await user.click(await screen.findByRole('button', { name: '退出' }))
    await new Promise((r) => setTimeout(r, 0))

    expect(unhandled).toHaveBeenCalledTimes(0)
    window.removeEventListener('unhandledrejection', unhandled as any)
  })
})
