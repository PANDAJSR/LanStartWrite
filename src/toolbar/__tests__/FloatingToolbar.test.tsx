import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FloatingToolbarApp } from '../FloatingToolbar'

describe('FloatingToolbar', () => {
  it('toggles collapse state', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (url: string) => {
      if (typeof url === 'string' && url.includes('/events')) {
        return new Response(JSON.stringify({ ok: true, items: [], latest: 0 }))
      }
      if (typeof url === 'string' && url.includes('/kv/')) {
        return new Response(JSON.stringify({ ok: false }), { status: 404 })
      }
      return new Response(JSON.stringify({ ok: true }))
    })
    vi.stubGlobal('fetch', fetchMock as any)

    render(<FloatingToolbarApp />)

    const collapse = await screen.findByRole('button', { name: '折叠' })
    await user.click(collapse)
    expect(await screen.findByRole('button', { name: '展开' })).toBeInTheDocument()
  })

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
})
