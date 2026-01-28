import React from 'react'
import './styles/button.css'

export type ButtonVariant = 'default' | 'danger' | 'light'
export type ButtonSize = 'sm' | 'md'

export type ButtonProps = {
  variant?: ButtonVariant
  size?: ButtonSize
  disabled?: boolean
  onClick?: () => void
  children: React.ReactNode
  title?: string
  className?: string
  type?: 'button' | 'submit' | 'reset'
}

export function Button({
  variant = 'default',
  size = 'sm',
  disabled,
  onClick,
  children,
  title,
  className,
  type = 'button'
}: ButtonProps) {
  const classes = [
    'lsButton',
    variant === 'danger' ? 'lsButton--danger' : null,
    variant === 'light' ? 'lsButton--light' : null,
    size === 'md' ? 'lsButton--md' : 'lsButton--sm',
    className ?? null
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button className={classes} disabled={disabled} onClick={onClick} title={title} type={type}>
      {children}
    </button>
  )
}

