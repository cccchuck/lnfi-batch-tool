import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'

import '@mantine/core/styles.css'
import './index.css'
import { createTheme, MantineProvider } from '@mantine/core'
import { Toaster } from 'sonner'

const theme = createTheme({
  primaryColor: 'primary-color',
  colors: {
    'primary-color': [
      '#eff6ff',
      '#dbeafe',
      '#bfdbfe',
      '#93c5fd',
      '#60a5fa',
      '#3b82f6',
      '#2563eb',
      '#1d4ed8',
      '#1e40af',
      '#1e3a8a',
      '#172554',
    ],
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme}>
      <App />
      <Toaster richColors />
    </MantineProvider>
  </StrictMode>
)
