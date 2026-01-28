import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '../Button'

describe('Button', () => {
  it('renders children', () => {
    render(<Button>确认</Button>)
    expect(screen.getByRole('button', { name: '确认' })).toBeInTheDocument()
  })

  it('calls onClick when enabled', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<Button onClick={onClick}>点我</Button>)
    await user.click(screen.getByRole('button', { name: '点我' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does not call onClick when disabled', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <Button disabled onClick={onClick}>
        点我
      </Button>
    )
    await user.click(screen.getByRole('button', { name: '点我' }))
    expect(onClick).toHaveBeenCalledTimes(0)
  })
})

