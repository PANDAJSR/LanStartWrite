import React from 'react'

export type ButtonGroupProps = {
  children: React.ReactNode
  className?: string
}

export function ButtonGroup({ children, className }: ButtonGroupProps) {
  const classes = ['lsButtonGroup', className ?? null].filter(Boolean).join(' ')
  return <div className={classes}>{children}</div>
}

