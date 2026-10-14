import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider, CssBaseline } from '@mui/material'
import './index.css'
// React Flow's own stylesheet, shipped by survey-builder-kit as a static CSS
// file (not covered by its Emotion CSS-in-JS) -- required for the Flow map
// inside <SurveyBuilder> to render correctly (minimap, controls, edges,
// handles all depend on it).
import 'survey-builder-kit/style.css'
import App from './App.tsx'
import { theme } from './theme.ts'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </StrictMode>,
)
