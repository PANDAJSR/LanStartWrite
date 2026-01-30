import React from 'react'
import '@mantine/core/styles.css'
import { MantineProvider, createTheme } from '@mantine/core'

const theme = createTheme({
  primaryColor: 'blue',
  defaultRadius: 'md'
})

export function LanStartMantineProvider(props: { children: React.ReactNode }) {
  return (
    <MantineProvider theme={theme} defaultColorScheme="dark">
      {props.children}
    </MantineProvider>
  )
}

