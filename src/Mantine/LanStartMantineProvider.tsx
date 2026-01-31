import React from 'react'
import '@mantine/core/styles.css'
import { MantineProvider, createTheme } from '@mantine/core'
import { useAppAppearance } from '../toolbar/hooks/useEventsPoll'

const theme = createTheme({
  primaryColor: 'blue',
  defaultRadius: 'md'
})

export function LanStartMantineProvider(props: { children: React.ReactNode }) {
  const { appearance } = useAppAppearance()
  return (
    <MantineProvider theme={theme} defaultColorScheme="light" forceColorScheme={appearance}>
      {props.children}
    </MantineProvider>
  )
}
